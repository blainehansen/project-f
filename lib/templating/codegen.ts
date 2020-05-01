import ts = require('typescript')

import { Dict, tuple as t, NonEmpty, NonLone } from '../utils'
import {
	Entity, AttributeValue, Directive,
	ComponentDefinition, Tag, Meta, Attribute, AttributeCode, TextSection, TextItem,
	ComponentInclusion, IfBlock, EachBlock, MatchBlock, MatchPattern, SwitchBlock, SwitchCase, SwitchDefault,
	SlotDefinition, SlotInsertion, TemplateDefinition, TemplateInclusion,
} from './ast'

function safePrefix(s: string) {
	return `___${s}`
}
function safePrefixIdent(...segments: NonLone<string>) {
	return ts.createIdentifier(safePrefix(segments.join('')))
}

class CodegenContext {
	protected rawCodeSegments = [] as { marker: string, code: string }[]
	protected requiredFunctions = new Set<string>()

	requireRuntime(functionName: string) {
		this.requiredFunctions.add(functionName)
		return ts.createIdentifier(safePrefix(functionName))
	}

	createRawCodeSegment(code: string): ts.Identifier {
		const count = '' + this.rawCodeSegments.length
		const marker = `&%&%` + count.repeat(11) + `&%&%`
		this.rawCodeSegments.push({ marker, code })
		return ts.createIdentifier(marker)
	}

	finalize(nodes: ts.Node[]) {
		let generatedCode = nodes.map(node => printNode(node)).join('\n')
		// let scanningCode =
		for (const { marker, code } of this.rawCodeSegments) {
			// a future optimization could be to trim through the generatedCode
			// and therefore not require the regex library to scan through all the parts that we know won't have our marker
			// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/indexOf
			generatedCode = generatedCode.replace(marker, code)
		}

		const runtimeImports = [...this.requiredFunctions].map(fnName => {
			return ts.createImportSpecifier(
				ts.createIdentifier(fnName),
				ts.createIdentifier(safePrefix(fnName)),
			)
		})
		const runtimeImportDeclaration = ts.createImportDeclaration(
			undefined, undefined,
			ts.createImportClause(undefined, ts.createNamedImports(runtimeImports)),
			ts.createStringLiteral('project-f/runtime'),
		)

		this.rawCodeSegments.splice(0, this.rawCodeSegments.length)
		this.requiredFunctions.clear()

		return printNode(runtimeImportDeclaration) + '\n\n' + generatedCode
	}
}

const realParentText = safePrefix('real')
const parentText = safePrefix('parent')
const parentIdents = () => t(ts.createIdentifier(realParentText), ts.createIdentifier(parentText))
const parentParams = () => t(createParameter(realParentText), createParameter(parentText))

// as an optimization for the call sites to avoid a bunch of empty object allocations,
// you can pass a reference to the same global empty object for all the groups that haven't provided anything
export function generateComponentRenderFunction(
	propsNames: string[], syncsNames: string[],
	eventsNames: string[], slotNames: string[],
	createFnNames: string[], entities: NonEmpty<Entity>,
) {
	const ctx = new CodegenContext()

	const [realParentIdent, parentIdent] = parentIdents()
	const entityStatements = entities
		// at the component level, we can't know whether we're truly the lone child of a real node
		// so we pass false, and only concrete nodes below us can reset that based on their status
		.flatMap((entity, index) => generateEntity(entity, '' + index, false, ctx, realParentIdent, parentIdent))

	const argsNames = propsNames.concat(eventsNames).concat(eventsNames)
	const createFnInvocation = createFnNames.length === 0 ? [] : [createConst(
		createFnNames,
		createCall('create', [ts.createAsExpression(
			ts.createObjectLiteral(
				argsNames.map(arg => {
					return ts.createShorthandPropertyAssignment(ts.createIdentifier(arg), undefined)
				}),
				false,
			),
			ts.createTypeReferenceNode(ctx.requireRuntime('Args'), [
				ts.createTypeReferenceNode(ts.createIdentifier('Component'), undefined),
			]),
		)]),
	) as ts.Statement]

	const statements = createFnInvocation.concat(entityStatements)
	const params = [realParentText, parentText, propsNames, syncsNames, eventsNames, slotNames].map(n => createParameter(n))
	const componentArrow = createArrowFunction(params, ts.createBlock(statements, true))

	const componentDefinitionSymbol = ts.createIdentifier(safePrefix('Component'))
	const componentDefinition = createConst(
		componentDefinitionSymbol, componentArrow,
		ts.createTypeReferenceNode(
			ctx.requireRuntime('ComponentDefinition'),
			[ts.createTypeReferenceNode(ts.createIdentifier('Component'), undefined)],
		),
	)
	const componentExport = ts.createExportAssignment(undefined, undefined, undefined, componentDefinitionSymbol)

	return ctx.finalize([componentDefinition, componentExport])
}


