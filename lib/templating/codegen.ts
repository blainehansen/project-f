import ts = require('typescript')
import '@ts-std/extensions/dist/array'
import { DefaultDict, UniqueDict } from '@ts-std/collections'

import { Dict, tuple as t, NonEmpty, NonLone } from '../utils'
import {
	Entity, Directive,
	ComponentDefinition, Tag, Meta, Attribute, AttributeCode, TextSection, TextItem,
	ComponentInclusion, IfBlock, EachBlock, MatchBlock, MatchPattern, SwitchBlock, SwitchCase, SwitchDefault,
	SlotDefinition, SlotInsertion, TemplateDefinition, TemplateInclusion,
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
export const resetParentIdents = () => t(ts.createIdentifier(realParentText), ts.createIdentifier(parentText))
const untypedParentParams = () => t(createParameter(realParentText), createParameter(parentText))
const typedParentParams = () => t(
	createParameter(realParentText, ts.createTypeReferenceNode(ts.createIdentifier('Node'), undefined)),
	createParameter(parentText, ts.createTypeReferenceNode(ts.createIdentifier('Node'), undefined)),
)

// as an optimization for the call sites to avoid a bunch of empty object allocations,
// you can pass a reference to the same global empty object for all the groups that haven't provided anything
export function generateComponentRenderFunction(
	propsNames: string[], syncsNames: string[],
	eventsNames: string[], slotNames: string[],
	createFnNames: string[], entities: NonEmpty<Entity>,
) {
	const ctx = new CodegenContext()

	const [realParentIdent, parentIdent] = resetParentIdents()
	// at the component level, we can't know whether we're truly the lone child of a real node
	// so we pass false, and only concrete nodes below us can reset that based on their status
	// TODO this needs to actually manually iterate over these, and pluck out any SlotDefinition and handle them
	// we can combine this SlotDefinition information with the optionality of slots to know how to default them,
	// whether to this fallback produced here or to a noop
	// TODO at some point we need to be aware of the optionality of the slots,
	const entitiesStatements = []
	for (let index = 0; index < entities.length; index++) {
		const entity = entities[index]
		if (entity.type === 'SlotDefinition')
			throw new Error('unimplemented')

		const entityStatements = generateEntity(entity, '' + index, false, ctx, realParentIdent, parentIdent)
		Array.prototype.push.apply(entitiesStatements, )
	}

	const argsNames = propsNames.concat(syncsNames).concat(eventsNames)
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

	const statements = createFnInvocation.concat(entitiesStatements)
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
		// return generateIfBlock(entity, offset, isRealLone, parent)
		throw new Error('unimplemented')
	case 'EachBlock':
		// return generateEachBlock(entity, offset, isRealLone, parent)
		throw new Error('unimplemented')
	case 'MatchBlock':
		// return generateMatchBlock(entity, offset, isRealLone, parent)
		throw new Error('unimplemented')
	case 'SwitchBlock':
		// return generateSwitchBlock(entity, offset, isRealLone, parent)
		throw new Error('unimplemented')

	// the below context will pluck out the valid ones they're interested in and save them from entering this function
	// - in generateComponentInclusion, plucking out SlotInsertion
	// - in generateComponentRenderFunction, plucking out SlotDefinition
	case 'SlotDefinition':
		throw new Error("@slot isn't valid in this context")
	case 'SlotInsertion':
		throw new Error("@insert isn't valid in this context")

	case 'TemplateDefinition':
		return generateTemplateDefinition(entity, ctx)
	case 'TemplateInclusion':
		return generateTemplateInclusion(entity, realParent, parent)

	case 'VariableBinding':
		throw new Error('unimplemented')
		// return generateVariableBinding(entity, offset, isRealLone, parent)
	}
}

export const enum BindingType { empty, static, dynamic, reactive, sync }
export type LivenessType = Exclude<BindingType, BindingType.empty | BindingType.sync>

const fnModifiers = [] as const
const dynamicModifiers = ['initial'] as const
const reactiveModifiers = ['fake'] as const
const syncModifiers = ['fake', 'setter'] as const
// since we aren't yet actually supporting these, I'm not turning them on yet
// const eventModifiers = ['handler', 'exact', 'stop', 'prevent', 'capture', 'self', 'once', 'passive'] as const
const eventModifiers = ['handler'] as const
// const metaModifiers = ['ctrl', 'alt', 'shift', 'meta']
// https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
// const keyModifiers = [] as const
// const mouseModifiers = ['left', 'right', 'middle'] as const

