import ts = require('typescript')
import '@ts-std/extensions/dist/array'
import { DefaultDict, UniqueDict } from '@ts-std/collections'

import { Dict, tuple as t, NonEmpty, NonLone } from '../utils'
import {
	Entity, Directive,
	ComponentDefinition, Tag, Meta, Attribute, AttributeCode, TextSection, TextItem,
	ComponentInclusion, IfBlock, EachBlock, MatchBlock, SwitchBlock, SwitchCase, SwitchDefault,
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

function createRawCodeSegment(code: string) {
	return ts.createIdentifier(code)
}

export class CodegenContext {
	protected requiredFunctions = new Set<string>()

	requireRuntime(functionName: string) {
		this.requiredFunctions.add(functionName)
		return ts.createIdentifier(safePrefix(functionName))
	}

	finalize(nodes: ts.Node[]) {
		const generatedCode = printNodesArray(nodes)

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
	slots: slotMap, createFnNames, entities,
}: ComponentDefinition) {
	const ctx = new CodegenContext()

	const [realParentIdent, parentIdent] = resetParentIdents()


	const entitiesStatements = [] as ts.Statement[]
	for (let index = 0; index < entities.length; index++) {
		const entity = entities[index]
		if (entity.type !== 'SlotUsage') {
			// at the component level, we can't know whether we're truly the lone child of a real node
			// so we pass false, and only concrete nodes below us can reset that based on their status
			const entityStatements = generateEntity(entity, '' + index, false, ctx, realParentIdent, parentIdent)
			Array.prototype.push.apply(entitiesStatements, entityStatements)
			continue
		}

		const { name: slotName = 'def', argsExpression, fallback } = entity
		const slotOptional = slotMap[slotName]
		// TODO if you want to get really fancy, this function can augment the type definition to include slots that are only defined in the template. The `ComponentDefinition` type can look something like this
		// type ComponentDefinition<C, Backfill = {}> = Insertable<[Props<C>, Syncs<C>, Events<C>, Slots<C> & Slots<Backfill>]>
		// and then this file can simply insert all extra slots found here
		// this would make the job of scriptless components easier
		// HOWEVER, these slots couldn't take any parameters
		if (slotOptional === undefined) throw new Error(`slot ${slotName} doesn't exist`)

		if (!slotOptional && fallback !== undefined)
			// required, has fallback: pointless, and typescript won't throw an error so we will
			throw new Error(`fallback provided for slot ${slotName} even though it's required`)

		const usageTarget = !slotOptional
			? slotName
			: ts.createParen(ts.createBinary(
				ts.createIdentifier(slotName),
				ts.createToken(ts.SyntaxKind.BarBarToken),
				fallback === undefined
					// optional, no fallback: default to noop, thereby outputing nothing
					? ctx.requireRuntime('noop')
					// optional, has fallback: default to their fallback, which takes no arguments because it captures its environment
					: ts.createParen(createArrowFunction(
						...generateGenericInsertableDefinition(ctx, undefined, fallback, false),
					)),
			))

		const slotUsageStatement = generateGenericInsertableCall(usageTarget, argsExpression, realParentIdent, parentIdent)
		entitiesStatements.push(slotUsageStatement)
	}


	const args = props.concat(syncs).concat(events)
	const createFnInvocation = createFnNames.length === 0 ? [] : [createConst(
		createFnNames,
		createCall('create', [ts.createAsExpression(
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

	const statements = createFnInvocation.concat(entitiesStatements)
	const slotNames = Object.keys(slotMap)
	const params = [realParentText, parentText, props, syncs, events, slotNames].map(n => createParameter(n))
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

	case 'TextSection':
		return generateText(entity, offset, isRealLone, ctx, realParent, parent)

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

	case 'SlotUsage':
		throw new Error("@slot isn't valid in this context")
	case 'SlotInsertion':
		throw new Error("@insert isn't valid in this context")

	case 'TemplateDefinition':
		return generateTemplateDefinition(entity, ctx)
	case 'TemplateInclusion':
		return generateTemplateInclusion(entity, realParent, parent)

	// case 'VariableBinding':
	// 	throw new Error('unimplemented')
		// return generateVariableBinding(entity, offset, isRealLone, parent)
	}
}

export const enum BindingType { empty, static, dynamic, reactive, sync }
export type LivenessType = Exclude<BindingType, BindingType.empty | BindingType.sync>

const fnModifiers = [] as const
const emptyModifiers = [] as const
const staticModifiers = [] as const
const dynamicModifiers = ['initial'] as const
const reactiveModifiers = [] as const
const syncModifiers = ['fake', 'setter'] as const
// since we aren't yet actually supporting these, I'm not turning them on yet
// const eventModifiers = ['handler', 'exact', 'stop', 'prevent', 'capture', 'self', 'once', 'passive'] as const
const eventModifiers = ['handler'] as const
// const metaModifiers = ['ctrl', 'alt', 'shift', 'meta']
// https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
// const keyModifiers = [] as const
// const mouseModifiers = ['left', 'right', 'middle'] as const

function makeNativeHandler(code: string, isBare: boolean, handlerModifier: boolean) {
	if (handlerModifier && isBare)
		throw new Error("the handler modifier doesn't make any sense on a bare event attribute")
	return isBare || handlerModifier ? code : `$event => ${code}`
}

function processDynamicModifiers(
	ctx: CodegenContext, modifiers: Dict<true>,
	code: string, isComponent: boolean,
) {
	const rawCode = createRawCodeSegment(code)
	return modifiers.initial
		? createCall(ctx.requireRuntime('fakeInitial'), [rawCode])
		: !isComponent ? rawCode : createCall(ctx.requireRuntime('fakeImmutable'), [rawCode])
}
function processSyncModifiers(
	ctx: CodegenContext, modifiers: Dict<true>,
	code: string,
) {
	if (modifiers.setter && modifiers.fake)
		throw new Error("can't use setter and fake modifiers together")
	const rawCode = createRawCodeSegment(code)
	return modifiers.setter ? createCall(ctx.requireRuntime('setterMutable'), [rawCode])
		: modifiers.fake ? createCall(ctx.requireRuntime('fakeMutable'), [rawCode])
		: rawCode
}

function processAttributes(attributes: Attribute[]) {
	const bindings = new UniqueDict<[BindingType, Dict<true>, string]>()
	const events = new DefaultDict(() => [] as [Dict<true>, string, boolean][])
	const fns = [] as string[]

	for (const { name: rawAttribute, value } of attributes) {
		// TODO remember that if an attribute contains dashes it's a dom attribute instead of property, and should be set differently

		const firstLetter = rawAttribute[0] || ''
		if (firstLetter === '') throw new Error("empty attribute name shouldn't be possible!")

		const [attribute, ...modifiersList] = rawAttribute.split('|')
		const sliced = attribute.slice(1)
		const modifiers = modifiersList.unique_index_map(m => [m, true as const])
			.change_err(e => `duplicate modifier ${e[0]}`)
			.unwrap()

		function assertCode(
			value: string | AttributeCode | undefined,
			variety: string,
		): asserts value is AttributeCode {
			if (value === undefined || typeof value === 'string')
				throw new Error(`static attribute values are invalid for ${variety}`)
		}

		function validateModifiers(varietyModifiers: readonly string[], variety: string) {
			for (const modifier of modifiersList)
				if (varietyModifiers.length === 0)
					throw new Error(`modifiers aren't allowed on ${variety}`)
				else if (!varietyModifiers.includes(modifier))
					throw new Error(`modifier ${modifier} isn't valid on ${variety}`)
		}

		function setBinding(binding: [BindingType, Dict<true>, string], useSliced: boolean) {
			const result = bindings.set(useSliced ? sliced : attribute, binding)
			if (result.is_err()) throw new Error(`duplicate binding ${sliced}`)
		}

		switch (firstLetter) {
		case '(':
			if (rawAttribute !== '(fn)')
				throw new Error(`invalid use of parentheses in ${rawAttribute}, were you trying to do a node receiver (fn)?`)
			assertCode(value, 'node receivers')
			validateModifiers(fnModifiers, 'node receivers')
			fns.push(value.code)
			break

		case '@':
			assertCode(value, 'events')
			validateModifiers(eventModifiers, 'events')
			events.get(sliced).push([modifiers, value.code, value.isBare])
			break

		case ':': {
			assertCode(value, 'reactive bindings')
			validateModifiers(reactiveModifiers, 'reactive bindings')
			setBinding([BindingType.reactive, modifiers, value.code], true)
			break
		}

		case '!': {
			assertCode(value, 'syncs')
			validateModifiers(syncModifiers, 'syncs')
			setBinding([BindingType.sync, modifiers, value.code], true)
			break
		}

		default: switch (typeof value) {
			case 'undefined':
				validateModifiers(emptyModifiers, 'empty bindings')
				setBinding([BindingType.empty, modifiers, ''], false)
				break
			case 'string':
				validateModifiers(staticModifiers, 'static bindings')
				setBinding([BindingType.static, modifiers, value], false)
				break
			default:
				validateModifiers(dynamicModifiers, 'dynamic bindings')
				setBinding([BindingType.dynamic, modifiers, value.code], false)
				break
		}}
	}

	return t(bindings.entries(), events.entries(), fns)
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
	// TODO in the future I might get rid of the dynamic metas
	// in this situation we'd just do the same thing the metas loop is doing above
	// and then continue out of this loop iteration
	// if (attribute === 'id') if not dynamic throw new Error("don't use the `id` attribute, use `#id-name` syntax instead")
	// if (attribute === 'class') if not dynamic throw new Error("don't use the `class` attribute, use `.class-name` syntax instead")

	needTagIdent = needTagIdent || attributes.length > 0
	const [bindings, events, fns] = processAttributes(attributes)

	for (const [binding, [type, modifiers, code]] of bindings) switch (type) {
		case BindingType.empty:
			// intentionally ignore modifiers
			statements.push(createFieldAssignment(tagIdent, binding, ts.createTrue()))
			break
		case BindingType.static:
			// intentionally ignore modifiers
			statements.push(createFieldAssignment(tagIdent, binding, ts.createStringLiteral(code)))
			break
		case BindingType.dynamic:
			const bindingCode = processDynamicModifiers(ctx, modifiers, code, false)
			statements.push(createFieldAssignment(tagIdent, binding, bindingCode))
			break
		case BindingType.reactive:
			// intentionally ignore modifiers
			statements.push(createEffectBind(ctx, tagIdent, binding, createRawCodeSegment(`${code}()`)))
			break
		case BindingType.sync:
			throw new Error(`syncs on primitive tags are only allowed on input, textarea, and select, with !sync`)
	}

	for (const [event, handlers] of events) {
		if (handlers.length === 0) continue

		// TODO lots to think about here, since we aren't properly handling basically any modifiers
		const finalHandler = handlers.length === 1
			? createRawCodeSegment(makeNativeHandler(handlers[0][1], handlers[0][2], handlers[0][0].handler || false))
			: createArrowFunction([createParameter('$event')], ts.createBlock(
				handlers.map(([modifiers, code, isBare]) => {
					const handler = makeNativeHandler(code, isBare, modifiers.handler || false)
					return ts.createExpressionStatement(createCall(createRawCodeSegment(`(${handler})`), [ts.createIdentifier('$event')]))
				}),
				true,
			))

		statements.push(createFieldAssignment(tagIdent, `on${event}`, finalHandler))
	}

	for (const code of fns) {
		const statement = createCall(ctx.requireRuntime('nodeReceiver'), [tagIdent, createRawCodeSegment(code)])
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

	if (!needTagIdent)
		statements[0] = ts.createExpressionStatement(tagCreator)

	return statements
}

function strongerLiveness(a: LivenessType, b: LivenessType) {
	switch (a) {
	case BindingType.static:
		return b
	case BindingType.dynamic:
		return b === BindingType.reactive ? b : a
	case BindingType.reactive:
		return a
	}
}

export function generateText(
	{ items }: TextSection, offset: string, isRealLone: boolean,
	ctx: CodegenContext, realParent: ts.Identifier, parent: ts.Identifier,
): ts.Statement[] {
	let totalContent = ''
	let liveness: LivenessType = BindingType.static

	const [wrapCode, wrapItem]: [(s: string) => string, (s: string) => string] = items.length > 1
		? [s => '`' + s + '`', s => '${' + s + '}']
		: [s => s, s => s]

	for (const { isCode, content } of items) {
		const [itemLiveness, itemContent]: [LivenessType, string] = isCode
			? content.startsWith(':')
				? [BindingType.reactive, wrapItem(content.slice(1).trim() + '()')]
				: [BindingType.dynamic, wrapItem(content.trim())]
			: [BindingType.static, content]

		// in the wolf grammar, we have information about line breaks in text sections
		// this means that we can add empty whitespace text sections at the parser level rather than here
		liveness = strongerLiveness(liveness, itemLiveness)
		totalContent += itemContent
	}

	if (isRealLone) switch (liveness) {
		case BindingType.reactive:
			return [createEffectBind(ctx, realParent, 'textContent', createRawCodeSegment(wrapCode(totalContent)))]
		case BindingType.dynamic:
			return [createFieldAssignment(realParent, 'textContent', createRawCodeSegment(wrapCode(totalContent)))]
		case BindingType.static:
			return [createFieldAssignment(realParent, 'textContent', ts.createStringLiteral(totalContent))]
	}

	switch (liveness) {
	case BindingType.reactive:
		const textIdent = safePrefixIdent('text', offset)
		return [
			createConst(
				textIdent,
				createCall(ctx.requireRuntime('createTextNode'), [parent, ts.createStringLiteral('')])
			),
			createEffectBind(ctx, textIdent, 'data', createRawCodeSegment(wrapCode(totalContent))),
		]
	case BindingType.dynamic:
		return [ts.createExpressionStatement(
			createCall(ctx.requireRuntime('createTextNode'), [parent, createRawCodeSegment(wrapCode(totalContent))])
		)]
	case BindingType.static:
		return [ts.createExpressionStatement(
			createCall(ctx.requireRuntime('createTextNode'), [parent, ts.createStringLiteral(totalContent)]),
		)]
	}
}


export function generateComponentInclusion(
	{ name, params, entities }: ComponentInclusion,
	ctx: CodegenContext, realParent: ts.Identifier, parent: ts.Identifier,
) {
	const [bindings, eventHandlers, fns] = processAttributes(params)
	if (fns.length !== 0)
		throw new Error("node receivers don't make any sense on components")

	const props = []
	const syncs = []
	const events = []

	for (const [binding, [type, modifiers, code]] of bindings) switch (type) {
		case BindingType.empty:
			// intentionally ignore modifiers
			// empty is automatically wrapped up in a fake boolean and put into propsArgs
			const fakeSwitch = createCall(ctx.requireRuntime('fakeImmutable'), [ts.createTrue()])
			props.push(ts.createPropertyAssignment(binding, fakeSwitch))
			break
		case BindingType.static:
			// intentionally ignore modifiers
			const fakeString = createCall(ctx.requireRuntime('fakeImmutable'), [ts.createStringLiteral(code)])
			props.push(ts.createPropertyAssignment(binding, fakeString))
			break
		case BindingType.dynamic:
			const fakeImmutable = processDynamicModifiers(ctx, modifiers, code, true)
			props.push(ts.createPropertyAssignment(binding, fakeImmutable))
			break
		case BindingType.reactive:
			// intentionally ignore modifiers
			props.push(ts.createPropertyAssignment(binding, createRawCodeSegment(code)))
			break
		case BindingType.sync:
			const mutable = processSyncModifiers(ctx, modifiers, code)
			syncs.push(ts.createPropertyAssignment(binding, mutable))
			break
	}

	// TODO at some point we should allow proxying native events with a native modifier
	// we'll generate code to receive the single return node of the component
	// and fold its existing handler in with a runtime function
	// however, that code will only be valid on components that have a single root,
	// and that therefore actually do return a node
	for (const [event, handlers] of eventHandlers) {
		// for now, we'll simply not allow native proxying
		if (handlers.length === 0) continue
		if (handlers.length !== 1)
			throw new Error("duplicate event handlers on component")

		const [[modifiers, code, isBare]] = handlers

		// function wrapComponentHandler() {
		// 	return modifiers.handler || isBare ? code : `() => ${code}`
		// }
		const handler = createRawCodeSegment(modifiers.handler || isBare ? code : `() => ${code}`)
		events.push(ts.createPropertyAssignment(event, handler))
	}

	const nonInsertEntities = []
	const slotInsertions = new UniqueDict<SlotInsertion>()
	for (const entity of entities) {
		if (entity.type !== 'SlotInsertion') {
			nonInsertEntities.push(entity)
			continue
		}

		const name = entity.name || 'def'
		const result = slotInsertions.set(name, entity)
		if (result.is_err()) throw new Error(`duplicate slot insertion ${name}`)
	}

	if (nonInsertEntities.length > 0) {
		const defaultInsertion = new SlotInsertion(undefined, undefined, nonInsertEntities as NonEmpty<Entity>)
		const result = slotInsertions.set('def', defaultInsertion)
		if (result.is_err()) throw new Error("can't use an explicit default slot insert and nodes outside of a slot insert")
	}

	const slots = slotInsertions.entries().map(([slotName, { paramsExpression, entities }]) => {
		const [params, block] = generateGenericInsertableDefinition(ctx, paramsExpression, entities, false)
		return ts.createPropertyAssignment(slotName, createArrowFunction(params, block))
	})

	// as an optimization for the call sites to avoid a bunch of empty object allocations,
	// you can pass a reference to the same global empty object for all the groups that haven't provided anything
	const propsArgs = props.length !== 0 ? ts.createObjectLiteral(props, false) : ctx.requireRuntime('EMPTYOBJECT')
	const syncsArgs = syncs.length !== 0 ? ts.createObjectLiteral(syncs, false) : ctx.requireRuntime('EMPTYOBJECT')
	const eventsArgs = events.length !== 0 ? ts.createObjectLiteral(events, false) : ctx.requireRuntime('EMPTYOBJECT')
	const slotsArgs = slots.length !== 0 ? ts.createObjectLiteral(slots, false) : ctx.requireRuntime('EMPTYOBJECT')

	return [ts.createExpressionStatement(createCall(
		name,
		[realParent, parent, propsArgs, syncsArgs, eventsArgs, slotsArgs],
	))]
}


function processExpressionReactive(expression: string): [string, boolean] {
	/*return expression.startsWith('::') ? [expression.slice(2), true]
	:*/ return expression.startsWith(':') ? [`${expression.slice(1)}()`, true]
	: [expression, false]
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
		/*isRealLone
			? createCall(ctx.requireRuntime('contentEffect'), [closure, aboveRealParent])
			:*/ createCall(ctx.requireRuntime('rangeEffect'), [closure, aboveRealParent, aboveParent])
	)]
}


function createIf(
	expression: string, entities: NonEmpty<Entity>, elseBranch: ts.Statement | undefined,
	offset: string, isRealLone: boolean, ctx: CodegenContext,
	realParent: ts.Identifier, parent: ts.Identifier,
) {
	return ts.createIf(
		createRawCodeSegment(expression),
		ts.createBlock(generateEntities(entities, offset, isRealLone, ctx, realParent, parent), true),
		elseBranch,
	)
}
export function generateIfBlock(
	{ expression, entities, elseIfBranches, elseBranch }: IfBlock,
	offset: string, isRealLone: boolean, ctx: CodegenContext,
	aboveRealParent: ts.Identifier, aboveParent: ts.Identifier,
): ts.Statement[] {
	// TODO I'm slowly settling on :expression for code that is simply some Immutable (so we add the actual call),
	// and ::expression for code that is reactive, but is already applying the call
	// that seems not terrible, and it keeps things granular
	// it does mean a few things for this function though:
	// - we can't know `reactive` until we've examined all the expressions and done a "strongest" computation
	// - that means that if the first one isn't reactive, you have to iterate over them

	const [usedExpression, reactive] =
		/*expression.startsWith('::') ? [expression.slice(2), true]
		:*/ expression.startsWith(':') ? processExpressionReactive(expression)
		: [expression, elseIfBranches.some(([expression, ]) => expression.startsWith(':'))]

	const [realParent, parent] = reactive
		? resetParentIdents()
		: [aboveRealParent, aboveParent]

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
		const [usedExpression, ] = processExpressionReactive(expression)
		currentElse = createIf(usedExpression, entities, currentElse, offset, false, ctx, realParent, parent)
	}

	const statements = [createIf(usedExpression, entities, currentElse, offset, false, ctx, realParent, parent)]
	return !reactive
		? statements
		: generateAreaEffect(statements, isRealLone, ctx, aboveRealParent, aboveParent)
}


export function generateEachBlock(
	{ paramsExpression, listExpression, entities }: EachBlock,
	offset: string, isRealLone: boolean, ctx: CodegenContext,
	aboveRealParent: ts.Identifier, aboveParent: ts.Identifier,
): ts.Statement[] {
	const [usedListExpression, reactive] = processExpressionReactive(listExpression)

	const [realParent, parent] = reactive
		? resetParentIdents()
		: [aboveRealParent, aboveParent]

	const statements = [ts.createForOf(
		undefined, ts.createVariableDeclarationList(
			[ts.createVariableDeclaration(createRawCodeSegment(paramsExpression), undefined, undefined)],
			ts.NodeFlags.Const,
		),
		createRawCodeSegment(usedListExpression),
		// all the children of an each loop are by definition not robustly safe to call lone
		ts.createBlock(generateEntities(entities, offset, false, ctx, realParent, parent), true)
	)]
	return !reactive
		? statements
		: generateAreaEffect(statements, isRealLone, ctx, aboveRealParent, aboveParent)
}


function createBreakBlock(...args: Parameters<typeof generateEntities>) {
	const statements = generateEntities(...args)
	statements.push(ts.createBreak(undefined))
	return ts.createBlock(statements, true)
}

function processExpressionReactiveAssignable(expression: string) {
	const [firstSegment, ...restSegments] = expression.startsWith(':')
		? expression.slice(1).split(/ += +/)
		: [expression]
	const [statements, [usedExpression, reactive]] = restSegments.length === 0
		? [[] as ts.Statement[], processExpressionReactive(expression)]
		: [
			[createConst(firstSegment, createRawCodeSegment(restSegments[0] + '()'))],
			[firstSegment, true],
		]

	const codeExpression = createRawCodeSegment(usedExpression)
	return [statements, codeExpression, reactive] as [typeof statements, typeof codeExpression, typeof reactive]
}

export function generateMatchBlock(
	{ matchExpression, patterns, defaultPattern }: MatchBlock,
	offset: string, isRealLone: boolean, ctx: CodegenContext,
	aboveRealParent: ts.Identifier, aboveParent: ts.Identifier,
): ts.Statement[] {
	const [statements, codeMatchExpression, reactive] = processExpressionReactiveAssignable(matchExpression)
	const [realParent, parent] = reactive
		? resetParentIdents()
		: [aboveRealParent, aboveParent]

	const blocks = patterns.map(([expression, entities], index) => {
		const block = createBreakBlock(entities, nextOffset(offset, index), false, ctx, realParent, parent)
		return ts.createCaseClause(createRawCodeSegment(expression), [block]) as ts.CaseOrDefaultClause
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
	offset: string, isRealLone: boolean, ctx: CodegenContext,
	aboveRealParent: ts.Identifier, aboveParent: ts.Identifier,
) {
	const [statements, codeSwitchExpression, reactive] = processExpressionReactiveAssignable(switchExpression)
	const [realParent, parent] = reactive
		? resetParentIdents()
		: [aboveRealParent, aboveParent]

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
			: [false, ts.createCaseClause(createRawCodeSegment(switchCase.expression), [block])]

		if (isDefault) {
			if (seenDefault) throw new Error("duplicate default cases")
			seenDefault = true
		}

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
	entities: NonEmpty<Entity>,
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

function createEffectBind(
	ctx: CodegenContext,
	target: ts.Expression,
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
