import {
	Program,
	EmbeddedCode,
	CodeText,
	JSXElement,
	JSXElementKind,
	JSXText,
	JSXComment,
	JSXInsert,
	JSXField,
	JSXStaticField,
	JSXDynamicField,
	JSXStyleProperty,
	JSXFunction,
	JSXContent,
	JSXSpread,
	CodeSegment,
} from './AST'
import { LOC } from './parse'
import { locationMark } from './sourcemap'
import { Params } from './compile'
import { getFieldData, FieldFlags } from './fieldData'

export { codeGen, codeStr }

// pre-compiled regular expressions
const rx = {
	backslashes: /\\/g,
	newlines: /\r?\n/g,
	hasParen: /\(/,
	loneFunction: /^function |^\(\w*\) =>|^\w+ =>/,
	endsInParen: /\)\s*$/,
	nonIdChars: /[^a-zA-Z0-9]/g,
	doubleQuotes: /"/g,
	indent: /\n(?=[^\n]+$)([ \t]*)/,
}

class DOMExpression {
	constructor(
		public readonly ids: string[],
		public readonly statements: string[],
		public readonly computations: Computation[],
	) { }
}

class Computation {
	constructor(
		public readonly statements: string[],
		public readonly loc: LOC,
		public readonly stateVar: string | null,
		public readonly seed: string | null,
	) { }
}

class SubComponent {
	constructor(
		public readonly name: string,
		public readonly refs: string[],
		public readonly fns: string[],
		public readonly properties: (string | { [ name: string ]: string })[],
		public readonly children: string[],
		public readonly loc: LOC,
	) { }
}

