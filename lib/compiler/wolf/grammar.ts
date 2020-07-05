import { Ok } from '@ts-std/monads'
import { Parser, ParseArg, Decidable, path, branch, c } from 'kreia'
import { IndentationLexer } from 'kreia/dist/virtual_lexers/IndentationLexer'
import { Token, RawToken, Span, Spanned, TokenSpanned } from 'kreia/dist/runtime/lexer'

import { NonEmpty } from '../../utils'
import { Context, ParseResult, unspan } from '../utils'

import {
	ComponentDefinition, CTXFN, Entity, Html, Tag, TagAttributes, LivenessType, LiveCode, AssignedLiveCode,
	IdMeta, ClassMeta, AttributeCode, TextSection, TextItem,
	BindingAttribute, BindingValue, ExistentBindingValue, InertBindingValue, EventAttribute, ReceiverAttribute, /*RefAttribute,*/ Attribute,
	SyncedTextInput, SyncedCheckboxInput, SyncedRadioInput, SyncedSelect, SyncModifier, SyncAttribute,
	Directive, ComponentInclusion, IfBlock, /*ForBlock,*/ EachBlock, MatchBlock, SwitchBlock, SwitchCase, SwitchDefault,
	SlotUsage, SlotInsertion, TemplateDefinition, TemplateInclusion,
} from '../ast'
import {
	parseAttribute, parseHtml, parseTagAttributes, parseComponentInclusion,
	parseDynamicMeta, parseMeta, parseDynamicTextSection, parseTextSection,
	TagDescriptor, InclusionDescriptor, DirectiveDescriptor, DirectivePending, FinalizableEntity, parseEntities,
} from '../ast.parse'