// export function generateEntities(entities: Entity[], offset: string, isRealLone: boolean) {
// 	const statements = []
// 	for (const entity of entities)
// 		statements.push(generateEntity(entity))

// 	return statements
// }
export function generateEntity(
	entity: Entity, offset: string, isRealLone: boolean,
	ctx: CodegenContext, realParent: ts.Identifier, parent: ts.Identifier,
): ts.Statement[] {
	switch (entity.type) {
	case 'Tag':
		return generateTag(entity, offset, ctx, realParent, parent)

	case 'TextSection':
		return generateText(entity, offset, isRealLone, ctx, realParent, parent)

	// case 'ComponentInclusion':
	// 	return generateComponentInclusion(entity, offset, isRealLone, parent)
	// case 'IfBlock':
	// 	return generateIfBlock(entity, offset, isRealLone, parent)
	// case 'EachBlock':
	// 	return generateEachBlock(entity, offset, isRealLone, parent)
	// case 'MatchBlock':
	// 	return generateMatchBlock(entity, offset, isRealLone, parent)
	// case 'SwitchBlock':
	// 	return generateSwitchBlock(entity, offset, isRealLone, parent)
	// case 'SlotDefinition':
	// 	return generateSlotDefinition(entity, offset, isRealLone, parent)
	// case 'SlotInsertion':
	// 	return generateSlotInsertion(entity, offset, isRealLone, parent)
	// case 'TemplateDefinition':
	// 	return generateTemplateDefinition(entity, offset, isRealLone, parent)
	// case 'TemplateInclusion':
	// 	return generateTemplateInclusion(entity, offset, isRealLone, parent)
	// case 'VariableBinding':
	// 	return generateVariableBinding(entity, offset, isRealLone, parent)
	default:
		throw new Error('unimplemented')
	}
}