const codeGen = (ctl: Program, opts: Params) => {
	const compileSegments = (node: Program | EmbeddedCode) => {
		return node.segments.reduce((res, s) => res + compileSegment(s, res), '')
	}
	const compileSegment = (node: CodeSegment, previousCode: string) => node.type === CodeText ? compileCodeText(node) : compileJSXElement(node, indent(previousCode))
	const compileCodeText = (node: CodeText) => markBlockLocs(node.text, node.loc, opts)
	const compileJSXElement = (node: JSXElement, indent: Indents): string => {
		const code =
                node.kind === JSXElementKind.SubComponent
                	? compileSubComponent(node, indent)
                	: compileHtmlElement(node, indent)
		return markLoc(code, node.loc, opts)
	}
	const compileSubComponent = (node: JSXElement, indent: Indents): string => {
		return emitSubComponent(buildSubComponent(node), indent)
	}
	const compileHtmlElement = (node: JSXElement, indent: Indents): string => {
		const svg = node.kind === JSXElementKind.SVG
		return (
		// optimization: don't need IIFE for simple single nodes
			node.fields.length === 0 && node.functions.length === 0 && node.content.length === 0
				? `${node.references.map(r => `${compileSegments(r.code) } = `).join('')
				}Surplus.create${svg ? 'Svg' : ''}Element('${node.tag}', null, null)`
			// optimization: don't need IIFE for simple single nodes with a single class attribute
				: node.fields.length === 1
                    && isStaticClassField(node.fields[0], svg)
                    && node.functions.length === 0
                    && node.content.length === 0
					? `${node.references.map(r => `${compileSegments(r.code) } = `).join('')
					}Surplus.create${svg ? 'Svg' : ''}Element(${codeStr(node.tag)}, ${(node.fields[0] as JSXStaticField).value}, null)`
					: emitDOMExpression(buildDOMExpression(node), indent)
		)
	}
	const buildSubComponent = (node: JSXElement) => {
		const
			refs = node.references.map(r => compileSegments(r.code))
		const fns = node.functions.map(r => compileSegments(r.code))
		// group successive properties into property objects, but spreads stand alone
		// e.g. a="1" b={foo} {...spread} c="3" gets combined into [{a: "1", b: foo}, spread, {c: "3"}]
		const properties = node.fields.reduce((props: (string | { [name: string]: string })[], p) => {
			const lastSegment = props.length > 0 ? props[props.length - 1] : null
			const value = p.type === JSXStaticField ? p.value : compileSegments(p.code)

			if (p.type === JSXSpread)
				props.push(value)
			else if (lastSegment === null
                        || typeof lastSegment === 'string'
                        || (p.type === JSXStyleProperty && lastSegment.style)
			)
				props.push({ [p.name]: value })
			else
				lastSegment[p.name] = value


			return props
		}, [])
		const children = node.content.map(c => c.type === JSXElement ? compileJSXElement(c, indent(''))
			: c.type === JSXText ? codeStr(c.text)
				: c.type === JSXInsert ? compileSegments(c.code)
					: `document.createComment(${codeStr(c.text)})`)

		return new SubComponent(node.tag, refs, fns, properties, children, node.loc)
	}
	const emitSubComponent = (sub: SubComponent, indent: Indents) => {
		const { nl, nli, nlii } = indent

		// build properties expression
		const
			// convert children to an array expression
			children = sub.children.length === 0 ? null
				: sub.children.length === 1 ? sub.children[0]
					: `[${ nlii
					}${sub.children.join(`,${ nlii}`) }${nli
					}]`
		const lastProperty = sub.properties.length === 0 ? null : sub.properties[sub.properties.length - 1]
		// if there are any children, add them to (or add a) last object
		const propertiesWithChildren =
                    children === null ? sub.properties
                    	: lastProperty === null || typeof lastProperty === 'string'
                    	// add a new property object to hold children
                    		? [...sub.properties, { children }]
                    	// add children to last property object
                    		: [...sub.properties.slice(0, sub.properties.length - 1), { ...lastProperty, children }]
		// if we're going to be Object.assign'ing to the first object, it needs to be one we made, not a spread
		const propertiesWithInitialObject =
                    propertiesWithChildren.length === 0 || (propertiesWithChildren.length > 1 && typeof propertiesWithChildren[0] === 'string')
                    	? [{}, ...propertiesWithChildren]
                    	: propertiesWithChildren
		const propertyExprs = propertiesWithInitialObject.map(obj => typeof obj === 'string' ? obj
			: `{${ Object.keys(obj).map(p => `${nli}${codeStr(p)}: ${obj[p]}`).join(',') }${nl }}`)
		const properties = propertyExprs.length === 1 ? propertyExprs[0]
			: `Object.assign(${propertyExprs.join(', ')})`

		// main call to sub-component
		let expr = `${sub.name}(${properties})`

		// ref assignments
		if (sub.refs.length > 0)
			expr = sub.refs.map(r => `${r } = `).join('') + expr


		// build computations for fns
		if (sub.fns.length > 0) {
			const comps = sub.fns.map(fn => new Computation([`(${fn})(__, __state);`], sub.loc, '__state', null))

			expr = `(function (__) {${
				nli}var __ = ${expr};${
				nli}${comps.map(comp => emitComputation(comp, indent)).join(nli)}${
				nli}return __;${
				nl}})()`
		}

		return expr
	}
	const buildDOMExpression = (top: JSXElement) => {
		const ids = [] as string[]
		const statements = [] as string[]
		const computations = [] as Computation[]

		const buildHtmlElement = (node: JSXElement, parent: string, n: number) => {
			const { tag, fields, references, functions, content, loc } = node
			if (node.kind === JSXElementKind.SubComponent)
				buildInsertedSubComponent(node, parent, n)
			else {
				const
					id = addId(parent, tag, n)
				const svg = node.kind === JSXElementKind.SVG
				const fieldExprs = fields.map(p => p.type === JSXStaticField ? '' : compileSegments(p.code))
				const spreads = fields.filter(p => p.type === JSXSpread || p.type === JSXStyleProperty)
				const classField = spreads.length === 0 && fields.filter(p => isStaticClassField(p, svg))[0] as JSXStaticField || null
				const fieldsDynamic = fieldExprs.some(e => !noApparentSignals(e))
				const fieldStmts = fields.map((f, i) => f === classField ? ''
					: f.type === JSXStaticField ? buildField(id, f, f.value, node)
						: f.type === JSXDynamicField ? buildField(id, f, fieldExprs[i], node)
							: f.type === JSXStyleProperty ? buildStyle(f, id, fieldExprs[i], fieldsDynamic, spreads)
								: buildSpread(id, fieldExprs[i], svg)).filter(s => s !== '')
				const refStmts = references.map(r => `${compileSegments(r.code) } = `).join('')

				addStatement(`${id} = ${refStmts}Surplus.create${svg ? 'Svg' : ''}Element(${codeStr(tag)}, ${classField && classField.value}, ${parent || null});`)

				if (!fieldsDynamic)
					fieldStmts.forEach(addStatement)


				if (content.length === 1 && content[0].type === JSXInsert)
					buildJSXContent(content[0], id)
				else
					content.forEach((c, i) => buildChild(c, id, i))


				if (fieldsDynamic)
					addComputation(fieldStmts, null, null, loc)


				functions.forEach(f => buildNodeFn(f, id))
			}
		}
		const buildField = (id: string, field: JSXStaticField | JSXDynamicField, expr: string, parent: JSXElement) => {
			const [name, namespace, flags] = getFieldData(field.name, parent.kind === JSXElementKind.SVG)
			const type = flags & FieldFlags.Type
			return (
				type === FieldFlags.Property ? buildProperty(id, name, namespace, expr)
					: type === FieldFlags.Attribute ? buildAttribute(id, name, namespace, expr)
						: ''
			)
		}
		const buildProperty = (id: string, name: string, namespace: string | null, expr: string) => namespace ? `${id}.${namespace}.${name} = ${expr};` : `${id}.${name} = ${expr};`
		const buildAttribute = (id: string, name: string, namespace: string | null, expr: string) => namespace ? `Surplus.setAttributeNS(${id}, ${codeStr(namespace)}, ${codeStr(name)}, ${expr});`
			: `Surplus.setAttribute(${id}, ${codeStr(name)}, ${expr});`
		const buildSpread = (id: string, expr: string, svg: boolean) => `Surplus.spread(${id}, ${expr}, ${svg});`
		const buildNodeFn = (node: JSXFunction, id: string) => {
			const expr = compileSegments(node.code)
			addComputation([`(${expr})(${id}, __state);`], '__state', null, node.loc)
		}
		const buildStyle = (node: JSXStyleProperty, id: string, expr: string, dynamic: boolean, spreads: JSXField[]) => `Surplus.assign(${id}.style, ${expr});`
		const buildChild = (node: JSXContent, parent: string, n: number) => node.type === JSXElement ? buildHtmlElement(node, parent, n)
			: node.type === JSXComment ? buildHtmlComment(node, parent)
				: node.type === JSXText ? buildJSXText(node, parent, n)
					: buildJSXInsert(node, parent, n)
		const buildInsertedSubComponent = (node: JSXElement, parent: string, n: number) => buildJSXInsert({ type: JSXInsert, code: { type: EmbeddedCode, segments: [node] }, loc: node.loc }, parent, n)
		const buildHtmlComment = (node: JSXComment, parent: string) => addStatement(`Surplus.createComment(${codeStr(node.text)}, ${parent})`)
		const buildJSXText = (node: JSXText, parent: string, n: number) => addStatement(`Surplus.createTextNode(${codeStr(node.text)}, ${parent})`)
		const buildJSXInsert = (node: JSXInsert, parent: string, n: number) => {
			const id = addId(parent, 'insert', n)
			const ins = compileSegments(node.code)
			const range = `{ start: ${id}, end: ${id} }`
			addStatement(`${id} = Surplus.createTextNode('', ${parent})`)
			addComputation([`Surplus.insert(__range, ${ins});`], '__range', range, node.loc)
		}
		const buildJSXContent = (node: JSXInsert, parent: string) => {
			const content = compileSegments(node.code)
			const dynamic = !noApparentSignals(content)
			if (dynamic) addComputation([`Surplus.content(${parent}, ${content}, __current);`], '__current', "''", node.loc)
			else addStatement(`Surplus.content(${parent}, ${content}, "");`)
		}
		const addId = (parent: string, tag: string, n: number) => {
			tag = tag.replace(rx.nonIdChars, '_')
			const id = parent === '' ? '__' : parent + (parent[parent.length - 1] === '_' ? '' : '_') + tag + (n + 1)
			ids.push(id)
			return id
		}
		const addStatement = (stmt: string) => statements.push(stmt)
		const addComputation = (body: string[], stateVar: string | null, seed: string | null, loc: LOC) => {
			computations.push(new Computation(body, loc, stateVar, seed))
		}

		buildHtmlElement(top, '', 0)

		return new DOMExpression(ids, statements, computations)
	}
	const emitDOMExpression = (code: DOMExpression, indent: Indents) => {
		const { nl, nli, nlii } = indent
		return `(function () {${ nli
		}var ${ code.ids.join(', ') };${ nli
		}${code.statements.join(nli) }${nli
		}${code.computations.map(comp => emitComputation(comp, indent))
			.join(nli) }${code.computations.length === 0 ? '' : nli
		}return __;${ nl
		}})()`
	}
	const emitComputation = (comp: Computation, { nli, nlii }: Indents) => {
		const { statements, loc, stateVar, seed } = comp

		if (stateVar) statements[statements.length - 1] = `return ${ statements[statements.length - 1]}`

		const body = statements.length === 1 ? ` ${ statements[0] } ` : nlii + statements.join(nlii) + nli
		const code = `Surplus.S.effect(function (${stateVar || ''}) {${body}}${seed !== null ? `, ${seed}` : ''});`

		return markLoc(code, loc, opts)
	}

	return compileSegments(ctl)
}

