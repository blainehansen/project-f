import { Context, Warnings } from './utils'
import { splitGuard, Dict, NonEmpty, OmitVariants } from '../utils'
import {
	LivenessType, ComponentDefinition, Entity, Html, Tag, TagAttributes, Meta, AttributeCode, TextSection, TextItem,
	BindingAttribute, BindingValue, ExistentBindingValue, InertBindingValue, EventAttribute, ReceiverAttribute, /*RefAttribute,*/ Attribute,
	SyncedTextInput, SyncedCheckboxInput, SyncedRadioInput, SyncedSelect, SyncModifier, SyncAttribute,
	Directive, ComponentInclusion, IfBlock, /*ForBlock,*/ EachBlock, MatchBlock, SwitchBlock, SwitchCase, SwitchDefault,
	SlotUsage, SlotInsertion, TemplateDefinition, TemplateInclusion,
} from './ast'

import { Span } from 'kreia/dist/runtime/lexer'
import { UniqueDict, DefaultDict } from '@ts-std/collections'

// const fnModifiers = [] as const
// const emptyModifiers = [] as const
// const staticModifiers = [] as const
// const dynamicModifiers = ['initial'] as const
// const reactiveModifiers = [] as const
// const syncModifiers = ['fake', 'setter'] as const
// // const eventModifiers = ['handler', 'exact', 'stop', 'prevent', 'capture', 'self', 'once', 'passive'] as const
// const eventModifiers = ['handler'] as const
// // const metaModifiers = ['ctrl', 'alt', 'shift', 'meta']
// // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
// // const keyModifiers = [] as const
// // const mouseModifiers = ['left', 'right', 'middle'] as const

function isAttributeCode(v: string | AttributeCode | undefined): v is AttributeCode {
	return !!v && v instanceof AttributeCode
}
function isInertBindingValue(v: BindingValue): v is InertBindingValue {
	return v.type !== 'empty' && v.type !== 'reactive'
}

export function parseAttribute(
	rawAttribute: string, rawAttributeSpan: Span,
	value: string | AttributeCode | undefined, valueSpan: Span | undefined,
) {
	const ctx = new Context<Attribute>()
	const [attribute, ...modifiersList] = rawAttribute.split('|')
	const modifiersUnique = new UniqueDict<true>()
	for (const modifier of modifiersList) {
		const result = modifiersUnique.set(modifier, true)
		if (result.is_err()) ctx.warn('DUPLICATE_MODIFIER', rawAttributeSpan, modifier)
	}
	const modifiers = modifiersUnique.into_dict()

	if (attribute === '(node)') {
		if (!isAttributeCode(value))
			return ctx.Err('REQUIRES_CODE', valueSpan || rawAttributeSpan, 'node receivers')
		Warnings.checkExtraneousModifiers(ctx, rawAttributeSpan, modifiers, 'node receivers')
		return ctx.Ok(() => new ReceiverAttribute(value))
	}

	// TODO remember that if an attribute contains dashes it's a dom attribute instead of property, and should be set differently

	const sliced = attribute.slice(1)

	const firstLetter = rawAttribute[0] || ''
	switch (firstLetter) {
	// case '*': /* check errors */ return new RefAttribute(sliced, 'deref')
	// case '&': /* check errors */ return new RefAttribute(sliced, 'ref')
	case '@':
		if (!isAttributeCode(value))
			return ctx.Err('REQUIRES_CODE', valueSpan, 'events')

		const { isBare, code } = value
		const variety = isBare ? 'bare'
			: modifiers.handler ? 'handler'
			: 'inline'

		if (isBare && modifiers.handler)
			ctx.warn('REDUNDANT_HANDLER_BARE', rawAttributeSpan)
		delete modifiers.handler
		Warnings.checkExtraneousModifiers(ctx, rawAttributeSpan, modifiers, 'events')
		return ctx.Ok(() => new EventAttribute(sliced, variety, code))

	case '!': {
		if (!isAttributeCode(value))
			return ctx.Err('REQUIRES_CODE', valueSpan, 'syncs')
		if (modifiers.fake && modifiers.setter)
			return ctx.Err('CONFLICTING_MODIFIERS_FAKE_SETTER', rawAttributeSpan)

		const modifier = modifiers.fake ? SyncModifier.fake
			: modifiers.setter ? SyncModifier.setter
			: undefined
		delete modifiers.fake; delete modifiers.setter
		Warnings.checkExtraneousModifiers(ctx, rawAttributeSpan, modifiers, 'syncs')

		return ctx.Ok(() => new SyncAttribute(sliced, modifier, value))
	}

	case ':': {
		if (!isAttributeCode(value))
			return ctx.Err('REQUIRES_CODE', valueSpan, 'reactive bindings')
		Warnings.checkExtraneousModifiers(ctx, rawAttributeSpan, modifiers, 'reactive bindings')
		return ctx.Ok(() => new BindingAttribute(sliced, { type: 'reactive', reactiveCode: value }))
	}

	default: switch (typeof value) {
		case 'undefined':
			Warnings.checkExtraneousModifiers(ctx, rawAttributeSpan, modifiers, 'attributes')
			return ctx.Ok(() => new BindingAttribute(attribute, { type: 'empty' }))
		case 'string':
			Warnings.checkExtraneousModifiers(ctx, rawAttributeSpan, modifiers, 'attributes')
			return ctx.Ok(() => new BindingAttribute(attribute, { type: 'static', value }))
		default:
			const initialModifier = modifiers.initial || false
			delete modifiers.initial
			Warnings.checkExtraneousModifiers(ctx, rawAttributeSpan, modifiers, 'bindings')
			return ctx.Ok(() => new BindingAttribute(attribute, { type: 'dynamic', code: value, initialModifier }))
	}}
}


