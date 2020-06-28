import '@ts-std/extensions/dist/array'
import { Span, Spanned } from 'kreia/dist/runtime/lexer'
import { UniqueDict, UniqueValue, DefaultDict } from '@ts-std/collections'

import { Context, Warnings, ParseResult, unspan } from './utils'
import { splitGuard, Dict, NonEmpty, OmitVariants, exec } from '../utils'
import {
	ComponentDefinition, CTXFN, Entity, Html, Tag, TagAttributes, LivenessType, LiveCode, AssignedLiveCode,
	IdMeta, ClassMeta, AttributeCode, TextSection, TextItem,
	BindingAttribute, BindingValue, ExistentBindingValue, InertBindingValue, EventAttribute, ReceiverAttribute, /*RefAttribute,*/ Attribute,
	SyncedTextInput, SyncedCheckboxInput, SyncedRadioInput, SyncedSelect, SyncModifier, SyncAttribute,
	Directive, ComponentInclusion, IfBlock, /*ForBlock,*/ EachBlock, MatchBlock, SwitchBlock, SwitchCase, SwitchDefault,
	SlotUsage, SlotInsertion, TemplateDefinition, TemplateInclusion,
} from './ast'


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

function removeSlotInsertions(ctx: Context<unknown>, rawEntities: (Spanned<Entity | SlotInsertion>)[]) {
	const entities = [] as Entity[]
	for (const { item: entity, span } of rawEntities) {
		if (entity.type !== 'SlotInsertion')
			entities.push(entity)
		else
			ctx.error('INVALID_SLOT_INSERTION', span)
	}
	return entities
}

export type ComponentDefinitionTypes = { props: string[], events: string[], syncs: string[], slots: Dict<boolean> }
export function parseComponentDefinition(
	component: ComponentDefinitionTypes | undefined,
	createFn: NonEmpty<string> | CTXFN | undefined,
	rawEntities: (Spanned<Entity | SlotInsertion>)[],
) {
	const ctx = new Context<ComponentDefinition>()

	// TODO here's where we'd add backfilled slots
	// const foundSlots = new UniqueDict<[boolean, string | undefined]>()
		// if (entity.type === 'SlotUsage') {
		// 	const slotName = entity.name || 'def'
		// 	// foundSlots.set(slotName, [entity.fallback !== undefined, entity.argsExpression])
		// 	const optional = component && component.slots[slotName]
		// 	// if (!component && optional === undefined) {
		// 	if (optional === undefined) {
		// 		ctx.error('COMPONENT_USAGE_NONEXISTENT_SLOT', span)
		// 		continue
		// 	}
		// 	if (!optional && entity.fallback !== undefined)
		// 		ctx.warn('COMPONENT_USAGE_REDUNDANT_FALLBACK', span)
		// }
	const entities = removeSlotInsertions(ctx, rawEntities)

	const { props = [], syncs = [], events = [], slots = {} } = component || {}
	// slots = foundSlots.into_dict()
	return ctx.Ok(() => new ComponentDefinition(props, syncs, events, slots, createFn, entities))
}

function cleanResults<T>(results: ParseResult<T>[]) {
	const ctx = new Context<T[]>()
	const items = [] as T[]
	for (const result of results) {
		const r = ctx.take(result)
		if (r.is_err()) continue
		items.push(r.value)
	}
	return ctx.Ok(() => items)
}

