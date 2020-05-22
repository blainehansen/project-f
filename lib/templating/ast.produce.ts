import { splitGuard, Dict, NonEmpty, OmitVariants } from '../utils'
import { ParseError, ParseWarning, ParseResult, Parse, Errors, Warnings } from './utils'

// const fnModifiers = [] as const
// const emptyModifiers = [] as const
// const staticModifiers = [] as const
// const dynamicModifiers = ['initial'] as const
// const reactiveModifiers = [] as const
// const syncModifiers = ['fake', 'setter'] as const
// // since we aren't yet actually supporting these, I'm not turning them on yet
// // const eventModifiers = ['handler', 'exact', 'stop', 'prevent', 'capture', 'self', 'once', 'passive'] as const
// const eventModifiers = ['handler'] as const
// // const metaModifiers = ['ctrl', 'alt', 'shift', 'meta']
// // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
// // const keyModifiers = [] as const
// // const mouseModifiers = ['left', 'right', 'middle'] as const

// function makeNativeHandler(code: string, isBare: boolean, handlerModifier: boolean) {
// 	if (handlerModifier && isBare)
// 		throw new Error("the handler modifier doesn't make any sense on a bare event attribute")
// 	return isBare || handlerModifier ? code : `$event => ${code}`
// }

// function processDynamicModifiers(
// 	ctx: CodegenContext, modifiers: Dict<true>,
// 	code: string, isComponent: boolean,
// ) {
// 	const rawCode = createRawCodeSegment(code)
// 	return modifiers.initial
// 		? createCall(ctx.requireRuntime('fakeInitial'), [rawCode])
// 		: !isComponent ? rawCode : createCall(ctx.requireRuntime('fakeImmutable'), [rawCode])
// }
// function processSyncModifiers(
// 	ctx: CodegenContext, modifiers: Dict<true>,
// 	code: string,
// ) {
// 	if (modifiers.setter && modifiers.fake)
// 		throw new Error("can't use setter and fake modifiers together")
// 	const rawCode = createRawCodeSegment(code)
// 	return modifiers.setter ? createCall(ctx.requireRuntime('setterMutable'), [rawCode])
// 		: modifiers.fake ? createCall(ctx.requireRuntime('fakeMutable'), [rawCode])
// 		: rawCode
// }



// const nonInsertEntities = []
// const slotInsertions = new UniqueDict<SlotInsertion>()
// for (const entity of entities) {
// 	if (entity.type !== 'SlotInsertion') {
// 		nonInsertEntities.push(entity)
// 		continue
// 	}

// 	const name = entity.name || 'def'
// 	const result = slotInsertions.set(name, entity)
// 	if (result.is_err()) throw new Error(`duplicate slot insertion ${name}`)
// }

// if (nonInsertEntities.length > 0) {
// 	const defaultInsertion = new SlotInsertion(undefined, undefined, nonInsertEntities as NonEmpty<Entity>)
// 	const result = slotInsertions.set('def', defaultInsertion)
// 	if (result.is_err()) throw new Error("can't use an explicit default slot insert and nodes outside of a slot insert")
// }

// const slots = slotInsertions.entries().map(([slotName, { paramsExpression, entities }]) => {
// 	const [params, block] = generateGenericInsertableDefinition(ctx, paramsExpression, entities, false)
// 	return ts.createPropertyAssignment(slotName, createArrowFunction(params, block))
// })