const leafTags = ['br', 'input']
export function parseHtml(
	ident: string, metas: Meta[], tagSpan: Span,
	attributes: Attribute[], entities: Entity[],
) {
	const ctx = new Context<Html>()

	if (entities.length > 0 && leafTags.includes(ident))
		ctx.warn('LEAF_CHILDREN', tagSpan, ident)

	const [syncs, nonSyncs] = splitGuard(attributes, (a): a is SyncAttribute => a.type === 'SyncAttribute')
	const tagAttributesResult = ctx.subsume(ctxTagAttributes(metas, tagSpan, nonSyncs))
	if (tagAttributesResult.is_err()) return ctx.subsumeFail(tagAttributesResult.error)
	const tagAttributes = tagAttributesResult.value

	if (syncs.length === 0)
		return ctx.Ok(() => new Tag(ident, tagAttributes, entities))

	if (syncs.length !== 1) return ctx.Err('INVALID_TAG_SYNC_MULTIPLE', tagSpan)
	const [sync] = syncs
	if (sync.attribute !== 'sync')
		return ctx.Err('INVALID_TAG_SYNC_INVALID', tagSpan)
	if (sync.modifier !== undefined)
		return ctx.Err('INVALID_TAG_SYNC_MODIFIER', tagSpan)

	switch (ident) {
	case 'input':
		const typeBindingAttribute = nonSyncs.find((a): a is BindingAttribute => a.type === 'BindingAttribute' && a.attribute === 'type')
		const typeBinding = typeBindingAttribute ? typeBindingAttribute.value : undefined

		if (typeBinding && typeBinding.type !== 'static')
			return ctx.Err('INPUT_TAG_SYNC_NOT_KNOWN_TYPE', tagSpan)

		if (typeBinding === undefined || typeBinding.value === 'text')
			return ctx.Ok(() => new SyncedTextInput(false, sync.code, tagAttributes))

		if (typeBinding.value === 'checkbox') {
			const valueBindingAttribute = nonSyncs.find((a): a is BindingAttribute => a.type === 'BindingAttribute' && a.attribute === 'value')
			const valueBinding = valueBindingAttribute ? valueBindingAttribute.value : undefined
			if (!valueBinding || isInertBindingValue(valueBinding))
				return ctx.Ok(() => new SyncedCheckboxInput(sync.code, valueBinding, tagAttributes))
			return ctx.Err('INPUT_TAG_SYNC_CHECKBOX_NOT_KNOWN_VALUE', tagSpan)
		}

		if (typeBinding.value === 'radio') {
			const valueBindingAttribute = nonSyncs.find((a): a is BindingAttribute => a.type === 'BindingAttribute' && a.attribute === 'value')
			const valueBinding = valueBindingAttribute ? valueBindingAttribute.value : undefined
			if (valueBinding && isInertBindingValue(valueBinding))
				return ctx.Ok(() => new SyncedRadioInput(sync.code, valueBinding, tagAttributes))

			return ctx.Err('INPUT_TAG_SYNC_RADIO_NOT_KNOWN_VALUE', tagSpan)
		}

		return ctx.Err('INPUT_TAG_SYNC_UNSUPPORTED_TYPE', tagSpan)

	case 'textarea':
		return ctx.Ok(() => new SyncedTextInput(true, sync.code, tagAttributes))

	case 'select':
		const multipleBindingAttribute = nonSyncs.find((a): a is BindingAttribute => a.type === 'BindingAttribute' && a.attribute === 'multiple')
		const multipleBinding = multipleBindingAttribute ? multipleBindingAttribute.value : undefined
		if (!multipleBinding || multipleBinding.type === 'empty')
			return ctx.Ok(() => new SyncedSelect(sync.code, !!multipleBinding, tagAttributes))
		return ctx.Err('INPUT_TAG_SYNC_SELECT_INVALID_MULTIPLE', tagSpan)

	default:
		return ctx.Err('INVALID_SYNCED_TAG', tagSpan)
	}
}