export type InclusionDescriptor = {
	type: 'inclusion', name: string, span: Span,
	params: ParseResult<Spanned<Attribute>>[],
}
export function parseComponentInclusion(
	{ name, span: nameSpan, params }: InclusionDescriptor,
	rawEntities: Spanned<(Entity | SlotInsertion)>[],
) {
	const ctx = new Context<Spanned<ComponentInclusion>>()
	const attributesResult = ctx.subsume(cleanResults(params))
	if (attributesResult.is_err()) return ctx.subsumeFail(attributesResult.error)
	const attributes = attributesResult.value

	const componentArguments = new UniqueDict<[boolean, Span]>()
	const props = {} as Dict<BindingAttribute>
	const syncs = {} as Dict<SyncAttribute>
	const events = new DefaultDict(() => [] as EventAttribute[])
	const receivers: ReceiverAttribute[] = []

	for (const { item: attribute, span } of attributes) switch (attribute.type) {
	case 'BindingAttribute': {
		props[attribute.attribute] = attribute
		const result = componentArguments.set(attribute.attribute, [true, span])
		if (result.is_err()) ctx.error('COMPONENT_INCLUSION_DUPLICATE_ARGUMENT', span, result.error[2][1])
		break
	}
	case 'SyncAttribute': {
		syncs[attribute.attribute] = attribute
		const result = componentArguments.set(attribute.attribute, [true, span])
		if (result.is_err()) ctx.error('COMPONENT_INCLUSION_DUPLICATE_ARGUMENT', span, result.error[2][1])
		break
	}
	case 'EventAttribute':
		const { event, variety, code: untrimmedCode } = attribute
		const rawCode = untrimmedCode.trim()

		const previous = componentArguments.get(event)
		if (previous.is_some() && previous.value[0]) ctx.error('COMPONENT_INCLUSION_DUPLICATE_ARGUMENT', span, previous.value[1])
		else componentArguments.set(event, [false, span])

		const code = variety === 'inline' ? `() => ${rawCode}` : rawCode
		events.get(event).push(new EventAttribute(event, variety, code))
		break
	case 'ReceiverAttribute':
		ctx.error('COMPONENT_INCLUSION_RECEIVER', span)
		break
	}


	const nonInsertEntities = [] as Entity[]
	const slotInsertions = new UniqueDict<[SlotInsertion, Span]>()
	for (const { item: entity, span } of rawEntities) {
		if (entity.type !== 'SlotInsertion') {
			nonInsertEntities.push(entity)
			continue
		}

		const name = entity.name || 'def'
		const result = slotInsertions.set(name, [entity, span])
		if (result.is_err())
			ctx.error('COMPONENT_INCLUSION_DUPLICATE_SLOT_INSERTION', span, result.error[2][1])
	}

	const slotInsertionsDict = slotInsertions.into_dict()
	if (nonInsertEntities.length > 0) {
		const defaultInsertion = new SlotInsertion(undefined, undefined, nonInsertEntities as Entity[])
		const previous = slotInsertionsDict['def']
		if (previous !== undefined)
			return ctx.Err('COMPONENT_INCLUSION_CONFLICTING_DEF_SLOT_INSERTION', previous[1])

		slotInsertionsDict['def'] = [defaultInsertion, undefined as unknown as Span]
	}

	return ctx.Ok(() => Spanned(new ComponentInclusion(
		name, props, syncs,
		events.into_dict() as Dict<NonEmpty<EventAttribute>>,
		slotInsertions.entries().reduce((acc, [k, [v, ]]) => { acc[k] = v; return acc }, {} as Dict<SlotInsertion>),
	), nameSpan))
}


function isAttributeCode(v: string | AttributeCode | undefined): v is AttributeCode {
	return !!v && v instanceof AttributeCode
}
function isInertBindingValue(v: BindingValue): v is InertBindingValue {
	return v.type !== 'empty' && v.type !== 'reactive'
}

export function parseReactive(expression: string): [boolean, string] {
	return expression.startsWith(':') ? [true, expression.slice(1)] : [false, expression]
}
export function parseLiveCode(expression: string): LiveCode {
	const [reactive, code] = parseReactive(expression)
	return new LiveCode(reactive, code)
}
export function parseLiveness(expression: string): [Exclude<LivenessType, LivenessType.static>, string] {
	const [reactive, code] = parseReactive(expression)
	return [reactive ? LivenessType.reactive : LivenessType.dynamic, code]
}

