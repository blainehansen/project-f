import { Token, RawToken, Span, Spanned } from 'kreia/dist/runtime/lexer'
import { Parser, ParseArg, Decidable, path, branch, c } from 'kreia'
import { IndentationLexer } from 'kreia/dist/virtual_lexers/IndentationLexer'

import { Context } from './utils'
import { NonEmpty } from '../utils'

import {
	Entity, Directive,
	ComponentDefinition, Tag, Meta, Attribute, AttributeCode, TextSection, TextItem,
	ComponentInclusion, IfBlock, EachBlock, MatchBlock, SwitchBlock, SwitchCase, SwitchDefault,
	SlotUsage, SlotInsertion, TemplateDefinition, TemplateInclusion,
} from './ast'
import {
	parseAttribute, parseHtml, parseTagAttributes, parseComponentInclusion,
	TagDescriptor, InclusionDescriptor, DirectiveDescriptor, NotReadyEntity, parseEntities,
} from './ast.parse'

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

export function wolf() {
	const items = lines(() => {
		return or(
			c(entity, _Z2nLjPg),
			c(comment, _17D7Of),
		)
	}, _Z1F9dGs)

	return parseEntities(items)
}

export function entity(): NotReadyEntity {
	return or(
		c((): NotReadyEntity => {
			const entity_item = entity_descriptor()
			const entities = maybe_or(
				c(() => {
					consume(tok.colon, tok.large_space)
					return parseEntities([entity()])
				}, _6PPuF),

				c(() => {
					consume(tok.indent)
					const entities = wolf()
					consume(tok.deindent)
					return entities
				}, _Z1owlnn),

				c(() => {
					consume(tok.space)
					const children = many(text, _Z2evaAJ)
					return [new TextSection(children)] as Entity[]
				}, _7U1Cw),
			) || []

			switch (entity_item.type) {
				case 'tag':
					const { ident, metas, attributes } = entity_item
					return new Tag(ident, metas, attributes, entities)
				case 'inclusion':
					const { name, params } = entity_item
					return parseComponentInclusion(name, params, entities)
				case 'directive':
					return { entities, ...entity_item }
			}
		}, _ZCgW0s),

		c((): NonEmpty<TextItem> => {
			consume(tok.text_bar)
			const text_items = or(
				c((): NonEmpty<TextItem> => {
					consume(tok.indent)
					const text_items = lines(() => {
						return many(text, _Z2evaAJ)
					}, _Z1F9dGs)
					consume(tok.deindent)
					return ([] as TextItem[]).concat(...text_items) as NonEmpty<TextItem>
				}, _Z1owlnn),

				c((): NonEmpty<TextItem> => {
					consume(tok.space)
					return many(text, _Z2evaAJ)
				}, _7U1Cw),
			)

			return text_items
		}, _Z1bsgQT),
	)
}

export function entity_descriptor(): TagDescriptor | InclusionDescriptor | DirectiveDescriptor {
	return or(
		c((): TagDescriptor => {
			const { tag_name, metas } = tag()
			const attributes_list = maybe(attributes, _NFQGh) || []
			// TODO this would allow children of a self-closing tag
			// maybe(tok.slash)

			return { type: 'tag', ident: tag_name, metas, attributes: attributes_list }
		}, _Z1s8tjH),

		c((): InclusionDescriptor => {
			const ident = consume(tok.plus_identifier)
			const attributes_list = maybe(attributes, _NFQGh) || []

			const name = ident[0].content.slice(1)
			return { type: 'inclusion', name, params: attributes_list }
		}, _ZiAKh1),

		c((): DirectiveDescriptor => {
			const ident = consume(tok.at_identifier)
			const code = maybe(() => {
				maybe(tok.large_space)
				consume(tok.open_paren)
				const segments = many(paren_code, _Z1O2lKj)
				consume(tok.close_paren)
				return segments.map(s => s.item).join('')
			}, _2w47cC)

			const command = ident[0].content.slice(1)
			return { type: 'directive', command, code }
		}, _Z1kIVyP),
	)
}

