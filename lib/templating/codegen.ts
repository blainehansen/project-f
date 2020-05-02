import ts = require('typescript')
import '@ts-std/extensions/dist/array'

import { Dict, tuple as t, NonEmpty, NonLone } from '../utils'
import {
	Entity, AttributeValue, Directive,
	ComponentDefinition, Tag, Meta, Attribute, /*AttributeCode,*/ TextSection, TextItem,
	ComponentInclusion, IfBlock, EachBlock, MatchBlock, MatchPattern, SwitchBlock, SwitchCase, SwitchDefault,
	SlotDefinition, SlotInsertion, TemplateDefinition, TemplateInclusion,
} from './ast'

function safePrefix(s: string) {
	return `___${s}`
}
function safePrefixIdent(...segments: NonLone<string>) {
	return ts.createIdentifier(safePrefix(segments.join('')))
}

function createRawCodeSegment(code: string) {
	return ts.createIdentifier(code)
}

export class CodegenContext {
	protected rawCodeSegments = [] as { marker: string, code: string }[]
	protected requiredFunctions = new Set<string>()

	requireRuntime(functionName: string) {
		this.requiredFunctions.add(functionName)
		return ts.createIdentifier(safePrefix(functionName))
	}

	// // TODO it might be unnecessary to do this!
	// // ts.createIdentifier seems like it will gladly just pass along the string directly into the source!
	// createRawCodeSegment(code: string): ts.Identifier {
	// 	const count = '' + this.rawCodeSegments.length
	// 	const marker = `&%&%` + count.repeat(11) + `&%&%`
	// 	this.rawCodeSegments.push({ marker, code })
	// 	return ts.createIdentifier(marker)
	// }

	finalize(nodes: ts.Node[]) {
		let generatedCode = printNodesArray(nodes)
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

		return printNodes(runtimeImportDeclaration) + '\n\n' + generatedCode
	}
}

const realParentText = safePrefix('real')
const parentText = safePrefix('parent')
export const parentIdents = () => t(ts.createIdentifier(realParentText), ts.createIdentifier(parentText))
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

