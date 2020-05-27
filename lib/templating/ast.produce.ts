import { splitGuard, Dict, NonEmpty, OmitVariants } from '../utils'
import { ParseError, ParseWarning, ParseResult, Parse, Errors, Warnings } from './utils'
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
	value: string | AttributeCode | undefined, valueSpan: Span,
): ParseResult<Attribute> {
	const parse = new Parse<Attribute>()
	const [attribute, ...modifiersList] = rawAttribute.split('|')
	const modifiersUnique = new UniqueDict<true>()
	for (const modifier of modifiersList) {
		const result = modifiersUnique.set(modifier, true)
		if (result.is_err()) parse.warn(ParseWarning(rawAttributeSpan, `duplicate modifier ${result.error[0]}`, ""))
	}
	const modifiers = modifiersUnique.into_dict()

	if (attribute === '(node)') {
		if (!isAttributeCode(value))
			return parse.Err(Errors.requiresCode(valueSpan, 'node receivers'))
		Warnings.checkExtraneousModifiers(parse, rawAttributeSpan, modifiers, 'node receivers')
		return parse.Ok(() => new ReceiverAttribute(value))
	}

	// TODO remember that if an attribute contains dashes it's a dom attribute instead of property, and should be set differently

	const sliced = attribute.slice(1)

	const firstLetter = rawAttribute[0] || ''
	switch (firstLetter) {
	// case '*': /* check errors */ return new RefAttribute(sliced, 'deref')
	// case '&': /* check errors */ return new RefAttribute(sliced, 'ref')
	case '@':
		if (!isAttributeCode(value))
			return parse.Err(Errors.requiresCode(valueSpan, 'events'))

		const { isBare, code } = value
		const variety = isBare ? 'bare'
			: modifiers.handler ? 'handler'
			: 'inline'

		if (isBare && modifiers.handler)
			parse.warn(ParseWarning(rawAttributeSpan, 'redundant handler', "the handler modifier is meaningless on a bare attribute"))
		delete modifiers.handler
		Warnings.checkExtraneousModifiers(parse, rawAttributeSpan, modifiers, 'events')
		return parse.Ok(() => new EventAttribute(sliced, variety, code))

	case '!': {
		if (!isAttributeCode(value))
			return parse.Err(Errors.requiresCode(valueSpan, 'syncs'))
		if (modifiers.fake && modifiers.setter)
			return parse.Err(Errors.conflictingModifiers(rawAttributeSpan, "fake and setter cannot be used together"))

		const modifier = modifiers.fake ? SyncModifier.fake
			: modifiers.setter ? SyncModifier.setter
			: undefined
		delete modifiers.fake; delete modifiers.setter
		Warnings.checkExtraneousModifiers(parse, rawAttributeSpan, modifiers, 'syncs')

		return parse.Ok(() => new SyncAttribute(sliced, modifier, value))
	}

	case ':': {
		if (!isAttributeCode(value))
			return parse.Err(Errors.requiresCode(valueSpan, 'reactive bindings'))
		Warnings.checkExtraneousModifiers(parse, rawAttributeSpan, modifiers, 'reactive bindings')
		return parse.Ok(() => new BindingAttribute(sliced, { type: 'reactive', reactiveCode: value }))
	}

	default: switch (typeof value) {
		case 'undefined':
			Warnings.checkExtraneousModifiers(parse, rawAttributeSpan, modifiers, 'attributes')
			return parse.Ok(() => new BindingAttribute(attribute, { type: 'empty' }))
		case 'string':
			Warnings.checkExtraneousModifiers(parse, rawAttributeSpan, modifiers, 'attributes')
			return parse.Ok(() => new BindingAttribute(attribute, { type: 'static', value }))
		default:
			const initialModifier = modifiers.initial || false
			delete modifiers.initial
			Warnings.checkExtraneousModifiers(parse, rawAttributeSpan, modifiers, 'bindings')
			return parse.Ok(() => new BindingAttribute(attribute, { type: 'dynamic', code: value, initialModifier }))
	}}
}