export function AssignableLiveCode(rawExpression: string) {
	const [reactive, expression] = parseReactive(rawExpression)
	if (!reactive)
		return new LiveCode(reactive, expression)

	const [firstSegment, ...restSegments] = expression.split(/ += +/)
	if (restSegments.length === 0)
		return new LiveCode(reactive, expression)

	return new AssignedLiveCode(firstSegment, restSegments.join(' = '))
}

export function parseDynamicMeta(isClass: true, rawContent: string): ClassMeta
export function parseDynamicMeta(isClass: false, rawContent: string): IdMeta
export function parseDynamicMeta(isClass: boolean, rawContent: string) {
	const [liveness, content] = parseLiveness(rawContent)
	return new (isClass ? ClassMeta : IdMeta)(liveness, content)
}
export function parseMeta(rawContent: string) {
	return new (rawContent.startsWith('.') ? ClassMeta : IdMeta)(LivenessType.static, rawContent.slice(1))
}
export function parseDynamicTextSection(rawContent: string) {
	const [liveness, content] = parseLiveness(rawContent)
	return new TextItem(liveness, content)
}
export function parseTextSection(content: string) {
	return new TextItem(LivenessType.static, content)
}

export function parseAttribute(
	{ item: rawAttribute, span: rawAttributeSpan }: Spanned<string>,
	valueSpanned: Spanned<string | AttributeCode> | undefined,
): ParseResult<Spanned<Attribute>> {
	const [value, valueSpan] = valueSpanned
		? [valueSpanned.item, valueSpanned.span]
		: [undefined, undefined]
	const totalSpan = valueSpan
		? Span.around(rawAttributeSpan, valueSpan)
		: rawAttributeSpan

	const ctx = new Context<Spanned<Attribute>>()
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
		return ctx.Ok(() => Spanned(new ReceiverAttribute(value), totalSpan))
	}

	// TODO remember that if an attribute contains dashes it's a dom attribute instead of property, and should be set differently

	const sliced = attribute.slice(1)

	const firstLetter = rawAttribute[0] || ''
	switch (firstLetter) {
	// case '*': /* check errors */ return new RefAttribute(sliced, 'deref')
	// case '&': /* check errors */ return new RefAttribute(sliced, 'ref')
	case '@':
		if (!isAttributeCode(value))
			return ctx.Err('REQUIRES_CODE', valueSpan || rawAttributeSpan, 'events')

		const { isBare, code } = value
		const variety = isBare ? 'bare'
			: modifiers.handler ? 'handler'
			: 'inline'

		if (isBare && modifiers.handler)
			ctx.warn('REDUNDANT_HANDLER_BARE', rawAttributeSpan)
		delete modifiers.handler
		Warnings.checkExtraneousModifiers(ctx, rawAttributeSpan, modifiers, 'events')
		return ctx.Ok(() => Spanned(new EventAttribute(sliced, variety, code), totalSpan))

	case '!': {
		if (!isAttributeCode(value))
			return ctx.Err('REQUIRES_CODE', valueSpan || rawAttributeSpan, 'syncs')
		if (modifiers.fake && modifiers.setter)
			return ctx.Err('CONFLICTING_MODIFIERS_FAKE_SETTER', rawAttributeSpan)

		const modifier = modifiers.fake ? SyncModifier.fake
			: modifiers.setter ? SyncModifier.setter
			: undefined
		// TODO possibly get mad about value.isBare when modifiers.setter is also true?
		delete modifiers.fake; delete modifiers.setter
		Warnings.checkExtraneousModifiers(ctx, rawAttributeSpan, modifiers, 'syncs')

		return ctx.Ok(() => Spanned(new SyncAttribute(sliced, modifier, value), totalSpan))
	}

	case ':': {
		if (!isAttributeCode(value))
			return ctx.Err('REQUIRES_CODE', valueSpan || rawAttributeSpan, 'reactive bindings')
		Warnings.checkExtraneousModifiers(ctx, rawAttributeSpan, modifiers, 'reactive bindings')
		return ctx.Ok(() => Spanned(new BindingAttribute(sliced, { type: 'reactive', reactiveCode: value }), totalSpan))
	}

	default: switch (typeof value) {
		case 'undefined':
			Warnings.checkExtraneousModifiers(ctx, rawAttributeSpan, modifiers, 'attributes')
			return ctx.Ok(() => Spanned(new BindingAttribute(attribute, { type: 'empty' }), totalSpan))
		case 'string':
			Warnings.checkExtraneousModifiers(ctx, rawAttributeSpan, modifiers, 'attributes')
			return ctx.Ok(() => Spanned(new BindingAttribute(attribute, { type: 'static', value }), totalSpan))
		default:
			const initialModifier = modifiers.initial || false
			delete modifiers.initial
			Warnings.checkExtraneousModifiers(ctx, rawAttributeSpan, modifiers, 'bindings')
			return ctx.Ok(() => Spanned(new BindingAttribute(attribute, { type: 'dynamic', code: value, initialModifier }), totalSpan))
	}}
}