export function parseAttribute(
	rawAttribute: string, rawAttributeSpan: Span,
	value: string | AttributeCode | undefined, valueSpan: Span,
): ParseResult<Attribute> {
		const parse = new Parse<Attribute>()
		const [attribute, ...modifiersList] = rawAttribute.split('|')

		if (attribute === '(node)') {
			if (!('code' in value))
				return parse.Err(Errors.requiresCode(valueSpan, 'node receivers'))
			Warnings.checkExtraneousModifiers(parse, rawAttributeSpan, modifiers, 'node receivers')
			return parse.Ok(new ReceiverAttribute(value))
		}
		// TODO remember that if an attribute contains dashes it's a dom attribute instead of property, and should be set differently

		const sliced = attribute.slice(1)
		const modifiersUnique = new UniqueDict<true>()
		for (const modifier of modifiersList) {
			const result = modifiersUnique.set(modifier, true)
			if (result.is_err())
				parse.warn(ParseWarning(rawAttributeSpan, `duplicate modifier ${result.error[0]}`))
		}
		const modifiers = modifiersUnique.into_dict()

		const firstLetter = rawAttribute[0] || ''
		switch (firstLetter) {
		case '@':
			if (!('code' in value))
				return parse.Err(Errors.requiresCode(valueSpan, 'events'))

			const { isBare, code } = value
			const variety = isBare ? 'bare'
				: modifiers.handler ? 'handler'
				: 'inline'

			if (isBare && modifiers.handler)
				parse.warn(ParseWarning(rawAttributeSpan, 'redundant handler', "the handler modifier is meaningless on a bare attribute"))
			delete modifiers.handler
			Warnings.checkExtraneousModifiers(parse, rawAttributeSpan, modifiers, 'events')
			return parse.Ok(new EventAttribute(sliced, variety, code))

		case '!': {
			if (!('code' in value))
				return parse.Err(Errors.requiresCode(valueSpan, 'syncs'))
			if (modifiers.fake && modifiers.setter)
				return parse.Err(Errors.conflictingModifiers(rawAttributeSpan, "fake and setter cannot be used together"))

			const modifier = modifiers.fake ? SyncModifier.fake
				: modifiers.setter ? SyncModifier.setter
				: undefined
			delete modifiers.fake; delete modifiers.setter
			Warnings.checkExtraneousModifiers(parse, rawAttributeSpan, modifiers, 'syncs')

			return parse.Ok(new SyncAttribute(sliced, modifier, value))
		}

		case ':': {
			if (!('code' in value))
				return parse.Err(Errors.requiresCode(valueSpan, 'reactive bindings'))
			Warnings.checkExtraneousModifiers(parse, rawAttributeSpan, modifiers, 'reactive bindings')
			return parse.Ok(new BindingAttribute(sliced, { type: 'reactive', reactiveCode: value.code }))
		}

		default: switch (typeof value) {
			case 'undefined':
				Warnings.checkExtraneousModifiers(parse, rawAttributeSpan, modifiers, 'attributes')
				return parse.Ok(new BindingAttribute(attribute, { type: 'empty' }))
			case 'string':
				Warnings.checkExtraneousModifiers(parse, rawAttributeSpan, modifiers, 'attributes')
				return parse.Ok(new BindingAttribute(attribute, { type: 'static', value }))
			default:
				const initialModifier = modifiers.initial || false
				delete modifiers.initial
				Warnings.checkExtraneousModifiers(parse, rawAttributeSpan, modifiers, 'bindings')
				return parse.Ok(new BindingAttribute(attribute, { type: 'dynamic', code: value, initialModifier }))
		}}
	}
}