export function parseTagAttributes(
	metas: Meta[], identSpan: Span,
	attributes: Exclude<Attribute, SyncAttribute>[],
) {
	const ctx = new Context<TagAttributes>()

	const bindings = new UniqueDict<BindingAttribute>()
	const events = new DefaultDict(() => [] as EventAttribute[])
	const receivers: ReceiverAttribute[] = []

	for (const attribute of attributes) switch (attribute.type) {
	case 'BindingAttribute': {
		const result = bindings.set(attribute.attribute, attribute)
		if (result.is_err())
			ctx.error('TAG_DUPLICATE_BINDING', identSpan, result.error[0])
		break
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

	return ctx.Ok(() => new TagAttributes(metas, bindings.into_dict(), events.into_dict() as Dict<NonEmpty<EventAttribute>>, receivers))
}

export function parseComponentInclusion(
	name: string, nameSpan: Span,
	attributes: Attribute[],
	entities: (Entity | SlotInsertion)[],
) {
	const ctx = new Context<ComponentInclusion>()

	const componentArguments = new UniqueDict<boolean>()
	const props = {} as Dict<BindingAttribute>
	const syncs = {} as Dict<SyncAttribute>
	const events = new DefaultDict(() => [] as EventAttribute[])
	const receivers: ReceiverAttribute[] = []

	for (const attribute of attributes) switch (attribute.type) {
	case 'BindingAttribute': {
		props[attribute.attribute] = attribute
		const result = componentArguments.set(attribute.attribute, true)
		if (result.is_err()) ctx.error('COMPONENT_INCLUSION_DUPLICATE_ARGUMENT', nameSpan, result.error[0])
		break
	}
	case 'SyncAttribute': {
		syncs[attribute.attribute] = attribute
		const result = componentArguments.set(attribute.attribute, true)
		if (result.is_err()) ctx.error('COMPONENT_INCLUSION_DUPLICATE_ARGUMENT', nameSpan, result.error[0])
		break
	}
	case 'EventAttribute':
		const { event, variety, code: rawCode } = attribute

		const presentFromOthers = componentArguments.get(event).default(false)
		if (presentFromOthers) ctx.error('COMPONENT_INCLUSION_DUPLICATE_ARGUMENT', event)
		else componentArguments.set(event, false)

		const code = variety === 'inline' ? `() => ${rawCode}` : rawCode
		events.get(event).push(new EventAttribute(event, variety, code))
		break
	case 'ReceiverAttribute':
		ctx.error('COMPONENT_INCLUSION_RECEIVER', nameSpan)
		break
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
		if (result.is_err())
			ctx.error('COMPONENT_INCLUSION_DUPLICATE_SLOT_INSERTION', nameSpan, result.error[0])
	}

	if (nonInsertEntities.length > 0) {
		const defaultInsertion = new SlotInsertion(undefined, undefined, nonInsertEntities as NonEmpty<Entity>)
		const result = slotInsertions.set('def', defaultInsertion)
		if (result.is_err())
			ctx.error('COMPONENT_INCLUSION_CONFLICTING_DEF_SLOT_INSERTION', nameSpan, result.error[0])
	}

	return ctx.Ok(() => new ComponentInclusion(
		name, props, syncs,
		events.into_dict() as Dict<NonEmpty<EventAttribute>>,
		slotInsertions.into_dict(),
	))
}
