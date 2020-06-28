import ts = require('typescript')
import { DefaultDict, UniqueDict } from '@ts-std/collections'

import { Dict, tuple as t, NonEmpty, NonLone, PickVariants, exec } from '../utils'
import {
	ComponentDefinition, CTXFN, Entity, Html, Tag, TagAttributes, LivenessType, LiveCode, AssignedLiveCode,
	IdMeta, ClassMeta, AttributeCode, TextSection, TextItem,
	BindingAttribute, BindingValue, ExistentBindingValue, InertBindingValue, EventAttribute, ReceiverAttribute, /*RefAttribute,*/ Attribute,
	SyncedTextInput, SyncedCheckboxInput, SyncedRadioInput, SyncedSelect, SyncModifier, SyncAttribute,
	Directive, ComponentInclusion, IfBlock, /*ForBlock,*/ EachBlock, MatchBlock, SwitchBlock, SwitchCase, SwitchDefault,
	SlotUsage, SlotInsertion, TemplateDefinition, TemplateInclusion,
} from './ast'

function safePrefix(s: string) {
	return `___${s}`
}
function nextOffset(offset: string, index: number) {
	return `${offset}_${index}`
}
function safePrefixIdent(...segments: NonLone<string>) {
	return ts.createIdentifier(safePrefix(segments.join('')))
}

function createReactiveCode(code: string) {
	// return code.trim() + '.r()'
	return code.trim() + '()'
}
function createRawCodeSegment(code: string) {
	return ts.createIdentifier(code.trim())
}
function createReactiveCodeSegment(code: string) {
	return ts.createIdentifier(createReactiveCode(code))
}
function createAnonCall(fnCode: string, args: ts.Expression[]) {
	return createCall(createRawCodeSegment(`(${fnCode.trim()})`), args)
}

function createDynamicBinding({ code, initialModifier }: PickVariants<BindingValue, 'type', 'dynamic'>, ctx: CodegenContext) {
	const codeExpression = createRawCodeSegment(code.code)
	return initialModifier
		? createCall(ctx.requireRuntime('fakeInitial'), [codeExpression])
		: codeExpression
}
// as an optimization for the call sites to avoid a bunch of empty object allocations,
// you can pass a reference to the same global empty object for all the groups that haven't provided anything
function efficientObject(assignments: readonly ts.ObjectLiteralElementLike[], ctx: CodegenContext) {
	return assignments.length !== 0 ? ts.createObjectLiteral(assignments, false) : ctx.requireRuntime('EMPTYOBJECT')
}

export class CodegenContext {
	protected requiredFunctions = new Set<string>()
	constructor(
		readonly slots: Dict<boolean>,
	) {}

	requireRuntime(functionName: string) {
		this.requiredFunctions.add(functionName)
		return ts.createIdentifier(safePrefix(functionName))
	}

	finalize(nodes: ts.Node[]) {
		const generatedCode = printNodesArray(nodes)

		const runtimeImports = [...this.requiredFunctions].map(fnName => ts.createImportSpecifier(
			ts.createIdentifier(fnName),
			ts.createIdentifier(safePrefix(fnName)),
		))
		const runtimeImportDeclaration = ts.createImportDeclaration(
			undefined, undefined,
			ts.createImportClause(undefined, ts.createNamedImports(runtimeImports)),
			ts.createStringLiteral('project-f/runtime'),
		)

		this.requiredFunctions.clear()

		const importCode = runtimeImports.length > 0 ? printNodes(runtimeImportDeclaration) : ''
		return importCode + '\n\n' + generatedCode
	}
}

const realParentText = safePrefix('real')
const parentText = safePrefix('parent')
const resetParentIdents = () => t(ts.createIdentifier(realParentText), ts.createIdentifier(parentText))
const untypedParentParams = () => t(createParameter(realParentText), createParameter(parentText))
const typedParentParams = () => t(
	createParameter(realParentText, ts.createTypeReferenceNode(ts.createIdentifier('Node'), undefined)),
	createParameter(parentText, ts.createTypeReferenceNode(ts.createIdentifier('Node'), undefined)),
)