const leafTags = ['br', 'input']
export function parseHtml(
	ident: string, metas: Meta[], tagSpan: Span,
	attributes: Attribute[], entities: Entity[],
): ParseResult<Html> {
	const parse = new Parse<Html>()

	if (entities.length > 0 && leafTags.includes(ident))
		parse.warn(Warnings.leafChildren(tagSpan, ident))

	const [syncs, nonSyncs] = splitGuard(attributes, (a): a is SyncAttribute => a.type === 'SyncAttribute')
	const tagAttributesResult = parse.subsume(parseTagAttributes(metas, tagSpan, nonSyncs))
	if (tagAttributesResult.is_err()) return parse.ret(tagAttributesResult.error)
	const tagAttributes = tagAttributesResult.value

	if (syncs.length === 0)
		return parse.Ok(() => new Tag(ident, tagAttributes, entities))

	if (syncs.length !== 1) return parse.Err(Errors.invalidTagSync(tagSpan, "only a single '!sync' is allowed on a primitive tag"))
	const [sync] = syncs
	if (sync.attribute !== 'sync')
		return parse.Err(Errors.invalidTagSync(tagSpan, `the only sync allowed on primitive tags is 'sync'`))
	if (sync.modifier !== undefined)
		return parse.Err(Errors.invalidModifier(tagSpan, `the 'fake' and 'setter' modifiers are meaningless on primitive tags`))

	switch (ident) {
	case 'input':
		const typeBindingAttribute = nonSyncs.find((a): a is BindingAttribute => a.type === 'BindingAttribute' && a.attribute === 'type')
		const typeBinding = typeBindingAttribute ? typeBindingAttribute.value : undefined

		if (typeBinding && typeBinding.type !== 'static')
			return parse.Err(ParseError(tagSpan, 'unsupported unknown input type', "'!sync' on input can only be used when 'type' is known"))

		if (typeBinding === undefined || typeBinding.value === 'text')
			return parse.Ok(() => new SyncedTextInput(false, sync.code, tagAttributes))

		if (typeBinding.value === 'checkbox') {
			const valueBindingAttribute = nonSyncs.find((a): a is BindingAttribute => a.type === 'BindingAttribute' && a.attribute === 'value')
			const valueBinding = valueBindingAttribute ? valueBindingAttribute.value : undefined
			if (!valueBinding || isInertBindingValue(valueBinding))
				return parse.Ok(() => new SyncedCheckboxInput(sync.code, valueBinding, tagAttributes))
			return parse.Err(ParseError(tagSpan, 'invalid sync checkbox value', ""))
		}

		if (typeBinding.value === 'radio') {
			const valueBindingAttribute = nonSyncs.find((a): a is BindingAttribute => a.type === 'BindingAttribute' && a.attribute === 'value')
			const valueBinding = valueBindingAttribute ? valueBindingAttribute.value : undefined
			if (valueBinding && isInertBindingValue(valueBinding))
				return parse.Ok(() => new SyncedRadioInput(sync.code, valueBinding, tagAttributes))

			return parse.Err(ParseError(tagSpan, 'invalid sync radio value', ""))
		}

		return parse.Err(ParseError(tagSpan, 'unsupported input type', 'only text, checkbox, radio are supported with !sync'))

	case 'textarea':
		return parse.Ok(() => new SyncedTextInput(true, sync.code, tagAttributes))

	case 'select':
		const multipleBindingAttribute = nonSyncs.find((a): a is BindingAttribute => a.type === 'BindingAttribute' && a.attribute === 'multiple')
		const multipleBinding = multipleBindingAttribute ? multipleBindingAttribute.value : undefined
		if (!multipleBinding || multipleBinding.type === 'empty')
			return parse.Ok(() => new SyncedSelect(sync.code, !!multipleBinding, tagAttributes))
		return parse.Err(Errors.invalidSelectMultiple(tagSpan))

	default:
		return parse.Err(Errors.invalidTagSync(tagSpan, `'!sync' isn't allowed on ${ident}`))
	}
}

export function parseTagAttributes(
	metas: Meta[], identSpan: Span,
	attributes: Exclude<Attribute, SyncAttribute>[],
) {
	const parse = new Parse<TagAttributes>()

	const bindings = new UniqueDict<BindingAttribute>()
	const events = new DefaultDict(() => [] as EventAttribute[])
	const receivers: ReceiverAttribute[] = []

	for (const attribute of attributes) switch (attribute.type) {
	case 'BindingAttribute': {
		const result = bindings.set(attribute.attribute, attribute)
		if (result.is_err())
			parse.error(ParseError(identSpan, `duplicate binding ${result.error[0]}`, ""))
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

	return parse.Ok(() => new TagAttributes(metas, bindings.into_dict(), events.into_dict() as Dict<NonEmpty<EventAttribute>>, receivers))
}

export function parseComponentInclusion(
	name: string, nameSpan: Span,
	attributes: Attribute[],
	entities: (Entity | SlotInsertion)[],
): ParseResult<ComponentInclusion> {
	const parse = new Parse<ComponentInclusion>()

	const componentArguments = new UniqueDict<boolean>()
	const props = {} as Dict<BindingAttribute>
	const syncs = {} as Dict<SyncAttribute>
	const events = new DefaultDict(() => [] as EventAttribute[])
	const receivers: ReceiverAttribute[] = []

	for (const attribute of attributes) switch (attribute.type) {
	case 'BindingAttribute': {
		props[attribute.attribute] = attribute
		const result = componentArguments.set(attribute.attribute, true)
		if (result.is_err()) parse.error(ParseError(nameSpan, `duplicate component argument ${result.error[0]}`, ""))
		break
	}
	case 'SyncAttribute': {
		syncs[attribute.attribute] = attribute
		const result = componentArguments.set(attribute.attribute, true)
		if (result.is_err()) parse.error(ParseError(nameSpan, `duplicate component argument ${result.error[0]}`, ""))
		break
	}
	case 'EventAttribute':
		const { event, variety, code: rawCode } = attribute

		const presentFromOthers = componentArguments.get(event).default(false)
		if (presentFromOthers) parse.error(ParseError(nameSpan, `duplicate component argument ${event}`, ""))
		else componentArguments.set(event, false)

		const code = variety === 'inline' ? `() => ${rawCode}` : rawCode
		events.get(event).push(new EventAttribute(event, variety, code))
		break
	case 'ReceiverAttribute':
		parse.error(ParseError(nameSpan, "receivers don't make any sense on components", ""))
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
			parse.error(ParseError(nameSpan, 'duplicate slot insertion', name))
	}

	if (nonInsertEntities.length > 0) {
		const defaultInsertion = new SlotInsertion(undefined, undefined, nonInsertEntities as NonEmpty<Entity>)
		const result = slotInsertions.set('def', defaultInsertion)
		if (result.is_err())
			parse.error(ParseError(nameSpan, 'conflicting default', "can't use an explicit default slot insert and nodes outside of a slot insert"))
	}

	return parse.Ok(() => new ComponentInclusion(
		name, props, syncs,
		events.into_dict() as Dict<NonEmpty<EventAttribute>>,
		slotInsertions.into_dict(),
	))
}
