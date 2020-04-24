import ts = require('typescript')
import '@ts-std/extensions/dist/array'

import { Dict } from '../utils'
import {
	Entity, Tag, Directive, Text,
	Meta, Attribute, AttributeValue, AttributeCode, Directive, Text, TextItem,
} from './ast'

const requiredRuntimeFunctions = new Set<string>()
function requireRuntime(functionName: string) {
	requiredRuntimeFunctions.add(functionName)
	return functionName
}
function resetRuntime() {
	requiredRuntimeFunctions.clear()
}

const rawCodeSegments = [] as { marker: string, code: string }[]
function createRawCodeSegment(code: string): ts.Identifier {
	const count = '' + rawCodeSegments.length
	const marker = `&%&%` + count.repeat(11) + `&%&%`
	rawCodeSegments.push({ marker, code })
	return ts.createIdentifier(marker)
}

function makeContainerNames(baseName: string): [string, string] {
	const containerName = `___${baseName}`
	const fragmentName = containerName + 'Fragment'
	return [containerName, fragmentName]
}

function createNodeType() {
	return ts.createTypeReferenceNode(ts.createIdentifier('Node'), undefined)
}
function createArgsType() {
	return ts.createTypeReferenceNode(ts.createIdentifier('Args'), [
		ts.createTypeReferenceNode(ts.createIdentifier('Component'), undefined),
	])
}
function createFullArgsType() {
	return ts.createTypeReferenceNode(ts.createIdentifier('FullArgs'), [
		ts.createTypeReferenceNode(ts.createIdentifier('Component'), undefined),
	])
}

function createObjectBindingPattern(names: string[]) {
	return ts.createObjectBindingPattern(names.map(name => {
		return ts.createBindingElement(undefined, undefined, ts.createIdentifier(name), undefined)
	}))
}

function createConst(pattern: string | string[] | ts.Expression, expression: ts.Expression) {
	return ts.createVariableStatement(
		undefined,
		ts.createVariableDeclarationList([
			ts.createVariableDeclaration(
				typeof pattern === 'string' ? ts.createIdentifier(pattern)
					: Array.isArray(pattern) ? createObjectBindingPattern(pattern)
					: pattern,
				undefined,
				expression,
			),
		], ts.NodeFlags.Const),
	)
}

function createCall(target: string | ts.Expression, args: ts.Expression[]) {
	return ts.createCall(
		typeof target === 'string' ? ts.createIdentifier(name) : target,
		undefined, args,
	)
}

function createArrowFunction(parameters: ts.ParameterDeclaration[], body: ts.ConciseBody) {
	return ts.createArrowFunction(
		undefined, undefined, parameters, undefined,
		ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken), body,
	)
}

function createParameter(param: string | string[], type: ts.TypeReferenceNode) {
	return ts.createParameter(
		undefined, undefined, undefined,
		typeof param === 'string'
			? ts.createIdentifier(param)
			: createObjectBindingPattern(param),
		undefined, type, undefined,
	)
}

function createFragmentConstructor(targetName: string) {
	return createConst(
		targetName,
		createCall(ts.createPropertyAccess('document', 'createDocumentFragment')), []),
	)
}