export function generateComponentDefinition({
	props, syncs, events,
	slots, createFn, entities,
}: ComponentDefinition) {
	const ctx = new CodegenContext(slots)
	const [realParentIdent, parentIdent] = resetParentIdents()

	// at the component level, we can't know whether we're truly the lone child of a real node
	// so we pass false, and only concrete nodes below us can reset that based on their status
	const entitiesStatements = generateEntities(entities, '', false, ctx, realParentIdent, parentIdent)

	const createFnStatements = createFn === undefined ? [] : exec(() => {
		const args = props.concat(syncs).concat(events)
		const [createFnTarget, createFnCall] = createFn === CTXFN ? ['ctx', 'createCtx'] : [createFn, 'create']
		return [createConst(
			createFnTarget,
			createCall(createFnCall, [ts.createAsExpression(
				ts.createObjectLiteral(
					args.map(arg => {
						return ts.createShorthandPropertyAssignment(ts.createIdentifier(arg), undefined)
					}),
					false,
				),
				ts.createTypeReferenceNode(ctx.requireRuntime('Args'), [
					ts.createTypeReferenceNode(ts.createIdentifier('Component'), undefined),
				]),
			)]),
		) as ts.Statement]
	})

	const statements = createFnStatements.concat(entitiesStatements)
	const slotNames = Object.keys(slots)
	const params = [realParentText, parentText, props, syncs, events, slotNames].map(n => createParameter(n))
	const componentArrow = createArrowFunction(params, ts.createBlock(statements, true))

	const componentDefinitionSymbol = ts.createIdentifier(safePrefix('Component'))
	const componentDefinition = createConst(
		componentDefinitionSymbol, componentArrow,
		ts.createTypeReferenceNode(
			ctx.requireRuntime('ComponentDefinition'),
			// TODO if slots were backfilled, this is where we'd discover so
			[ts.createTypeReferenceNode(ts.createIdentifier('Component'), undefined)],
		),
	)
	const componentExport = ts.createExportAssignment(undefined, undefined, undefined, componentDefinitionSymbol)

	return ctx.finalize([componentDefinition, componentExport])
}


export function generateEntities(
	entities: Entity[], offset: string, isRealLone: boolean,
	ctx: CodegenContext, realParent: ts.Identifier, parent: ts.Identifier,
) {
	const statements = [] as ts.Statement[]
	const entitiesRealLone = isRealLone && entities.length <= 1
	for (let index = 0; index < entities.length; index++) {
		const entity = entities[index]
		const entityStatements = generateEntity(entity, nextOffset(offset, index), entitiesRealLone, ctx, realParent, parent)
		Array.prototype.push.apply(statements, entityStatements)
	}

	return statements
}

export function generateEntity(
	entity: Entity, offset: string, isRealLone: boolean,
	ctx: CodegenContext, realParent: ts.Identifier, parent: ts.Identifier,
): ts.Statement[] {
	switch (entity.type) {
	case 'Tag':
		return generateTag(entity, offset, ctx, realParent, parent)

	case 'SyncedTextInput':
		return generateSyncedTextInput(entity, offset, ctx, realParent, parent)
	case 'SyncedCheckboxInput':
		return generateSyncedCheckboxInput(entity, offset, ctx, realParent, parent)
	case 'SyncedRadioInput':
		return generateSyncedRadioInput(entity, offset, ctx, realParent, parent)
	case 'SyncedSelect':
		return generateSyncedSelect(entity, offset, ctx, realParent, parent)

	case 'TextSection':
		return generateText(entity, offset, isRealLone, ctx, realParent, parent)

	case 'SlotUsage':
		return generateSlotUsage(entity, ctx, realParent, parent)

	case 'ComponentInclusion':
		return generateComponentInclusion(entity, ctx, realParent, parent)

	case 'IfBlock':
		return generateIfBlock(entity, offset, isRealLone, ctx, realParent, parent)
	case 'EachBlock':
		return generateEachBlock(entity, offset, isRealLone, ctx, realParent, parent)
	case 'MatchBlock':
		return generateMatchBlock(entity, offset, isRealLone, ctx, realParent, parent)
	case 'SwitchBlock':
		return generateSwitchBlock(entity, offset, isRealLone, ctx, realParent, parent)

	case 'TemplateDefinition':
		return generateTemplateDefinition(entity, ctx)
	case 'TemplateInclusion':
		return generateTemplateInclusion(entity, realParent, parent)

	// case 'VariableBinding':
	// 	throw new Error('unimplemented')
		// return generateVariableBinding(entity, offset, isRealLone, parent)
	}
}