const leafTags = ['br', 'input']
export type TagDescriptor = {
	type: 'tag', ident: string, span: Span, metas: Spanned<IdMeta | ClassMeta>[],
	attributes: ParseResult<Spanned<Attribute>>[],
}
export function parseHtml(
	{ ident, span: tagSpan, metas, attributes: attributesResultArray, }: TagDescriptor,
	rawEntities: (Spanned<Entity | SlotInsertion>)[],
) {
	const ctx = new Context<Spanned<Html>>()
	const attributesResult = ctx.subsume(cleanResults(attributesResultArray))
	if (attributesResult.is_err()) return ctx.subsumeFail(attributesResult.error)
	const attributes = attributesResult.value

	const entities = removeSlotInsertions(ctx, rawEntities)
	if (entities.length > 0 && leafTags.includes(ident))
		ctx.warn('LEAF_CHILDREN', tagSpan, ident)

	const [syncs, nonSyncs] = splitGuard(attributes, (a): a is Spanned<SyncAttribute> => a.item.type === 'SyncAttribute')
	const tagAttributesResult = ctx.subsume(parseTagAttributes(
		metas, tagSpan,
		nonSyncs as unknown as Spanned<BindingAttribute | EventAttribute | ReceiverAttribute>[],
	))
	if (tagAttributesResult.is_err()) return ctx.subsumeFail(tagAttributesResult.error)
	const tagAttributes = tagAttributesResult.value

	if (syncs.length === 0)
		return ctx.Ok(() => Spanned(new Tag(ident, tagAttributes, entities), tagSpan))

	if (syncs.length !== 1) return ctx.Err('INVALID_TAG_SYNC_MULTIPLE', tagSpan)
	const [{ item: sync, span: syncSpan }] = syncs
	if (sync.attribute !== 'sync')
		return ctx.Err('INVALID_TAG_SYNC_INVALID', syncSpan)
	if (sync.modifier !== undefined)
		return ctx.Err('INVALID_TAG_SYNC_MODIFIER', syncSpan)

	switch (ident) {
	case 'input':
		const typeBindingAttribute = nonSyncs.find((a): a is Spanned<BindingAttribute> => a.item.type === 'BindingAttribute' && a.item.attribute === 'type')
		const typeBinding = typeBindingAttribute ? typeBindingAttribute.item.value : undefined

		if (typeBinding && typeBinding.type !== 'static')
			return ctx.Err('INPUT_TAG_SYNC_NOT_KNOWN_TYPE', tagSpan)

		if (typeBinding === undefined || ['text', 'password', 'search'].includes(typeBinding.value))
			return ctx.Ok(() => Spanned(new SyncedTextInput(false, sync.code, tagAttributes), tagSpan))

		if (typeBinding.value === 'checkbox') {
			const valueBindingAttribute = nonSyncs.find((a): a is Spanned<BindingAttribute> => a.item.type === 'BindingAttribute' && a.item.attribute === 'value')
			const valueBinding = valueBindingAttribute ? valueBindingAttribute.item.value : undefined
			if (!valueBinding || isInertBindingValue(valueBinding))
				return ctx.Ok(() => Spanned(new SyncedCheckboxInput(sync.code, valueBinding, tagAttributes), tagSpan))
			return ctx.Err('INPUT_TAG_SYNC_CHECKBOX_NOT_KNOWN_VALUE', valueBindingAttribute ? valueBindingAttribute.span : tagSpan)
		}

		if (typeBinding.value === 'radio') {
			const valueBindingAttribute = nonSyncs.find((a): a is Spanned<BindingAttribute> => a.item.type === 'BindingAttribute' && a.item.attribute === 'value')
			const valueBinding = valueBindingAttribute ? valueBindingAttribute.item.value : undefined
			if (valueBinding && isInertBindingValue(valueBinding))
				return ctx.Ok(() => Spanned(new SyncedRadioInput(sync.code, valueBinding, tagAttributes), tagSpan))

			return ctx.Err('INPUT_TAG_SYNC_RADIO_NOT_KNOWN_VALUE', valueBindingAttribute ? valueBindingAttribute.span : syncSpan)
		}

		return ctx.Err('INPUT_TAG_SYNC_UNSUPPORTED_TYPE', typeBindingAttribute!.span)

	case 'textarea':
		return ctx.Ok(() => Spanned(new SyncedTextInput(true, sync.code, tagAttributes), tagSpan))

	case 'select':
		const multipleBindingAttribute = nonSyncs.find((a): a is Spanned<BindingAttribute> => a.item.type === 'BindingAttribute' && a.item.attribute === 'multiple')
		const multipleBinding = multipleBindingAttribute ? multipleBindingAttribute.item.value : undefined
		if (!multipleBinding || multipleBinding.type === 'empty')
			return ctx.Ok(() => Spanned(new SyncedSelect(sync.code, !!multipleBinding, tagAttributes, entities), tagSpan))
		return ctx.Err('INPUT_TAG_SYNC_SELECT_INVALID_MULTIPLE', multipleBindingAttribute ? multipleBindingAttribute.span : syncSpan)

	default:
		return ctx.Err('INVALID_SYNCED_TAG', syncSpan)
	}
}