// as an optimization for the call sites to avoid a bunch of empty object allocations,
// you can pass a reference to the same global empty object for all the groups that haven't provided anything
// function render(
// 	parent: Node,
// 	{}: ComponentArgs<Component>,
// 	{ a }: ComponentProps<Component>,
// 	{}: ComponentEvents<Component>,
// 	{}: ComponentSyncs<Component>,
// 	{ someSlot }: ComponentSlots<Component>,
// ) {
// 	const { d } = setup({ a } as Args<Component>)
// 	// go along producing the dom stuff
// }
const [componentParentName, componentParentFragmentName] = makeContainerNames('___parent')
export function generateComponentRender(
	argsNames: string[], slotNames: string[], setupNames: string[],
	entities: NonEmpty<Entity>,
) {
	const parentParameter = createParameter(componentParentName, createNodeType())
	const fullArgsParameter = createParameter(argsNames.concat(slotNames), createFullArgsType())

	const [isLone, possibleFragmentCreators, parentContainerName] = entities.length > 1
		? [false, [createFragmentConstructor(componentParentFragmentName)], componentParentFragmentName]
		: [true, [], componentParentName]

	const generatedEntities = entities.flat_map((entity, index) => generateEntity(entity, '' + index, isLone, parentContainerName))

	const setupCall = createConst(
		setupNames,
		createCall('setup', [ts.createAsExpression(
			ts.createObjectLiteral(
				argsNames.map(arg => {
					return ts.createShorthandPropertyAssignment(ts.createIdentifier(arg), undefined)
				}),
				false,
			),
			createArgsType(),
		)]),
	)

	const statements = [setupCall]
		.concat(possibleFragmentCreators)
		.concat(generatedEntities)

	return ts.createFunctionDeclaration(
		undefined, [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
		undefined, ts.createIdentifier('render'), undefined,
		[parentParameter, fullArgsParameter],
		undefined, ts.createBlock(statements, true),
	)
}


export function generateEntity(
	entity: Entity, offset: string,
	isLone: boolean, parentContainerName: string,
) {
	const parent = ts.createIdentifier(parentContainerName)
	switch (entity.type) {
	case 'Tag':
		return generateTag(entity, offset, parent)

	case 'TextSection':
		return generateText(entity, offset, isLone, parent)

	case 'Directive':
		return generateDirective(entity, offset, isLone, parent)
	}
}

export function generateTag(
	{ ident, metas, attributes, entities }: Tag,
	offset: string, parent: ts.Identifier,
) {
	if (ident === 'input' || ident === 'textarea' || ident === 'select') {
		throw new Error('unimplemented')
	}

	const [tagName, tentativeContainerName] = makeContainerNames(ident + offset)

	const statements = [createConst(
		tagName,
		createCall(requireRuntime('createElement'), [parent, ts.createStringLiteral(ident)]),
	)]

	const [childLone, possibleFragmentCreators, containerName] = entities.length > 1
		? [false, [createFragmentConstructor(tagName)], tentativeContainerName]
		: [true, [], tagName]

	statements.push_all(possibleFragmentCreators)

	let idMeta = ''
	let idDynamic = false
	let classMeta = ''
	let classDynamic = false
	for (const { isClass, isDynamic, value } of metas) {
		const meta = { isDynamic, value }
		if (isClass) {
			if (isDynamic) classDynamic = true
			classMeta += isDynamic
				? ' ${' + value + '}'
				: ` ${value}`
			continue
		}

		if (idMeta !== undefined) throw new Error("duplicate id metas")
		idMeta = value
		idDynamic = isDynamic
	}

	if (idMeta !== '') {
		const idAssignment = idDynamic
			? createEffectBind(tagName, 'id', createRawCodeSegment(idMeta))
			: createFieldAssignment(tagName, 'id', ts.createStringLiteral(idMeta))
		statements.push(idAssignment)
	}

	const className = classMeta.trim()
	if (className !== '') {
		const classNameAssignment = classDynamic
			? createEffectBind(tagName, 'className', createRawCodeSegment('`' + className + '`'))
			: createFieldAssignment(tagName, 'className', ts.createStringLiteral(className))
		statements.push(classNameAssignment)
	}

	for (const { name: attribute, value } of attributes) {
		const [isDynamic, finalValue] =
			value === undefined ? [false, ts.createTrue()]
			: typeof value === 'string' ? [false, ts.createStringLiteral(value)]
			// TODO this might not be a good idea for basic attributes,
			// since we shouldn't necessarily assume this thing is itself reactive
			// what about the situations where this is part of the static render?
			// or a value they merely produced from something else?
			// component props are the only place where it makes some kind of sense
			// to get everything into Immutable form *somehow*
			: value.isBare ? [true, createRawCodeSegment(`${value.code}()`)]
			: [true, createRawCodeSegment(value.code)]

		// TODO in the future I might get rid of the dynamic metas
		// in this situation we'd just do the same thing the metas loop is doing above
		// and then continue out of this loop iteration
		// if (attribute === 'id') if not dynamic throw new Error("don't use the `id` attribute, use `#id-name` syntax instead")
		// if (attribute === 'class') if not dynamic throw new Error("don't use the `class` attribute, use `.class-name` syntax instead")

		if (attribute === '&fn')
			throw new Error('unimplemented')

		// const re = /^(?:\w*\([a-zA-Z_0-9]*\)\w*\=\>)|(?:\w*[a-zA-Z_0-9]*\w*\=\>)/
		// console.log(re.test('(sd: e) =>'))
		// console.log(re.test('(*) =>'))
		if (attribute.startsWith('@'))
			throw new Error('unimplemented')

		const target = attribute === 'style'
			? ts.createPropertyAccess(tagName, 'style')
			: tagName

		const attributeAssignment = isDynamic
			? createEffectBind(target, attribute, finalValue)
			: createFieldAssignment(target, attribute, finalValue)
		statements.push(attributeAssignment)
	}

	for (const [index, entity] of entities.entries()) {
		const childStatement = generateEntity(entity, `${offset}_${index}`, childLone, containerName)
		statements.push(childStatement)
	}

	return statements
}

export function generateText(
	{ items }: TextSection,
	offset: string, isLone: boolean, parent: ts.Identifier,
) {
	let isDynamic = false
	let content = ''
	for (const item of items) {
		if (item.isCode) isDynamic = true
		content += item.isCode
			? '${' + item.content + '}'
			: ` ${item.content}`
	}

	if (isLone) return isDynamic
		? [createEffectBind(parent, 'textContent', createRawCodeSegment('`' + content + '`'))]
		: [createFieldAssignment(parent, 'textContent', ts.createStringLiteral(content))]

	// const textIdent = ts.createIdentifier(`___text${offset}`)
	return isDynamic
		? [
			createCall(requireRuntime('createBoundTextNode'), [
				parent,
				createArrowFunction([], createRawCodeSegment('`' + content + '`')),
			]),
			// createConst(
			// 	textIdent,
			// 	createCall(ts.createPropertyAccess('document', 'createTextNode'), [ts.createStringLiteral('')]),
			// ),
			// createEffectBind(textIdent, 'data', createRawCodeSegment('`' + content + '`'))
			// createCall(ts.createPropertyAccess(parent, 'appendChild'), [textIdent]),
		]
		: [createCall(requireRuntime('createTextNode'), [parent, ts.createStringLiteral(content)])]
}

export function generateDirective(
	{ isPlus, ident, code, entities }: Directive,
	offset: string, isLone: boolean, parent: ts.Identifier,
) {
	switch (ident) {
	case '':
	}
	// if (isPlus)
		// this means it's a component inclusion
		// either use replaceContent if this is the lone child or replaceRange with an initial placeholder

	throw new Error('unimplemented')
}



function createFieldAssignment(
	target: string | ts.Expression,
	field: string,
	expression: ts.Expression,
) {
	return ts.createExpressionStatement(
		ts.createBinary(
			ts.createPropertyAccess(
				typeof target === 'string' ? ts.createIdentifier(target) : target,
				field,
			),
			ts.createToken(ts.SyntaxKind.FirstAssignment),
			expression,
		),
	)
}

function createEffectBind(
	target: string | ts.Expression,
	field: string,
	expression: ts.Expression,
) {
	return createCall(requireRuntime('effect'), [
		createArrowFunction([], ts.createBlock([
			createFieldAssignment(target, field, expression),
		], true)),
	])
}












// const n = ts.createVariableStatement(
// 	undefined,
// 	ts.createVariableDeclarationList(
// 		[
// 			ts.createVariableDeclaration(
// 				ts.createIdentifier('s'),
// 				undefined,
// 				ts.createTemplateExpression(ts.createTemplateHead('begin '), [
// 					ts.createTemplateSpan(
// 						createRawCodeSegment(`f().something
// 								+ 2`),
// 						ts.createTemplateTail(' end'),
// 					),
// 				]),
// 			),
// 		],
// 		ts.NodeFlags.Const,
// 	),
// )


// let generatedCode = printNode(n)
// // let scanningCode =
// console.log(generatedCode)
// for (const { marker, code } of rawCodeSegments) {
// 	// a future optimization could be to trim through the generatedCode
// 	// and therefore not require the regex library to scan through all the parts that we know won't have our marker
// 	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/indexOf
// 	generatedCode = generatedCode.replace(marker, code)
// }

// console.log(generatedCode)




const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, omitTrailingSemicolon: true })
export function printNode(node: Parameters<typeof printer.printNode>[1], filename = '') {
	const resultFile = ts.createSourceFile(filename, '', ts.ScriptTarget.Latest, false, ts.ScriptKind.TS)
	return printer.printNode(ts.EmitHint.Unspecified, node, resultFile)
}