export function generateTagFromAttributes(
	ident: string, { idMeta, classMetas, bindings, events, receivers }: TagAttributes, entities: Entity[],
	offset: string, ctx: CodegenContext, realParent: ts.Identifier, parent: ts.Identifier,
): [ts.Identifier, boolean, ts.VariableStatement, ts.Statement[]] {
	// we only have to assign this thing a name if we interact with it afterwards
	const tagIdent = safePrefixIdent(ident, offset)
	const identLiteral = ts.createStringLiteral(ident)

	let needTagIdent = false
	let classLiveness: LivenessType | undefined = undefined
	for (const { liveness, value } of classMetas)
		classLiveness = LivenessType.max(classLiveness || LivenessType.static, liveness)

	function literalOrCode({ liveness, value }: ClassMeta) {
		return liveness === LivenessType.static
			? ts.createStringLiteral(value)
			: createRawCodeSegment(value)
	}

	const tagCreator =
		classLiveness === undefined ? createCall(ctx.requireRuntime('createElement'), [parent, identLiteral])
		: classLiveness === LivenessType.static
			? createCall(ctx.requireRuntime('createElementClass'), [
				parent, identLiteral, ts.createStringLiteral(classMetas.map(m => m.value).join(' ')),
			])
		: classLiveness === LivenessType.dynamic
			? createCall(ctx.requireRuntime('createElementClasses'), [parent, identLiteral, ...classMetas.map(literalOrCode)])
		: createCall(ctx.requireRuntime('createElementReactiveClasses'), [parent, identLiteral, ...classMetas.map(literalOrCode)])

	const statements = [ts.createExpressionStatement(tagCreator) as ts.Statement]

	if (idMeta) {
		needTagIdent = true
		const idAssignment = idMeta.liveness === LivenessType.reactive
			? createBind(ctx, tagIdent, 'id', createRawCodeSegment(idMeta.value))
			: createFieldAssignment(tagIdent, 'id', ts.createStringLiteral(idMeta.value))
		statements.push(idAssignment)
	}

	const bindingsValues = Object.values(bindings)
	const eventsEntries = Object.entries(events)
	needTagIdent = needTagIdent || bindingsValues.length > 0 || eventsEntries.length > 0 || receivers.length > 0

	for (const { attribute, value } of bindingsValues) switch (value.type) {
		case 'empty':
			statements.push(createFieldAssignment(tagIdent, attribute, ts.createTrue()))
			break
		case 'static':
			statements.push(createFieldAssignment(tagIdent, attribute, ts.createStringLiteral(value.value)))
			break
		case 'dynamic':
			const dynamicBinding = createDynamicBinding(value, ctx)
			statements.push(createFieldAssignment(tagIdent, attribute, dynamicBinding))
			break
		case 'reactive':
			const reactiveCode = createReactiveCodeSegment(value.reactiveCode.code)
			statements.push(createBind(ctx, tagIdent, attribute, reactiveCode))
			break
	}

	for (const [event, handlers] of eventsEntries) {
		// TODO lots to think about here, since we aren't properly handling basically any modifiers
		const handler = generateHandler(handlers, false)
		statements.push(createFieldAssignment(tagIdent, `on${event}`, handler))
	}

	for (const { code } of receivers) {
		const statement = createAnonCall(code.code, [tagIdent])
		statements.push(ts.createExpressionStatement(statement))
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

	needTagIdent = needTagIdent || entities.length > 0

	Array.prototype.push.apply(statements, preChildrenStatements)
	const childStatements = generateEntities(entities, offset, childRealLone, ctx, tagIdent, childParent)
	Array.prototype.push.apply(statements, childStatements)
	Array.prototype.push.apply(statements, postChildrenStatements)

	const assigner = createConst(tagIdent, tagCreator)
	if (needTagIdent)
		statements[0] = assigner

	return [tagIdent, needTagIdent, assigner, statements]
}

function generateHandler(handlers: NonEmpty<EventAttribute>, isComponent: boolean): ts.Expression {
	if (handlers.length === 1)
		return createRawCodeSegment(handlers[0].code)

	const param = isComponent ? '...$args' : '$event'
	return createArrowFunction([createParameter(param)], ts.createBlock(
		handlers.map(({ code }) => {
			return ts.createExpressionStatement(createAnonCall(code, [ts.createIdentifier(param)]))
		}),
	))
}

export function generateTag(
	{ ident, attributes, entities }: Tag, offset: string,
	ctx: CodegenContext, realParent: ts.Identifier, parent: ts.Identifier,
) {
	const [, , , tagStatements] = generateTagFromAttributes(ident, attributes, entities, offset, ctx, realParent, parent)
	return tagStatements
}

export function generateSyncedTextInput(
	{ isTextarea, mutable: { code }, attributes }: SyncedTextInput, offset: string,
	ctx: CodegenContext, realParent: ts.Identifier, parent: ts.Identifier,
) {
	const ident = isTextarea ? 'textarea' : 'input'
	return generateSyncedSomething(ident, 'syncTextElement', code, attributes, [], offset, ctx, realParent, parent)
}
export function generateSyncedCheckboxInput(
	{ mutable: { code }, attributes }: SyncedCheckboxInput, offset: string,
	ctx: CodegenContext, realParent: ts.Identifier, parent: ts.Identifier,
) {
	return generateSyncedSomething('input', 'syncCheckboxElement', code, attributes, [], offset, ctx, realParent, parent)
}
export function generateSyncedRadioInput(
	{ mutable: { code }, attributes }: SyncedRadioInput, offset: string,
	ctx: CodegenContext, realParent: ts.Identifier, parent: ts.Identifier,
) {
	return generateSyncedSomething('input', 'syncRadioElement', code, attributes, [], offset, ctx, realParent, parent)
}
export function generateSyncedSelect(
	{ mutable: { code }, isMultiple, attributes, entities }: SyncedSelect, offset: string,
	ctx: CodegenContext, realParent: ts.Identifier, parent: ts.Identifier,
) {
	const runtimeFn = isMultiple ? 'syncSelectElement' : 'syncSelectMultipleElement'
	return generateSyncedSomething('select', runtimeFn, code, attributes, entities, offset, ctx, realParent, parent)
}

function generateSyncedSomething(
	ident: string, runtimeFn: string, code: string, attributes: TagAttributes, entities: Entity[], offset: string,
	ctx: CodegenContext, realParent: ts.Identifier, parent: ts.Identifier,
) {
	const [tagIdent, , assigner, statements] = generateTagFromAttributes(ident, attributes, entities, offset, ctx, realParent, parent)
	statements[0] = assigner
	const syncStatement = createCall(runtimeFn, [tagIdent, createRawCodeSegment(code)])
	statements.push(ts.createExpressionStatement(syncStatement))
	return statements
}


export function generateText(
	{ items }: TextSection, offset: string, isRealLone: boolean,
	ctx: CodegenContext, realParent: ts.Identifier, parent: ts.Identifier,
): ts.Statement[] {
	let totalContent = ''
	let overallLiveness: LivenessType = LivenessType.static

	const [wrapCode, wrapItem]: [(s: string) => string, (s: string) => string] = items.length > 1
		? [s => '`' + s + '`', s => '${' + s + '}']
		: [s => s, s => s]

	for (const { liveness, content } of items) {
		const finalContent = liveness === LivenessType.static ? content
			: liveness === LivenessType.dynamic ? wrapItem(content)
			: /*liveness === LivenessType.reactive*/ wrapItem(createReactiveCode(content))
		// in the wolf grammar, we have information about line breaks in text sections
		// this means that we can add empty whitespace text sections at the parser level rather than here
		overallLiveness = LivenessType.max(overallLiveness, liveness)
		totalContent += finalContent
	}

	if (isRealLone) switch (overallLiveness) {
		case LivenessType.reactive:
			return [createBind(ctx, realParent, 'textContent', createRawCodeSegment(wrapCode(totalContent)))]
		case LivenessType.dynamic:
			return [createFieldAssignment(realParent, 'textContent', createRawCodeSegment(wrapCode(totalContent)))]
		case LivenessType.static:
			return [createFieldAssignment(realParent, 'textContent', ts.createStringLiteral(totalContent))]
	}

	switch (overallLiveness) {
	case LivenessType.reactive:
		const textIdent = safePrefixIdent('text', offset)
		return [
			createConst(
				textIdent,
				createCall(ctx.requireRuntime('createTextNode'), [parent, ts.createStringLiteral('')])
			),
			createBind(ctx, textIdent, 'data', createRawCodeSegment(wrapCode(totalContent))),
		]
	case LivenessType.dynamic:
		return [ts.createExpressionStatement(
			createCall(ctx.requireRuntime('createTextNode'), [parent, createRawCodeSegment(wrapCode(totalContent))])
		)]
	case LivenessType.static:
		return [ts.createExpressionStatement(
			createCall(ctx.requireRuntime('createTextNode'), [parent, ts.createStringLiteral(totalContent)]),
		)]
	}
}


export function generateSlotUsage(
	{ name: slotName = 'def', argsExpression, fallback }: SlotUsage,
	ctx: CodegenContext, realParent: ts.Identifier, parent: ts.Identifier,
) {
	// we've already checked for existence and redundance in the parsing stages
	const slotOptional = ctx.slots[slotName] || false
	const usageTarget = !slotOptional ? slotName : ts.createParen(ts.createBinary(
		ts.createIdentifier(slotName),
		ts.createToken(ts.SyntaxKind.BarBarToken),
		fallback === undefined
			// no fallback: default to noop, thereby outputing nothing
			? ctx.requireRuntime('noop')
			// has fallback: default to their fallback, which takes no arguments because it captures its environment
			: ts.createParen(createArrowFunction(
				...generateGenericInsertableDefinition(ctx, undefined, fallback, false),
			)),
	))

	return [generateGenericInsertableCall(usageTarget, argsExpression, realParent, parent)]
}

export function generateComponentInclusion(
	{ name, props, syncs, /*nativeEvents,*/ events, slotInsertions }: ComponentInclusion,
	ctx: CodegenContext, realParent: ts.Identifier, parent: ts.Identifier,
) {
	const propsArgs = Object.values(props).map(({ attribute, value }) => {
		switch (value.type) {
			case 'empty':
				const fakeSwitch = createCall(ctx.requireRuntime('fakeImmutable'), [ts.createTrue()])
				return ts.createPropertyAssignment(attribute, fakeSwitch)
			case 'static':
				const fakeString = createCall(ctx.requireRuntime('fakeImmutable'), [ts.createStringLiteral(value.value)])
				return ts.createPropertyAssignment(attribute, fakeString)
			case 'dynamic':
				const dynamicBinding = createDynamicBinding(value, ctx)
				return ts.createPropertyAssignment(attribute, dynamicBinding)
			case 'reactive':
				return ts.createPropertyAssignment(attribute, createRawCodeSegment(value.reactiveCode.code))
		}
	})

	const syncsArgs = Object.values(syncs).map(({ attribute, modifier, code: { code } }) => {
		switch (modifier) {
			case undefined:
				return ts.createPropertyAssignment(attribute, createRawCodeSegment(code))
			case SyncModifier.fake: {
				const sync = createCall(ctx.requireRuntime('fakeMutable'), [createRawCodeSegment(code)])
				return ts.createPropertyAssignment(attribute, sync)
			}
			case SyncModifier.setter:
				const sync = createCall(ctx.requireRuntime('fakeSetter'), [createRawCodeSegment(code)])
				return ts.createPropertyAssignment(attribute, sync)
		}
	})

	// TODO at some point we should allow proxying native events with a native modifier
	// we'll generate code to receive the single return node of the component
	// and fold its existing handler in with a runtime function
	// however, that code will only be valid on components that have a single root,
	// and that therefore actually do return a node
	const eventsArgs = Object.entries(events).map(([event, handlers]) => {
		const handler = generateHandler(handlers, true)
		return ts.createPropertyAssignment(event, handler)
	})

	const slotsArgs = Object.entries(slotInsertions).map(([slotName, { paramsExpression, entities }]) => {
		const [params, block] = generateGenericInsertableDefinition(ctx, paramsExpression, entities, false)
		return ts.createPropertyAssignment(slotName, createArrowFunction(params, block))
	})

	return [ts.createExpressionStatement(createCall(name, [
		realParent, parent, efficientObject(propsArgs, ctx), efficientObject(syncsArgs, ctx),
		efficientObject(eventsArgs, ctx), efficientObject(slotsArgs, ctx),
	]))]
}


function generateAreaEffect(
	statements: ts.Statement[], isRealLone: boolean, ctx: CodegenContext,
	aboveRealParent: ts.Identifier, aboveParent: ts.Identifier,
) {
	const closure = createArrowFunction(untypedParentParams(), ts.createBlock(statements, true))
	// TODO it seems the only way we can safely use `isRealLone` to optimize anything
	// is by simply using `contentEffect` ourselves if our parent has given the all clear
	// all the sub entities might be able to piggyback from that?
	return [ts.createExpressionStatement(
		isRealLone
			? createCall(ctx.requireRuntime('contentEffect'), [closure, aboveRealParent])
			: createCall(ctx.requireRuntime('rangeEffect'), [closure, aboveRealParent, aboveParent])
	)]
}


function generateLiveCode({ reactive, code }: LiveCode) {
	return reactive ? createReactiveCodeSegment(code) : createRawCodeSegment(code)
}

function createIf(
	expression: LiveCode, entities: Entity[], elseBranch: ts.Statement | undefined,
	offset: string, isRealLone: boolean, ctx: CodegenContext,
	realParent: ts.Identifier, parent: ts.Identifier,
) {
	return ts.createIf(
		generateLiveCode(expression),
		ts.createBlock(generateEntities(entities, offset, isRealLone, ctx, realParent, parent), true),
		elseBranch,
	)
}
export function generateIfBlock(
	{ expression, entities, elseIfBranches, elseBranch }: IfBlock,
	parentOffset: string, isRealLone: boolean, ctx: CodegenContext,
	aboveRealParent: ts.Identifier, aboveParent: ts.Identifier,
): ts.Statement[] {
	const reactive = expression.reactive || elseIfBranches.some(([b, ]) => b.reactive)
	const [offset, [realParent, parent]] = reactive
		? ['', resetParentIdents()]
		: [parentOffset, [aboveRealParent, aboveParent]]

	// we start with the else block and work our way backwards
	// this way we avoid needing any pesky recursion to build up the recursive ts.IfStatement
	let currentElse: ts.Statement | undefined = elseBranch === undefined
		? undefined
		// TODO if an IfBlock is truly lone, could we determine that its children are as well?
		// it seems that only if each section is also lone could we use anything useful
		// otherwise the best we could do is just use contentEffect
		: ts.createBlock(generateEntities(elseBranch, offset, false, ctx, realParent, parent), true)

	for (let index = elseIfBranches.length - 1; index >= 0; index--) {
		const [expression, entities] = elseIfBranches[index]
		currentElse = createIf(expression, entities, currentElse, offset, false, ctx, realParent, parent)
	}

	const statements = [createIf(expression, entities, currentElse, offset, false, ctx, realParent, parent)]
	return !reactive
		? statements
		: generateAreaEffect(statements, isRealLone, ctx, aboveRealParent, aboveParent)
}


export function generateEachBlock(
	{ params: { variableCode, indexCode }, listExpression, entities }: EachBlock,
	parentOffset: string, isRealLone: boolean, ctx: CodegenContext,
	aboveRealParent: ts.Identifier, aboveParent: ts.Identifier,
): ts.Statement[] {
	const reactive = listExpression.reactive
	const [offset, [realParent, parent]] = reactive
		? ['', resetParentIdents()]
		: [parentOffset, [aboveRealParent, aboveParent]]

	const variableIdent = createRawCodeSegment(variableCode)
	const indexIdent = indexCode !== undefined
		? ts.createIdentifier(indexCode)
		: safePrefixIdent('eachBlockIndex', offset)

	const collectionIdent = safePrefixIdent('eachBlockCollection', offset)
	const lengthIdent = safePrefixIdent('eachBlockCollectionLength', offset)
	const statements = [
		createConst(collectionIdent, generateLiveCode(listExpression)),
		createConst(lengthIdent, ts.createPropertyAccess(collectionIdent, 'length')),
		ts.createFor(
			ts.createVariableDeclarationList(
				[ts.createVariableDeclaration(indexIdent, undefined, ts.createNumericLiteral('0'))],
				ts.NodeFlags.Let,
			),
			ts.createBinary(indexIdent, ts.createToken(ts.SyntaxKind.FirstBinaryOperator), lengthIdent),
			ts.createPostfix(indexIdent, ts.SyntaxKind.PlusPlusToken),
			ts.createBlock(
				[createConst(variableIdent, ts.createElementAccess(collectionIdent, indexIdent)) as ts.Statement]
					// all the children of an each loop are by definition not robustly safe to call lone
					.concat(generateEntities(entities, offset, false, ctx, realParent, parent)),
				true,
			),
		),
	]

	return !reactive
		? statements
		: generateAreaEffect(statements, isRealLone, ctx, aboveRealParent, aboveParent)
}


function createBreakBlock(...args: Parameters<typeof generateEntities>) {
	const statements = generateEntities(...args)
	statements.push(ts.createBreak(undefined))
	return ts.createBlock(statements, true)
}

function generateAssignableLiveCode(expression: LiveCode | AssignedLiveCode) {
	switch (expression.type) {
	case 'LiveCode':
		return t([] as ts.Statement[], generateLiveCode(expression), expression.reactive)
	case 'AssignedLiveCode':
		const ident = ts.createIdentifier(expression.assignedName)
		const statements = [createConst(ident, createReactiveCodeSegment(expression.reactiveCode))]
		return t(statements, ident, true)
	}
}

export function generateMatchBlock(
	{ matchExpression, patterns, defaultPattern }: MatchBlock,
	parentOffset: string, isRealLone: boolean, ctx: CodegenContext,
	aboveRealParent: ts.Identifier, aboveParent: ts.Identifier,
): ts.Statement[] {
	const [statements, codeMatchExpression, reactive] = generateAssignableLiveCode(matchExpression)
	const [offset, [realParent, parent]] = reactive
		? ['', resetParentIdents()]
		: [parentOffset, [aboveRealParent, aboveParent]]

	const blocks = patterns.map(([expression, entities], index) => {
		const block = createBreakBlock(entities, nextOffset(offset, index), false, ctx, realParent, parent)
		return ts.createCaseClause(generateLiveCode(expression), [block]) as ts.CaseOrDefaultClause
	})
	const defaultBlock = ts.createDefaultClause([
		defaultPattern === undefined
			? ts.createExpressionStatement(
				createCall(ctx.requireRuntime('exhaustive'), [codeMatchExpression]),
			)
			: createBreakBlock(defaultPattern, nextOffset(offset, patterns.length), false, ctx, realParent, parent)
	])
	blocks.push(defaultBlock)

	statements.push(ts.createSwitch(codeMatchExpression, ts.createCaseBlock(blocks)))
	return !reactive
		? statements
		: generateAreaEffect(statements, isRealLone, ctx, aboveRealParent, aboveParent)
}


export function generateSwitchBlock(
	{ switchExpression, cases }: SwitchBlock,
	parentOffset: string, isRealLone: boolean, ctx: CodegenContext,
	aboveRealParent: ts.Identifier, aboveParent: ts.Identifier,
) {
	const [statements, codeSwitchExpression, reactive] = generateAssignableLiveCode(switchExpression)
	const [offset, [realParent, parent]] = reactive
		? ['', resetParentIdents()]
		: [parentOffset, [aboveRealParent, aboveParent]]

	const blocks: ts.CaseOrDefaultClause[] = []
	let seenDefault = false
	for (const [index, switchCase] of cases.entries()) {
		const { isFallthrough, entities } = switchCase

		const entitiesStatements = generateEntities(entities, nextOffset(offset, index), false, ctx, realParent, parent)
		if (!isFallthrough)
			entitiesStatements.push(ts.createBreak(undefined))
		const block = ts.createBlock(entitiesStatements, true)

		const [isDefault, clause] = switchCase.isDefault
			? [true, ts.createDefaultClause([block])]
			: [false, ts.createCaseClause(generateLiveCode(switchCase.expression), [block])]
		seenDefault = seenDefault || isDefault

		blocks.push(clause)
	}

	if (!seenDefault)
		blocks.push(ts.createDefaultClause([
			ts.createExpressionStatement(
				createCall(ctx.requireRuntime('exhaustive'), [codeSwitchExpression]),
			),
		]))

	statements.push(ts.createSwitch(codeSwitchExpression, ts.createCaseBlock(blocks)))
	return !reactive
		? statements
		: generateAreaEffect(statements, isRealLone, ctx, aboveRealParent, aboveParent)
}


export function generateTemplateDefinition(
	{ name, paramsExpression, entities }: TemplateDefinition,
	ctx: CodegenContext,
): ts.Statement[] {
	const [params, block] = generateGenericInsertableDefinition(ctx, paramsExpression, entities, true)
	return [ts.createFunctionDeclaration(
		undefined, undefined, undefined, ts.createIdentifier(name),
		undefined, params, undefined, block,
	)]
}

function generateGenericInsertableDefinition(
	ctx: CodegenContext,
	paramsExpression: string | undefined,
	entities: Entity[],
	typed: boolean,
) {
	const remainingParams = paramsExpression !== undefined
		? [createParameter(createRawCodeSegment(paramsExpression))]
		: []
	const [realParentIdent, parentIdent] = resetParentIdents()
	const baseParams = typed ? typedParentParams() : untypedParentParams()
	const params = baseParams.concat(remainingParams)
	// this is similar to a component definition, since we can't know how this template will be used
	// we have to begin with the assumption that this can be used in non-lone contexts
	const block = ts.createBlock(generateEntities(entities, '', false, ctx, realParentIdent, parentIdent), true)
	return t(params, block)
}

export function generateTemplateInclusion(
	{ name, argsExpression }: TemplateInclusion,
	realParent: ts.Identifier, parent: ts.Identifier,
): ts.Statement[] {
	return [generateGenericInsertableCall(name, argsExpression, realParent, parent)]
}

function generateGenericInsertableCall(
	insertableName: string | ts.Expression, argsExpression: string | undefined,
	realParent: ts.Identifier, parent: ts.Identifier,
) {
	const givenArgs = argsExpression !== undefined
		? [createRawCodeSegment(argsExpression)]
		: []
	return ts.createExpressionStatement(createCall(insertableName, [realParent, parent].concat(givenArgs)))
}

// function generateVariableBinding(e: VariableBinding, offset: string, isRealLone: boolean, ctx: CodegenContext, parent: ts.Identifier) {

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
		typeof target === 'string' ? ts.createIdentifier(target) : target,
		undefined, args,
	)
}

function createArrowFunction(parameters: ts.ParameterDeclaration[], body: ts.ConciseBody) {
	return ts.createArrowFunction(
		undefined, undefined, parameters, undefined,
		ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken), body,
	)
}

function createParameter(param: string | string[] | ts.Identifier, type?: ts.TypeReferenceNode) {
	return ts.createParameter(
		undefined, undefined, undefined,
		typeof param === 'string' ? ts.createIdentifier(param)
			: Array.isArray(param) ? createObjectBindingPattern(param)
			: param,
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
	target: ts.Expression,
	field: string,
	expression: ts.Expression,
) {
	return ts.createExpressionStatement(
		ts.createBinary(
			ts.createPropertyAccess(target, field),
			ts.createToken(ts.SyntaxKind.FirstAssignment),
			expression,
		),
	)
}

function createBind(
	ctx: CodegenContext, target: ts.Expression,
	field: string, expression: ts.Expression,
) {
	return ts.createExpressionStatement(
		createCall(ctx.requireRuntime('bindProperty'), [target, ts.createStringLiteral(field), expression])
	)
}


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