type TagItem = { tag_name: Spanned<string> | undefined, metas: Spanned<Meta>[] }
export function tag(): TagItem {
	return or(
		c((): TagItem => {
			const tag_item = TokenSpanned(consume(tok.tag_identifier)[0])
			const metas = maybe_many(meta, _1VQg9s) || []
			return { tag_name: tag_item, metas }
		}, _Z1yGH1N),

		c((): TagItem => {
			const metas = many(meta, _1VQg9s)
			return { tag_name: undefined, metas }
		}, _1VQg9s),
	)
}

export function meta() {
	const meta_item = or(
		c(tok.id_identifier), c(tok.class_identifier),

		c(() => {
			const prefix = consume(tok.dot)
			const { item: segment, span: segment_span } = code_segment()
			return Spanned(new Meta(true, true, segment.code), Span.around(prefix, segment_span))
		}, _qLI),

		c(() => {
			const prefix = consume(tok.pound)
			const { item: segment, span: segment_span } = code_segment()
			return Spanned(new Meta(false, true, segment.code), Span.around(prefix, segment_span))
		}, _7HLiJ),
	)

	if (Array.isArray(meta_item)) {
		const token = meta_item[0]
		const content = token.content
		return Spanned(new Meta(content.startsWith('.'), false, content), token.span)
	}
	return meta_item
}

export function attributes(): ParseResult<Attribute>[] {
	consume(tok.open_paren)
	const result_attributes = or(
		c((): ParseResult<Attribute>[] => {
			consume(tok.indent)
			const result_attributes = lines(() => {
				const result = attribute_line()
				consume(tok.comma)
				return result
			}, _Z1F9dGs)
			consume(tok.deindent, tok.indent_continue)
			return ([] as ParseResult<Attribute>[]).concat(...result_attributes)
		}, _Z1owlnn),

		c((): ParseResult<Attribute>[] => {
			maybe(tok.large_space)
			const result_attributes = attribute_line()
			maybe(tok.large_space)
			return result_attributes
		}, _Z1KbEOG),
	)
	consume(tok.close_paren)

	return result_attributes
}

export function attribute_line() {
	const results = [attribute()]
	const rest_results = maybe_many(() => {
		consume(tok.comma)
		results.push(attribute())
	}, _6PPJc)

	return results.concat(rest_results || [])
}

export function attribute() {
	const rawAttribute = TokenSpanned(consume(tok.attribute_name))
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
	const open = consume(tok.open_bracket)
	const segments = maybe_many(code, _14hbOa) || []
	const close = consume(tok.close_bracket)

	return Spanned(new AttributeCode(false, segments.map(s => s.item).join('')), Span.around(open, close))
}

export function code(): Spanned<string> {
	const item = or(
		c(() => {
			const open = consume(tok.open_bracket)
			const segments = maybe_many(code, _14hbOa) || []
			const close = consume(tok.close_bracket)
			return Spanned(Span.around(open, close), `{${segments.map(s => s.item).join('')}}`)
		}, _J5AgF),
		c(tok.str), c(tok.not_bracket),
	)
	return flatten_string(item)
}

export function paren_code(): Spanned<string> {
	const item = or(
		c(() => {
			const open = consume(tok.open_paren)
			const segments = maybe_many(paren_code, _Z1O2lKj) || []
			const close = consume(tok.close_paren)
			return Spanned(`(${segments.map(s => s.item).join('')})`, Span.around(open, close))
		}, _NFQGh),
		c(tok.not_paren),
	)
	return flatten_string(item)
}

export function text() {
	const item = or(
		c(() => {
			const open = consume(tok.open_double_bracket)
			const segments = maybe_many(code, _14hbOa) || []
			const close = consume(tok.close_double_bracket)

			return Spanned(new TextItem(true, segments.map(s => s.item).join('')), Span.around(open, close))
		}, _Z2cNPgr),
		c(tok.not_double_bracket),
	)

	return Array.isArray(item)
		? Spanned(new TextItem(false, item[0].content), item[0].span)
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