const enum AttributeType { empty, static, dynamic, reactive, sync, event, fn }
const reactiveModifiers = ['fake'] as const
const syncModifiers = ['fake', 'setter'] as const
const eventModifiers = ['handler', 'exact', 'stop', 'prevent', 'capture', 'self', 'once', 'passive'] as const
// const metaModifiers = ['ctrl', 'alt', 'shift', 'meta']
// https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
// const keyModifiers = [] as const
// const mouseModifiers = ['left', 'right', 'middle'] as const
export function processAttribute(
	ctx: CodegenContext,
	rawAttribute: string,
	value: AttributeValue | undefined,
) {
	if (rawAttribute === '&fn')
		throw new Error('unimplemented')

	// TODO remember that if an attribute contains dashes it's a dom attribute instead of property, and should be set differently

	const firstLetter = rawAttribute[0] || ''
	if (firstLetter === '') throw new Error("empty attribute name shouldn't be possible!")

	const [attribute, ...modifiersList] = rawAttribute.split('|')
	const sliced = attribute.slice(1)
	const modifiers = modifiersList.unique_index_map(m => [m, true as const])
		.change_err(e => `duplicate modifier ${e[0]}`)
		.unwrap()

	function check(
		value: AttributeValue, variety: string,
		varietyModifiers: readonly string[],
	): asserts value is { code: string } {
		if (value === undefined || typeof value === 'string')
			throw new Error(`static attribute values are invalid for ${variety}s`)
		for (const modifier of modifiersList)
			if (!varietyModifiers.includes(modifier))
				throw new Error(`invalid modifier for ${variety}: ${modifier}`)
	}

	switch (firstLetter) {
		case ':':
			check(value, 'reactive binding', reactiveModifiers)
			return t(AttributeType.reactive, sliced, modifiers, value.code)

		case '!':
			check(value, 'sync', syncModifiers)
			return t(AttributeType.sync, sliced, modifiers, value.code)

		case '@':
			check(value, 'event', eventModifiers)
			const code = modifiers.handler ? value.code : `$event => ${value.code}`
			delete modifiers.handler
			return t(AttributeType.event, sliced, modifiers, code)
	}

	if (modifiersList.length !== 0)
		throw new Error("modifiers don't make any sense on normal bindings")

	if (value === undefined)
		return t(AttributeType.empty, attribute, {}, '')
	if (typeof value === 'string')
		return t(AttributeType.static, attribute, {}, value)
	return t(AttributeType.dynamic, attribute, {}, value.code)
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
			? createEffectBind(ctx, tagIdent, 'id', createRawCodeSegment(idMeta))
			: createFieldAssignment(tagIdent, 'id', ts.createStringLiteral(idMeta))
		statements.push(idAssignment)
	}

	const className = classMeta.trim()
	if (className !== '') {
		needTagIdent = true
		const classNameAssignment = classDynamic
			? createEffectBind(ctx, tagIdent, 'className', createRawCodeSegment('`' + className + '`'))
			: createFieldAssignment(tagIdent, 'className', ts.createStringLiteral(className))
		statements.push(classNameAssignment)
	}

	for (const { name, value } of attributes) {
		needTagIdent = true

		const [attributeType, attribute, modifiers, valueString] = processAttribute(ctx, name, value)

		// TODO in the future I might get rid of the dynamic metas
		// in this situation we'd just do the same thing the metas loop is doing above
		// and then continue out of this loop iteration
		// if (attribute === 'id') if not dynamic throw new Error("don't use the `id` attribute, use `#id-name` syntax instead")
		// if (attribute === 'class') if not dynamic throw new Error("don't use the `class` attribute, use `.class-name` syntax instead")

		switch (attributeType) {
			case AttributeType.empty:
				statements.push(createFieldAssignment(tagIdent, attribute, ts.createTrue()))
				break
			case AttributeType.static:
				statements.push(createFieldAssignment(tagIdent, attribute, ts.createStringLiteral(valueString)))
				break
			case AttributeType.dynamic:
				statements.push(createFieldAssignment(tagIdent, attribute, createRawCodeSegment(valueString)))
				break
			case AttributeType.reactive:
				if (modifiers.fake) throw new Error("the fake modifier doesn't make any sense on a tag")
				statements.push(createEffectBind(ctx, tagIdent, attribute, createRawCodeSegment(`${valueString}()`)))
				break
			case AttributeType.sync:
				throw new Error(`syncs on primitive tags are only allowed on input, textarea, and select, with !sync`)
			case AttributeType.event:
				// TODO lots to think about here, since we aren't properly handling basically any modifiers
				statements.push(createFieldAssignment(tagIdent, `on${attribute}`, createRawCodeSegment(valueString)))
				break
			case AttributeType.fn:
				const statement = createCall(ctx.requireRuntime('nodeReceiver'), [tagIdent, createRawCodeSegment(valueString)])
				statements.push(ts.createExpressionStatement(statement))
				break
		}
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
		? [createEffectBind(ctx, realParent, 'textContent', createRawCodeSegment('`' + content + '`'))]
		: [createFieldAssignment(realParent, 'textContent', ts.createStringLiteral(content))]

	const textIdent = safePrefixIdent('text', offset)
	return isDynamic
		? [
			createConst(
				textIdent,
				createCall(ctx.requireRuntime('createTextNode'), [parent, ts.createStringLiteral('')])
			),
			createEffectBind(ctx, textIdent, 'data', createRawCodeSegment('`' + content + '`'))
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
// 		createRawCodeSegment(expression),
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


export function printNodes(...nodes: NonEmpty<ts.Node>) {
	return _printNodes(nodes, '')
}
export function printNodesArray(nodes: ts.Node[], filename = '') {
	return _printNodes(nodes, '')
}
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, omitTrailingSemicolon: true })
function _printNodes(nodes: ts.Node[], filename: string) {
	const resultFile = ts.createSourceFile(filename, '', ts.ScriptTarget.Latest, false, ts.ScriptKind.TS)
	let printed = ''
	for (const node of nodes)
		printed += '\n' + printer.printNode(ts.EmitHint.Unspecified, node, resultFile)

	return printed
}