export function parseTagAttributes(
	metas: Spanned<IdMeta | ClassMeta>[], identSpan: Span,
	attributes: Spanned<Exclude<Attribute, SyncAttribute>>[],
) {
	const ctx = new Context<TagAttributes>()

	const idMeta = new UniqueValue<[IdMeta, Span]>()
	// const classMetas = [] as ClassMeta[]
	const classMetas = new UniqueDict<[ClassMeta, Span]>()
	// const staticClasses = new UniqueDict<Span>()
	for (const { item: meta, span } of metas) switch (meta.type) {
	case 'IdMeta': {
		const result = idMeta.set([meta, span])
		if (result.is_err())
			ctx.warn('TAG_DUPLICATE_ID', span, result.error[1][1])
		break
	}
	case 'ClassMeta':
		const result = classMetas.set(`${meta.liveness}${meta.value}`, [meta, span])
		if (result.is_err()) {
			ctx.warn('TAG_DUPLICATE_CLASS_META', span, result.error[2][1])
			continue
		}
	}

	const bindings = new UniqueDict<[BindingAttribute, Span]>()
	const events = new DefaultDict(() => [] as EventAttribute[])
	const receivers: ReceiverAttribute[] = []
	for (const { item: attribute, span } of attributes) switch (attribute.type) {
	case 'BindingAttribute': {
		if (['class', 'className'].includes(attribute.attribute))
			ctx.error('TAG_CLASS_ATTRIBUTE', span)
		if (attribute.attribute === 'id')
			ctx.error('TAG_ID_ATTRIBUTE', span)

		const result = bindings.set(attribute.attribute, [attribute, span])
		if (result.is_err())
			ctx.error('TAG_DUPLICATE_BINDING', span, result.error[2][1])
		break
	}
	case 'EventAttribute':
		const { event, variety, code: untrimmedCode } = attribute
		const rawCode = untrimmedCode.trim()
		const code = variety === 'inline' ? `$event => ${rawCode}` : rawCode
		events.get(event).push(new EventAttribute(event, variety, code))
		break

	case 'ReceiverAttribute':
		receivers.push(attribute)
		break
	}

	const bindingsDict = bindings.entries().map(([k, [v, ]]) => [k, v] as [string, BindingAttribute]).entries_to_dict()
	return ctx.Ok(() => new TagAttributes(
		idMeta.get().change(unspan).to_undef(), classMetas.values().map(unspan), bindingsDict,
		events.into_dict() as Dict<NonEmpty<EventAttribute>>, receivers,
	))
}