const
	isStaticClassField = (p: JSXField, svg: boolean) => p.type === JSXStaticField && getFieldData(p.name, svg)[0] === (svg ? 'class' : 'className')
const noApparentSignals = (code: string) => !rx.hasParen.test(code) || (rx.loneFunction.test(code) && !rx.endsInParen.test(code))
const indent = (previousCode: string): Indents => {
	const m = rx.indent.exec(previousCode)
	const pad = m ? m[1] : ''
	const nl = `\r\n${ pad}`
	const nli = `${nl }    `
	const nlii = `${nli }    `

	return { nl, nli, nlii }
}
const codeStr = (str: string) => `"${
	str.replace(rx.backslashes, '\\\\')
        	.replace(rx.doubleQuotes, '\\"')
        	.replace(rx.newlines, '\\n')
}"`

interface Indents { nl: string, nli: string, nlii: string }

const
	markLoc = (str: string, loc: LOC, opts: Params) => opts.sourcemap ? locationMark(loc) + str : str
const markBlockLocs = (str: string, loc: LOC, opts: Params) => {
	if (!opts.sourcemap) return str

	const lines = str.split('\n')
	let offset = 0

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i]
		offset += line.length
		const lineloc = { line: loc.line + i, col: 0, pos: loc.pos + offset + i }
		lines[i] = locationMark(lineloc) + line
	}

	return locationMark(loc) + lines.join('\n')
}