function checkAttribute(
	value: string | AttributeCode | undefined,
	modifiersList: string[],
	variety: string,
	varietyModifiers: readonly string[],
): asserts value is AttributeCode {
	if (value === undefined || typeof value === 'string')
		throw new Error(`static attribute values are invalid for ${variety}s`)
	for (const modifier of modifiersList)
		if (!varietyModifiers.includes(modifier))
			throw new Error(`invalid modifier for ${variety}: ${modifier}`)
}

function makeNativeHandler(code: string, isBare: boolean, handlerModifier: boolean) {
	return isBare || handlerModifier ? `$event => ${code}` : code
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

		switch (firstLetter) {
		case '&':
		// case '(':
			// if (rawAttribute !== '(fn)')
			if (sliced !== 'fn')
				throw new Error("the & prefix for node receivers is only valid when used as &fn")

			checkAttribute(value, modifiersList, 'node receiver', fnModifiers)
			fns.push(value.code)
			break

		case '@':
			checkAttribute(value, modifiersList, 'event', eventModifiers)
			if (modifiers.handler && value.isBare)
				throw new Error("the handler modifier doesn't make any sense on a bare event attribute")

			events.get(sliced).push([modifiers, value.code, value.isBare])
			break

		case ':': {
			checkAttribute(value, modifiersList, 'reactive binding', reactiveModifiers)
			const result = bindings.set(sliced, [BindingType.reactive, modifiers, value.code])
			if (result.is_err()) throw new Error(`duplicate binding ${sliced}`)
			break
		}

		case '!': {
			checkAttribute(value, modifiersList, 'sync', syncModifiers)
			const result = bindings.set(sliced, [BindingType.sync, modifiers, value.code])
			if (result.is_err()) throw new Error(`duplicate sync ${sliced}`)
			break
		}

		default:
			if (modifiersList.length !== 0)
				throw new Error("modifiers don't make any sense on attributes that aren't reactive, syncs, or events")

			const result = bindings.set(
				attribute,
				value === undefined ? [BindingType.empty, {}, '']
				: typeof value === 'string' ? [BindingType.static, {}, value]
				: [BindingType.dynamic, {}, value.code]
			)
			if (result.is_err()) throw new Error(`duplicate binding ${attribute}`)
		}
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
			// intentionally ignore modifiers
			statements.push(createFieldAssignment(tagIdent, binding, createRawCodeSegment(code)))
			break
		case BindingType.reactive:
			if (modifiers.fake) throw new Error("the fake modifier doesn't make any sense on a tag, just use a non-reactive binding instead")
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
			const wrapper = ctx.requireRuntime(modifiers.initial ? 'fakeInitial' : 'fakeImmutable')
			const fakeImmutable = createCall(wrapper, [createRawCodeSegment(code)])
			props.push(ts.createPropertyAssignment(binding, fakeImmutable))
			break
		case BindingType.reactive:
			props.push(ts.createPropertyAssignment(binding, createRawCodeSegment(code)))
			break
		case BindingType.sync:
			if (modifiers.setter && modifiers.fake)
				throw new Error("can't use setter and fake modifiers together")

			const rawCode = createRawCodeSegment(code)
			const mutable = modifiers.setter ? createCall(ctx.requireRuntime('setter'), [rawCode])
				: modifiers.fake ? createCall(ctx.requireRuntime('fakeMutable'), [rawCode])
				: rawCode

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

		const name = entity.name || 'default'
		const result = slotInsertions.set(name, entity)
		if (result.is_err()) throw new Error(`duplicate slot insertion ${name}`)
	}

	if (nonInsertEntities.length > 0) {
		const default = new SlotInsertion(undefined, undefined, nonInsertEntities as NonEmpty<Entity>)
		const result = slotInsertions.set('default', default)
		if (result.is_err()) throw new Error("can't use an explicit default slot insert and nodes outside of a slot insert")
	}

	const slots = slotInsertions.entries().map(([slotName, { receiverExpression, entities }]) => {
		const [realParentParam, parentParam] = untypedParentParams()
		const [realParentIdent, parentIdent] = resetParentIdents()
		return ts.createPropertyAssignment(
			slotName,
			createArrowFunction(
				[realParentParam, parentParam, createParameter(createRawCodeSegment(receiverExpression))],
				ts.createBlock(generateEntities(entities, '', false, ctx, realParentIdent, parentIdent), true)
			),
		)
	})

	const propsArgs = props.length !== 0 ? ts.createObjectLiteral(props, false) : ctx.requireRuntime('EMPTYOBJECT')
	const syncsArgs = syncs.length !== 0 ? ts.createObjectLiteral(syncs, false) : ctx.requireRuntime('EMPTYOBJECT')
	const eventsArgs = events.length !== 0 ? ts.createObjectLiteral(events, false) : ctx.requireRuntime('EMPTYOBJECT')
	const slotsArgs = slots.length !== 0 ? ts.createObjectLiteral(slots, false) : ctx.requireRuntime('EMPTYOBJECT')

	return [ts.createExpressionStatement(createCall(
		name,
		[realParent, parent, propsArgs, syncsArgs, eventsArgs, slotsArgs],
	))]
}