function processInsertableCode(
	isSlot: boolean, code: string | undefined, span: Span,
): ParseResult<[string | undefined, string | undefined]> {
	if (code === undefined || code.trim() === '')
		return Context.Ok([undefined, undefined])

	const [nameSection, ...codeSections] = code.split(/; */)
	if (isSlot && !/^&\S+$/.test(nameSection))
		return Context.Err('INVALID_SLOT_NAME', span)

	const argsExpression = codeSections.join('; ')
	return Context.Ok([isSlot ? nameSection.slice(1) : nameSection, argsExpression])
}


type InProgressDirective = InProgressIf | InProgressMatch | InProgressSwitch
type InProgressIf = {
	type: 'if', span: Span, expression: string, entities: Entity[],
	elseIfBranches: [LiveCode, Entity[]][], elseBranch: Entity[] | undefined,
}
type InProgressMatch = {
	type: 'match', span: Span, matchExpression: string,
	patterns: [LiveCode, Entity[]][], defaultPattern: Entity[] | undefined,
}
type InProgressSwitch = {
	type: 'switch', span: Span, switchExpression: string,
	cases: (SwitchCase | SwitchDefault)[],
}

export type DirectiveDescriptor = { type: 'directive', command: string, span: Span, code: string | undefined }
export type DirectivePending = DirectiveDescriptor & { rawEntities: (Spanned<Entity | SlotInsertion>)[] }
export type FinalizableEntity =
	| { ready: true, entity: Spanned<Entity> }
	| { ready: false, pending: DirectivePending | NonEmpty<Spanned<TextItem>> }