export function generateTag(
	{ ident, metas, attributes, entities }: Tag, offset: string,
	ctx: CodegenContext, realParent: ts.Identifier, parent: ts.Identifier,
): ts.Statement[] {
	if (ident === 'input' || ident === 'textarea' || ident === 'select') {
		throw new Error('unimplemented')
	}

	// we only have to assign this thing a name if we interact with it afterwards
	const tagIdent = safePrefixIdent(ident, offset)
	let needTagIdent = false
	const tagCreator = createCall(ctx.requireRuntime('createElement'), [parent, ts.createStringLiteral(ident)])
	const statements = [createConst(tagIdent, tagCreator) as ts.Statement]

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

		if (idMeta !== '') throw new Error("multiple id metas")
		idMeta = value
		idDynamic = isDynamic
	}

	if (idMeta !== '') {
		needTagIdent = true
		const idAssignment = idDynamic
			? createEffectBind(ctx, tagIdent, 'id', ctx.createRawCodeSegment(idMeta))
			: createFieldAssignment(tagIdent, 'id', ts.createStringLiteral(idMeta))
		statements.push(idAssignment)
	}

	const className = classMeta.trim()
	if (className !== '') {
		needTagIdent = true
		const classNameAssignment = classDynamic
			? createEffectBind(ctx, tagIdent, 'className', ctx.createRawCodeSegment('`' + className + '`'))
			: createFieldAssignment(tagIdent, 'className', ts.createStringLiteral(className))
		statements.push(classNameAssignment)
	}

	for (const { name: attribute, value } of attributes) {
		needTagIdent = true
		const [isDynamic, finalValue] =
			value === undefined ? [false, ts.createTrue()]
			: typeof value === 'string' ? [false, ts.createStringLiteral(value)]
			// TODO this might not be a good idea for basic attributes,
			// since we shouldn't necessarily assume this thing is itself reactive
			// what about the situations where this is part of the static render?
			// or a value they merely produced from something else?
			// component props are the only place where it makes some kind of sense
			// to get everything into Immutable form *somehow*
			: value.isBare ? [true, ctx.createRawCodeSegment(`${value.code}()`)]
			: [true, ctx.createRawCodeSegment(value.code)]

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

		if (attribute.startsWith('!'))
			throw new Error("can't sync to this attribute")

		const target = attribute === 'style'
			? ts.createPropertyAccess(tagIdent, 'style')
			: tagIdent

		const attributeAssignment = isDynamic
			? createEffectBind(ctx, target, attribute, finalValue)
			: createFieldAssignment(target, attribute, finalValue)
		statements.push(attributeAssignment)
	}

	// here our calculation of real loneness is true, since this current entity is a concrete tag
	const tagFragment = safePrefixIdent(ident, offset, 'fragment')
	const [childRealLone, childParent, preChildrenStatements, postChildrenStatements] = entities.length <= 1
		? [true, tagIdent, [], []]
		: [
		false, tagFragment,
		[createFragmentConstructor(tagFragment)],
		[ts.createExpressionStatement(createCall(
			ts.createPropertyAccess(tagIdent, 'appendChild'), [tagFragment],
		))],
	]
	Array.prototype.push.apply(statements, preChildrenStatements)
	for (let index = 0; index < entities.length; index++) {
		needTagIdent = true
		const entity = entities[index]

		const childStatements = generateEntity(entity, `${offset}_${index}`, childRealLone, ctx, tagIdent, childParent)
		Array.prototype.push.apply(statements, childStatements)
	}
	Array.prototype.push.apply(statements, postChildrenStatements)

	if (!needTagIdent)
		statements[0] = ts.createExpressionStatement(tagCreator)

	return statements
}

export function generateText(
	{ items }: TextSection, offset: string, isRealLone: boolean,
	ctx: CodegenContext, realParent: ts.Identifier, parent: ts.Identifier,
): ts.Statement[] {
	let isDynamic = false
	let content = ''
	for (const item of items) {
		if (item.isCode) isDynamic = true
		// TODO have to figure out how linebreaks work in all of this
		content += item.isCode
			? '${' + item.content + '}'
			: item.content
	}

	if (isRealLone) return isDynamic
		? [createEffectBind(ctx, realParent, 'textContent', ctx.createRawCodeSegment('`' + content + '`'))]
		: [createFieldAssignment(realParent, 'textContent', ts.createStringLiteral(content))]

	const textIdent = safePrefixIdent('text', offset)
	return isDynamic
		? [
			createConst(
				textIdent,
				createCall(ctx.requireRuntime('createTextNode'), [parent, ts.createStringLiteral('')])
			),
			createEffectBind(ctx, textIdent, 'data', ctx.createRawCodeSegment('`' + content + '`'))
		]
		: [ts.createExpressionStatement(
			createCall(ctx.requireRuntime('createTextNode'), [parent, ts.createStringLiteral(content)]),
		)]
}


// function generateComponentInclusion(
// 	{ name, params, entities }: ComponentInclusion,
// 	offset: string, isRealLone: boolean, parent,
// ) {

// }