// function createIf(
// 	{ expression, entities, elseBranch }: IfBlock,
// 	reactiveSoFar: boolean, isRealLone: boolean,
// ) {
// 	const reactive = reactiveSoFar || expression.startsWith(':')

// 	return ts.createIf(
// 		createRawCodeSegment(expression),
// 		ts.createBlock(generateEntities(entities), true),
// 		elseBranch === undefined ? undefined
// 			: Array.isArray(elseBranch) ? ts.createBlock(generateEntities(elseBranch), true)
// 			: createIf(elseBranch),
// 	)
// }
// export function generateIfBlock(
// 	ifBlock: IfBlock, offset: string, isRealLone: boolean,
// 	ctx: CodegenContext, realParent: ts.Identifier, parent: ts.Identifier,
// ): ts.Statement[] {
// 	const [reactive, ifStatement] = createIf(ifBlock, false, isRealLone)

// 	const params = [createParameter(realParent), createParameter(parent)]
// 	const closure = createArrowFunction(params, ts.createBlock([ifStatement], true))

// 	return isRealLone
// 		? reactive
// 			? [ts.createExpressionStatement(createCall(requireRuntime('contentEffect'), [closure, realParent]))]
// 			: ifStatement
// 		: reactive
// 			? createCall(requireRuntime('rangeEffect'), [closure, realParent, parent])
// 			: ifStatement
// }

// function generateEachBlock(e: EachBlock, offset: string, isRealLone: boolean, ctx: CodegenContext, parent: ts.Identifier) {

// }
// function generateMatchBlock(e: MatchBlock, offset: string, isRealLone: boolean, ctx: CodegenContext, parent: ts.Identifier) {

// }
// function generateSwitchBlock(e: SwitchBlock, offset: string, isRealLone: boolean, ctx: CodegenContext, parent: ts.Identifier) {

// }
// export function generateSlotDefinition(e: SlotDefinition, offset: string, isRealLone: boolean, ctx: CodegenContext, parent: ts.Identifier) {

// }
// export function generateSlotInsertion(e: SlotInsertion, offset: string, isRealLone: boolean, ctx: CodegenContext, parent: ts.Identifier) {

// }

export function generateTemplateDefinition(
	{ name, paramsExpression, entities }: TemplateDefinition,
	ctx: CodegenContext,
): ts.Statement[] {
	const remainingParams = paramsExpression !== undefined
		? [createParameter(createRawCodeSegment(paramsExpression))]
		: []

	const params = typedParentParams().concat(remainingParams)
	const [realParentIdent, parentIdent] = resetParentIdents()

	return [ts.createFunctionDeclaration(
		undefined, undefined, undefined, ts.createIdentifier(name),
		undefined, params, undefined,
		// this is similar to a component definition, since we can't know how this template will be used
		// we have to begin with the assumption that this can be used in non-lone contexts
		ts.createBlock(generateEntities(entities, '', false, ctx, realParentIdent, parentIdent), true)
	)]
}

export function generateTemplateInclusion(
	{ name, argsExpression }: TemplateInclusion,
	realParent: ts.Identifier, parent: ts.Identifier,
): ts.Statement[] {
	const givenArgs = argsExpression !== undefined
		? [createRawCodeSegment(argsExpression)]
		: []
	return [ts.createExpressionStatement(createCall(name, [realParent, parent].concat(givenArgs)))]
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