export function parseEntities(finalizables: (ParseResult<FinalizableEntity> | undefined)[]) {
	const ctx = new Context<(Spanned<Entity | SlotInsertion>)[]>()
	const giveEntities = [] as (Spanned<Entity | SlotInsertion>)[]

	let inProgressTextSection = undefined as NonEmpty<Spanned<TextItem>> | undefined
	function finalizeInProgressTextSection() {
		if (inProgressTextSection === undefined) return

		const span = inProgressTextSection.length === 1
			? inProgressTextSection[0].span
			: Span.around(inProgressTextSection[0].span, inProgressTextSection[inProgressTextSection.length - 1].span)
		giveEntities.push(Spanned(new TextSection(inProgressTextSection.map(unspan) as NonEmpty<TextItem>), span))
		inProgressTextSection = undefined
	}
	let inProgressDirective = undefined as InProgressDirective | undefined
	function finalizeInProgressDirective() {
		if (inProgressDirective === undefined) return

		switch (inProgressDirective.type) {
			case 'if': {
				const { expression, span, entities, elseIfBranches, elseBranch } = inProgressDirective
				giveEntities.push(Spanned(new IfBlock(parseLiveCode(expression), entities, elseIfBranches, elseBranch), span))
				break
			}
			case 'match': {
				const { matchExpression, span, patterns, defaultPattern } = inProgressDirective
				giveEntities.push(Spanned(new MatchBlock(AssignableLiveCode(matchExpression), patterns, defaultPattern), span))
				break
			}
			case 'switch':
				const { switchExpression, span, cases } = inProgressDirective
				if (cases.length === 0)
					return ctx.error('SWITCH_NO_CASES', span)
				giveEntities.push(Spanned(new SwitchBlock(AssignableLiveCode(switchExpression), cases), span))
				break
		}
	}
	function finalize() {
		finalizeInProgressTextSection()
		finalizeInProgressDirective()
	}

	for (const finalizableResult of finalizables) {
		// we don't finalize on comments since they could be separating different parts of a contiguous section
		if (finalizableResult === undefined) continue

		const result = ctx.take(finalizableResult)
		if (result.is_err()) continue
		const finalizable = result.value

		if (finalizable.ready) {
			finalize()
			giveEntities.push(finalizable.entity)
			continue
		}
		const item = finalizable.pending

		// NonEmpty<Spanned<TextItem>>
		if (Array.isArray(item)) {
			finalizeInProgressDirective()
			inProgressTextSection = (inProgressTextSection || [] as Spanned<TextItem>[]).concat(item) as NonEmpty<Spanned<TextItem>>
			continue
		}

		const { command, code, span, rawEntities } = item
		const entities = removeSlotInsertions(ctx, rawEntities)
		switch (command) {
			case 'if':
				finalize()
				if (code === undefined)
					return ctx.Err('IF_NO_EXPRESSION', span)
				inProgressDirective = {
					type: 'if', span, expression: code,
					entities, elseIfBranches: [], elseBranch: undefined,
				} as InProgressIf
				break
			case 'elseif':
				if (inProgressDirective === undefined || inProgressDirective.type !== 'if')
					return ctx.Err('IF_UNPRECEDED_ELSEIF', span)
				if (code === undefined)
					return ctx.Err('IF_NO_EXPRESSION', span)
				inProgressDirective.elseIfBranches.push([parseLiveCode(code), entities])
				break
			case 'else':
				if (inProgressDirective === undefined || inProgressDirective.type !== 'if')
					return ctx.Err('IF_UNPRECEDED_ELSE', span)
				if (code !== undefined)
					// TODO would be great to specifically have code span here
					return ctx.Err('IF_ELSE_CONDITION', span)
				inProgressDirective.elseBranch = entities
				finalizeInProgressDirective()
				break

			case 'each':
				finalize()
				function processEachBlockCode(code: string): [EachBlock['params'], string] {
					const [paramsSection, ...remainingSections] = code.split(/ +of +/)
					const paramsMatch = paramsSection.match(/\( *(\S+) *, *(\S+) *\)/)
					const [variableCode, indexCode] = paramsMatch === null
						? [paramsSection, undefined]
						: [paramsMatch[1], paramsMatch[2]]

					return [{ variableCode, indexCode }, remainingSections.join(' of ')]
				}
				if (code === undefined)
					return ctx.Err('EACH_NO_EXPRESSION', span)
				const [paramsExpression, listExpression] = processEachBlockCode(code)
				giveEntities.push(Spanned(new EachBlock(paramsExpression, parseLiveCode(listExpression), entities), span))
				break

			case 'match':
				finalize()
				if (entities.length > 0)
					return ctx.Err('MATCH_NESTED_ENTITIES', span)
				if (code === undefined)
					return ctx.Err('MATCH_NO_EXPRESSION', span)
				inProgressDirective = { type: 'match', span, matchExpression: code, patterns: [], defaultPattern: undefined } as InProgressMatch
				break
			case 'when':
				if (inProgressDirective === undefined || inProgressDirective.type !== 'match')
					return ctx.Err('MATCH_UNPRECEDED_WHEN', span)
				if (code === undefined)
					return ctx.Err('WHEN_NO_EXPRESSION', span)
				inProgressDirective.patterns.push([parseLiveCode(code), entities])
				break

			case 'switch':
				finalize()
				if (entities.length > 0)
					return ctx.Err('SWITCH_NESTED_ENTITIES', span)
				if (code === undefined)
					return ctx.Err('SWITCH_NO_EXPRESSION', span)
				inProgressDirective = { type: 'switch', span, switchExpression: code, cases: [] } as InProgressSwitch
				break
			case 'case':
			case 'fallcase':
				if (inProgressDirective === undefined || inProgressDirective.type !== 'switch')
					return ctx.Err('SWITCH_UNPRECEDED_CASE', span)
				if (code === undefined)
					return ctx.Err('CASE_NO_EXPRESSION', span)
				inProgressDirective.cases.push(new SwitchCase(command === 'fallcase', parseLiveCode(code), entities))
				break
			case 'falldefault':
				if (inProgressDirective === undefined || inProgressDirective.type !== 'switch')
					return ctx.Err('SWITCH_UNPRECEDED_CASE', span)
				if (code !== undefined) {
					// TODO would be great to specifically have code span here
					ctx.error('SWITCH_DEFAULT_CONDITION', span)
					break
				}
				inProgressDirective.cases.push(new SwitchDefault(true, entities))
				break

			// belongs to both switch and match
			case 'default':
				if (code !== undefined) {
					// TODO would be great to specifically have code span here
					ctx.error('SWITCH_DEFAULT_CONDITION', span)
					break
				}
				if (inProgressDirective === undefined)
					return ctx.Err('SWITCH_UNPRECEDED_DEFAULT', span)
				switch (inProgressDirective.type) {
					case 'if':
						ctx.error('SWITCH_UNPRECEDED_DEFAULT', span)
						break
					case 'match':
						if (inProgressDirective.defaultPattern !== undefined) {
							ctx.error('MATCH_DUPLICATE_DEFAULT', span)
							break
						}
						inProgressDirective.defaultPattern = entities
						break
					case 'switch':
						inProgressDirective.cases.push(new SwitchDefault(false, entities))
						break
				}
				break

			case 'slot': {
				finalize()
				const result = ctx.subsume(processInsertableCode(true, code, span))
				if (result.is_err()) return ctx.subsumeFail(result.error)
				const [slotName, argsExpression] = result.value
				giveEntities.push(Spanned(new SlotUsage(slotName, argsExpression, NonEmpty.undef(entities)), span))
				break
			}
			case 'insert': {
				finalize()
				const result = ctx.subsume(processInsertableCode(true, code, span))
				if (result.is_err()) return ctx.subsumeFail(result.error)
				const [slotName, paramsExpression] = result.value
				// giveSlotInsertions.push(new SlotInsertion(slotName, paramsExpression, entities))
				giveEntities.push(Spanned(new SlotInsertion(slotName, paramsExpression, entities), span))
				break
			}

			case 'template': {
				finalize()
				const result = ctx.subsume(processInsertableCode(false, code, span))
				if (result.is_err()) return ctx.subsumeFail(result.error)
				const [templateName, argsExpression] = result.value
				if (templateName === undefined) {
					ctx.error('TEMPLATE_NAMELESS', span)
					break
				}
				giveEntities.push(Spanned(new TemplateDefinition(templateName, argsExpression, entities), span))
				break
			}
			case 'include': {
				finalize()
				const result = ctx.subsume(processInsertableCode(false, code, span))
				if (result.is_err()) return ctx.subsumeFail(result.error)
				const [templateName, argsExpression] = result.value
				if (templateName === undefined) {
					ctx.error('INCLUDE_NAMELESS', span)
					break
				}
				giveEntities.push(Spanned(new TemplateInclusion(templateName, argsExpression), span))
				break
			}

			default:
				ctx.error('UNKNOWN_DIRECTIVE', span)
		}
	}
	finalize()

	return ctx.Ok(() => giveEntities)
}