// function createIf({ expression, entities, elseBranch }: IfBlock) {
// 	return ts.createIf(
// 		ctx.createRawCodeSegment(expression),
// 		ts.createBlock(generateEntities(entities), true),
// 		elseBranch === undefined ? undefined
// 			: Array.isArray(elseBranch) ? ts.createBlock(generateEntities(elseBranch), true)
// 			: createIf(elseBranch),
// 	)
// }
// function generateIfBlock(
// 	ifBlock: IfBlock,
// 	offset: string, isRealLone: boolean, realParent: ts.Identifier, parent: ts.Identifier,
// ) {
// 	const ifStatement = createIf(ifBlock)

// 	// TODO don't hardcode these as strings
// 	const params = [createParameter('realParent'), createParameter('parent')]
// 	const closure = createArrowFunction(params, ts.createBlock([ifStatement], true))
// 	return isRealLone
// 		? createCall(requireRuntime('contentEffect'), [closure, realParent])
// 		: createCall(requireRuntime('rangeEffect'), [closure, realParent, parent])
// }

// function generateEachBlock(e: EachBlock, offset: string, isRealLone: boolean, parent: ts.Identifier) {

// }
// function generateMatchBlock(e: MatchBlock, offset: string, isRealLone: boolean, parent: ts.Identifier) {

// }
// function generateSwitchBlock(e: SwitchBlock, offset: string, isRealLone: boolean, parent: ts.Identifier) {

// }
// function generateSlotDefinition(e: SlotDefinition, offset: string, isRealLone: boolean, parent: ts.Identifier) {

// }
// function generateSlotInsertion(e: SlotInsertion, offset: string, isRealLone: boolean, parent: ts.Identifier) {

// }
// function generateTemplateDefinition(e: TemplateDefinition, offset: string, isRealLone: boolean, parent: ts.Identifier) {

// }
// function generateTemplateInclusion(e: TemplateInclusion, offset: string, isRealLone: boolean, parent: ts.Identifier) {

// }
// function generateVariableBinding(e: VariableBinding, offset: string, isRealLone: boolean, parent: ts.Identifier) {

// }



function createObjectBindingPattern(names: string[]) {
	return ts.createObjectBindingPattern(names.map(name => {
		return ts.createBindingElement(undefined, undefined, ts.createIdentifier(name), undefined)
	}))
}

function createConst(
	pattern: string | string[] | ts.Identifier,
	expression: ts.Expression,
	type?: ts.TypeReferenceNode,
) {
	return ts.createVariableStatement(
		undefined,
		ts.createVariableDeclarationList([
			ts.createVariableDeclaration(
				Array.isArray(pattern) ? createObjectBindingPattern(pattern) : pattern,
				type,
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

function createParameter(param: string | string[], type?: ts.TypeReferenceNode) {
	return ts.createParameter(
		undefined, undefined, undefined,
		typeof param === 'string'
			? ts.createIdentifier(param)
			: createObjectBindingPattern(param),
		undefined, type, undefined,
	)
}

function createFragmentConstructor(target: ts.Identifier) {
	return createConst(
		target,
		createCall(ts.createPropertyAccess(ts.createIdentifier('document'), 'createDocumentFragment'), []),
	)
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
	ctx: CodegenContext,
	target: string | ts.Expression,
	field: string,
	expression: ts.Expression,
) {
	return ts.createExpressionStatement(
		createCall(ctx.requireRuntime('effect'), [
			createArrowFunction([], ts.createBlock([
				createFieldAssignment(target, field, expression),
			], true)),
		]),
	)
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
// 						ctx.createRawCodeSegment(`f().something
// 								+ 2`),
// 						ts.createTemplateTail(' end'),
// 					),
// 				]),
// 			),
// 		],
// 		ts.NodeFlags.Const,
// 	),
// )


const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, omitTrailingSemicolon: true })
export function printNode(node: ts.Node, filename = '') {
	const resultFile = ts.createSourceFile(filename, '', ts.ScriptTarget.Latest, false, ts.ScriptKind.TS)
	return printer.printNode(ts.EmitHint.Unspecified, node, resultFile)
}