const leafTags = ['br', 'input', 'option']
export function parseHtml(
	ident: string, metas: Meta[], tagSpan: Span,
	attributes: Attribute[], entities: Entity[],
): ParseResult<Html> {
	const parse = new Parse<Html>()

	if (entities.length > 0 && leafTags.includes(ident))
		parse.warn(Warnings.leafChildren(tagSpan, ident))

	const [syncs, nonSyncs] = splitGuard(attributes, a => a.type === 'SyncAttribute')

	if (syncs.length > 0) {
		if (syncs.length !== 1) return parse.Err()
		const [sync] = syncs
		if (sync.attribute !== 'sync') return parse.Err()
		if (sync.modifier !== undefined) return parse.Err()

		const tagAttributes = parseTagAttributes()

		switch (ident) {
		case 'input':
			const typeBinding = nonSyncs.find(a => a.type === 'BindingAttribute' && a.attribute === 'type')
			if (typeBinding && typeBinding.type !== 'static') return parse.Err()


			if (typeBinding === undefined || typeBinding.value === 'text')
				return parse.Ok(new SyncedTextInput(false, sync.code, tagAttributes))
			if (typeBinding.value === 'checkbox') {
				const valueBinding = nonSyncs.find(a => a.type === 'BindingAttribute' && a.attribute === 'value')
				if (valueBinding && (valueBinding.type === 'empty' || valueBinding.type === 'reactive'))
					return parse.Err()
				return parse.Ok(new SyncedCheckboxInput(sync.code, valueBinding, tagAttributes))
			}
			if (typeBinding.value === 'radio') {
				const valueBinding = nonSyncs.find(a => a.type === 'BindingAttribute' && a.attribute === 'value')
				if (!valueBinding || valueBinding.type === 'empty' || valueBinding.type === 'reactive')
					return parse.Err()
				return parse.Ok(new SyncedRadioInput(sync.code, valueBinding, tagAttributes))
			}

			return parse.Err()

		case 'textarea':
			return parse.Ok(new SyncedTextInput(true, sync.code, tagAttributes))

		case 'select':
			const multipleBinding = nonSyncs.find(a => a.type === 'BindingAttribute' && a.attribute === 'multiple')
			if (!multipleBinding || multipleBinding.type === 'empty')
				return parse.Ok(new SyncedSelect(sync.code, !!multipleBinding, tagAttributes))
			return parse.Err()
		default:
			return parse.Err()
		}
	}

	return parse.Ok(new Tag(ident, tagAttributes, entities))
}

export function parseTagAttributes(attributes: Exclude<Attribute, SyncAttribute>[]) {
	const parse = new Parse<TagAttributes>()

	const bindings = new UniqueDict<BindingAttribute>()
	const events = new DefaultDict(() => [] as EventAttribute[])
	const receivers: ReceiverAttribute[] = []

	for (const attribute of attributes) switch (attribute.type) {
	case 'BindingAttribute': {
		const result = bindings.set(attribute.attribute, attribute)
		if (result.is_err())
			parse.error(ParseError(rawAttributeSpan, `duplicate binding ${result.error[0]}`))
	}
	case 'EventAttribute':
		const { event, variety, code: rawCode } = attribute
		const code = variety === 'inline' ? `$event => ${rawCode}` : rawCode
		events.get(event).push(new EventAttribute(event, variety, code))
		break

	case 'ReceiverAttribute':
		receivers.push(attribute)
		break
	}

	return parse.Ok(new TagAttributes(metas, bindings.into_dict(), events.into_dict() as Dict<NonEmpty<EventAttribute>>, receivers))
}

export function parseComponentInclusionAttributes(
	name: string,
	attributes: Attribute[],
): ParseResult<ComponentInclusion> {
	const parse = new Parse<TagAttributes>()

	const props = new UniqueDict<BindingAttribute>()
	const syncs = new UniqueDict<SyncAttribute>()
	const events = new DefaultDict(() => [] as EventAttribute[])
	const receivers: ReceiverAttribute[] = []

	slotInsertions

	// TODO have to check both bindings and events together for name uniqueness
	for (const attribute of attributes) switch (attribute.type) {
	case 'BindingAttribute': {
		const result = props.set(attribute.attribute, attribute)
		if (result.is_err()) parse.error(ParseError(rawAttributeSpan, `duplicate prop ${result.error[0]}`))
		break
	}
	case 'SyncAttribute': {
		const result = syncs.set(attribute.attribute, attribute)
		if (result.is_err()) parse.error(ParseError(rawAttributeSpan, `duplicate sync ${result.error[0]}`))
		break
	}
	case 'EventAttribute':
		const { event, variety, code: rawCode } = attribute
		const code = variety === 'inline' ? `() => ${rawCode}` : rawCode
		events.get(event).push(new EventAttribute(event, variety, code))
		break
	case 'ReceiverAttribute':
		parse.error(ParseError(rawAttributeSpan, "receivers don't make any sense on components"))
		break
	}

	return parse.Ok(new ComponentInclusion(name, props, syncs, events, slotInsertions))
}