export const { tok, reset, lock, consume, maybe, or, maybe_or, many_or, maybe_many_or, many, maybe_many, exit } = Parser({
	space: / /,
	large_space: /(?: )+/,
	colon: /:/,
	slash: /\//,
	quote: /"/,
	equals: /(?: )*=(?: )*/,
	comma: /(?: )*,(?: )*/,
	text_bar: /\|/,
	str: /"(?:[^\\"\n]|[\\]")*"|'(?:[^\\'\n]|[\\]')*'/,
	comment: /\/\/(?:-)?(?:[^\n])*/,
	open_paren: /\(/,
	close_paren: /\)/,
	not_paren: /(?:"(?:[^\\"\n]|[\\]")*"|'(?:[^\\'\n]|[\\]')*'|[^()\n])+/,
	open_bracket: /\{/,
	close_bracket: /\}/,
	not_bracket: /(?:"(?:[^\\"\n]|[\\]")*"|'(?:[^\\'\n]|[\\]')*'|[^{}\n])+/,
	open_double_bracket: /\{\{/,
	close_double_bracket: /\}\}/,
	not_double_bracket: /(?:[^\\{}\n]|\{[^\\{\n]|\}[^\\}\n]|[\\](?:[^\\\n]){1,2})+/,
	identifier: /(?:[0-9A-Za-z_])+/,
	tag_identifier: /(?:[0-9A-Za-z_]|-)+/,
	at_identifier: /@(?:[0-9A-Za-z_]|-)+/,
	plus_identifier: /\+(?:[0-9A-Za-z_]|-)+/,
	attribute_name: /(?:[^\s,'"=()]|\((?:[^\s,'"=()])*\))+|"(?:[^\\"\n]|[\\]")*"|'(?:[^\\'\n]|[\\]')*'/,
	dot: /\./,
	pound: /#/,
	id_identifier: /#(?:[0-9A-Za-z_]|-)+/,
	class_identifier: /\.(?:[0-9A-Za-z_]|-)+/
}, { IndentationLexer: IndentationLexer() })

const { _Z2nLjPg, _17D7Of, _Z1F9dGs, _ZCgW0s, _6PPuF, _Z1owlnn, _7U1Cw, _Z2evaAJ, _Z1bsgQT, _Z1s8tjH, _NFQGh, _ZiAKh1, _Z1O2lKj, _Z1kIVyP, _2w47cC, _Z1yGH1N, _1VQg9s, _qLI, _7HLiJ, _Z1KbEOG, _6PPJc, _Z1wyrvk, _uGx, _J5AgF, _14hbOa, _Z2cNPgr } = {

	_Z2nLjPg: branch(
		path([tok.tag_identifier]), path([tok.id_identifier]), path([tok.class_identifier]), path([tok.dot]), path([tok.pound]),
		path([tok.plus_identifier]), path([tok.at_identifier]), path([tok.text_bar]),
	),

	_17D7Of: path([tok.comment]),
	_Z1F9dGs: path([tok.indent_continue]),
	_ZCgW0s: branch(
		path([tok.tag_identifier]), path([tok.id_identifier]), path([tok.class_identifier]), path([tok.dot]), path([tok.pound]),
		path([tok.plus_identifier]), path([tok.at_identifier]),
	),
	_6PPuF: path([tok.colon]),
	_Z1owlnn: path([tok.indent]),
	_7U1Cw: path([tok.space]),
	_Z2evaAJ: branch(path([tok.open_double_bracket]), path([tok.not_double_bracket])),
	_Z1bsgQT: path([tok.text_bar]),
	_Z1s8tjH: branch(
		path([tok.tag_identifier]), path([tok.id_identifier]), path([tok.class_identifier]), path([tok.dot]), path([tok.pound]),
	),
	_NFQGh: path([tok.open_paren]),
	_ZiAKh1: path([tok.plus_identifier]),
	_Z1O2lKj: branch(path([tok.open_paren]), path([tok.not_paren])),
	_Z1kIVyP: path([tok.at_identifier]),
	_2w47cC: branch(path([tok.large_space]), path([tok.open_paren])),
	_Z1yGH1N: path([tok.tag_identifier]),
	_1VQg9s: branch(path([tok.id_identifier]), path([tok.class_identifier]), path([tok.dot]), path([tok.pound])),
	_qLI: path([tok.dot]),
	_7HLiJ: path([tok.pound]),
	_Z1KbEOG: branch(path([tok.large_space]), path([tok.attribute_name])),
	_6PPJc: path([tok.comma, tok.attribute_name]),
	_Z1wyrvk: path([tok.equals]),
	_uGx: path([tok.str]),
	_J5AgF: path([tok.open_bracket]),
	_14hbOa: branch(path([tok.open_bracket]), path([tok.str]), path([tok.not_bracket])),
	_Z2cNPgr: path([tok.open_double_bracket])
}

// export type PlusHandler = (name: string, code: string | undefined, children: IntermediateElement[]) => IntermediateElement[]
// export type AtHandler = (code: string | undefined, children: IntermediateElement[]) => IntermediateElement[]

export function wolf(): ParseResult<(Spanned<Entity | SlotInsertion>)[]> {
	maybe_many(tok.indent_continue)
	const items = lines(() => {
		return or(
			c(entity, _Z2nLjPg),
			c(comment, _17D7Of),
		)
	}, _Z1F9dGs)

	return parseEntities(items)
}

export function entity(): ParseResult<FinalizableEntity> {
	return or(
		c((): ParseResult<FinalizableEntity> => {
			const ctx = new Context<FinalizableEntity>()
			const entity_item = entity_descriptor()

			const entitiesResult = ctx.subsume(maybe_or(
				c((): ParseResult<(Spanned<Entity | SlotInsertion>)[]> => {
					consume(tok.colon, tok.large_space)
					return parseEntities([entity()])
				}, _6PPuF),

				c((): ParseResult<(Spanned<Entity | SlotInsertion>)[]> => {
					consume(tok.indent)
					const entitiesResult = wolf()
					consume(tok.deindent)
					return entitiesResult
				}, _Z1owlnn),

				c((): ParseResult<Spanned<TextSection>[]> => {
					consume(tok.space)
					const children: NonEmpty<Spanned<TextItem>> = many(text, _Z2evaAJ)
					const span = children.length === 1
						? children[0].span
						: Span.around(children[0].span, children[children.length - 1].span)
					return Context.Ok([Spanned(new TextSection(children.map(unspan) as NonEmpty<TextItem>), span)])
				}, _7U1Cw),
			) || Ok({ value: [] as (Spanned<Entity | SlotInsertion>)[], warnings: [] }))
			if (entitiesResult.is_err()) return ctx.subsumeFail(entitiesResult.error)
			const entities = entitiesResult.value

			switch (entity_item.type) {
				case 'tag':
					const htmlResult = ctx.subsume(parseHtml(entity_item, entities))
					if (htmlResult.is_err()) return ctx.subsumeFail(htmlResult.error)
					return ctx.Ok(() => ({ ready: true, entity: htmlResult.value }))

				case 'inclusion':
					const componentInclusionResult = ctx.subsume(parseComponentInclusion(entity_item, entities))
					if (componentInclusionResult.is_err()) return ctx.subsumeFail(componentInclusionResult.error)
					return ctx.Ok(() => ({ ready: true, entity: componentInclusionResult.value }))

				case 'directive':
					return ctx.Ok(() => ({ ready: false, pending: { rawEntities: entities, ...entity_item } }))
			}
		}, _ZCgW0s),

		c((): ParseResult<FinalizableEntity> => {
			consume(tok.text_bar)
			const text_items = or(
				c(() => {
					consume(tok.indent)
					const text_items = lines(() => {
						return many(text, _Z2evaAJ)
					}, _Z1F9dGs)
					consume(tok.deindent)
					return ([] as Spanned<TextItem>[]).concat(...text_items) as NonEmpty<Spanned<TextItem>>
				}, _Z1owlnn),

				c((): NonEmpty<Spanned<TextItem>> => {
					consume(tok.space)
					return many(text, _Z2evaAJ)
				}, _7U1Cw),
			)

			return Context.Ok({ ready: false, pending: text_items })
		}, _Z1bsgQT),
	)
}

export function entity_descriptor(): TagDescriptor | InclusionDescriptor | DirectiveDescriptor {
	return or(
		c((): TagDescriptor => {
			const { ident, span, metas } = tag()
			const attributesListResult: ParseResult<Spanned<Attribute>>[] = maybe(attributes, _NFQGh) || []
			// TODO this would allow children of a self-closing tag
			// maybe(tok.slash)

			return { type: 'tag', ident, span, metas, attributes: attributesListResult }
		}, _Z1s8tjH),

		c((): InclusionDescriptor => {
			const ident = consume(tok.plus_identifier)[0]
			const attributesListResult: ParseResult<Spanned<Attribute>>[] = maybe(attributes, _NFQGh) || []

			const name = ident.content.slice(1)
			return { type: 'inclusion', name, span: ident.span, params: attributesListResult }
		}, _ZiAKh1),

		c((): DirectiveDescriptor => {
			const ident = consume(tok.at_identifier)[0]
			const code = maybe(() => {
				maybe(tok.large_space)
				consume(tok.open_paren)
				const segments = many(paren_code, _Z1O2lKj) as Spanned<string>[]
				consume(tok.close_paren)
				return segments.map(unspan).join('')
			}, _2w47cC)

			const command = ident.content.slice(1)
			return { type: 'directive', command, span: ident.span, code }
		}, _Z1kIVyP),
	)
}

type FinalizableTag = { ident: string, span: Span, metas: Spanned<IdMeta | ClassMeta>[] }
export function tag(): FinalizableTag {
	return or(
		c((): FinalizableTag => {
			const tag_item = consume(tok.tag_identifier)[0]
			const metas = maybe_many(meta, _1VQg9s) || [] as Spanned<IdMeta | ClassMeta>[]
			const span = metas.length > 0 ? Span.around(tag_item, metas[metas.length - 1].span) : tag_item.span
			return { ident: tag_item.content, span, metas }
		}, _Z1yGH1N),

		c((): FinalizableTag => {
			const metas = many(meta, _1VQg9s) as Spanned<IdMeta | ClassMeta>[]
			const span = metas.length > 1 ? Span.around(metas[0].span, metas[metas.length - 1].span) : metas[0].span
			return { ident: 'div', span, metas }
		}, _1VQg9s),
	)
}

export function meta() {
	const meta_item = or(
		c(tok.id_identifier), c(tok.class_identifier),

		c(() => {
			const prefix = consume(tok.dot)[0]
			const { item: segment, span: segment_span } = code_segment()
			return Spanned(parseDynamicMeta(true, segment.code), Span.around(prefix, segment_span))
		}, _qLI),

		c(() => {
			const prefix = consume(tok.pound)[0]
			const { item: segment, span: segment_span } = code_segment()
			return Spanned(parseDynamicMeta(false, segment.code), Span.around(prefix, segment_span))
		}, _7HLiJ),
	)

	if (Array.isArray(meta_item)) {
		const token = meta_item[0]
		const content = token.content
		return Spanned(parseMeta(content), token.span)
	}
	return meta_item
}

export function attributes(): ParseResult<Spanned<Attribute>>[] {
	consume(tok.open_paren)
	const attribute_results = or(
		c((): ParseResult<Spanned<Attribute>>[] => {
			consume(tok.indent)
			const attribute_results = lines(() => {
				const result = attribute_line()
				consume(tok.comma)
				return result
			}, _Z1F9dGs)
			consume(tok.deindent, tok.indent_continue)
			return ([] as ParseResult<Spanned<Attribute>>[]).concat(...attribute_results)
		}, _Z1owlnn),

		c((): ParseResult<Spanned<Attribute>>[] => {
			maybe(tok.large_space)
			const attribute_results = attribute_line()
			maybe(tok.large_space)
			return attribute_results
		}, _Z1KbEOG),
	)
	consume(tok.close_paren)

	return attribute_results
}

export function attribute_line(): ParseResult<Spanned<Attribute>>[] {
	const results = [attribute()]
	maybe_many(() => {
		consume(tok.comma)
		results.push(attribute())
	}, _6PPJc)

	return results
}

export function attribute() {
	const rawAttribute = TokenSpanned(consume(tok.attribute_name)[0])
	const value = maybe((): Spanned<AttributeCode | string> => {
		consume(tok.equals)
		const value_item = or(c(tok.identifier), c(str, _uGx), c(code_segment, _J5AgF))

		return Array.isArray(value_item)
			? Spanned(new AttributeCode(true, value_item[0].content), value_item[0].span)
			: value_item
	}, _Z1wyrvk)

	return parseAttribute(rawAttribute, value)
}

export function str() {
	return TokenSpanned(consume(tok.str)[0])
}

export function code_segment() {
	const open = consume(tok.open_bracket)[0]
	const segments = maybe_many(code, _14hbOa) || [] as Spanned<string>[]
	const close = consume(tok.close_bracket)[0]

	return Spanned(new AttributeCode(false, segments.map(unspan).join('')), Span.around(open, close))
}

export function code(): Spanned<string> {
	const item = or(
		c(() => {
			const open = consume(tok.open_bracket)[0]
			const segments = maybe_many(code, _14hbOa) || [] as Spanned<string>[]
			const close = consume(tok.close_bracket)[0]
			return Spanned(`{${segments.map(unspan).join('')}}`, Span.around(open, close))
		}, _J5AgF),
		c(tok.str), c(tok.not_bracket),
	)
	return flatten_string(item)
}

export function paren_code(): Spanned<string> {
	const item = or(
		c(() => {
			const open = consume(tok.open_paren)[0]
			const segments = maybe_many(paren_code, _Z1O2lKj) || [] as Spanned<string>[]
			const close = consume(tok.close_paren)[0]
			return Spanned(`(${segments.map(unspan).join('')})`, Span.around(open, close))
		}, _NFQGh),
		c(tok.not_paren),
	)
	return flatten_string(item)
}

export function text(): Spanned<TextItem> {
	const item = or(
		c(() => {
			const open = consume(tok.open_double_bracket)[0]
			const segments = maybe_many(code, _14hbOa) || [] as Spanned<string>[]
			const close = consume(tok.close_double_bracket)[0]

			return Spanned(parseDynamicTextSection(segments.map(unspan).join('')), Span.around(open, close))
		}, _Z2cNPgr),
		c(tok.not_double_bracket),
	)

	return Array.isArray(item)
		? Spanned(parseTextSection(item[0].content), item[0].span)
		: item
}

export function comment() {
	consume(tok.comment)
}

function lines<CONTENT extends ParseArg>(content: CONTENT, _d1: Decidable) {
	const results = [content()] as NonEmpty<ReturnType<CONTENT>>
	maybe_many(() => {
		consume(tok.indent_continue)
		results.push(content())
	}, _d1)

	return results
}


function flatten_string(item: Spanned<string> | [RawToken]): Spanned<string> {
	return Array.isArray(item)
		? TokenSpanned(item[0])
		: item
}
