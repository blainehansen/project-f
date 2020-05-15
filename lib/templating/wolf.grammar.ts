import '@ts-std/extensions/dist/array'
import { Parser, ParseArg, Decidable, path, branch, c } from 'kreia'
import { IndentationLexer } from 'kreia/dist/virtual_lexers/IndentationLexer'

import {
	Entity, Directive,
	ComponentDefinition, Tag, Meta, Attribute, AttributeCode, TextSection, TextItem,
	ComponentInclusion, IfBlock, EachBlock, MatchBlock, SwitchBlock, SwitchCase, SwitchDefault,
	SlotUsage, SlotInsertion, TemplateDefinition, TemplateInclusion,
} from './ast'
import { NonEmpty } from '../utils'
// import * as raw from '../C/compiler/AST'

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

export function wolf(): Entity[] {
	const items = lines(() => {
		return or(
			c(entity, _Z2nLjPg),
			c(comment, _17D7Of),
		)
	}, _Z1F9dGs)

	// TODO mutJoinTextSections
	return items.flat_map(e => e === undefined ? [] : e)
}

function finalizeEntities(items: NotReadyEntity[]): Entity[] {
	const giveEntities = []
	let inprogressTextSection = undefined as NonEmpty<TextItem> | undefined
	let inprogressDirective = undefined as s | undefined
	for (const item of items) {
		if (Array.isArray(item)) {
			inprogressTextSection = (inprogressTextSection || []).concat(item) as NonEmpty<TextItem>
			// finalize the inprogressDirective
			throw
			continue
		}
		if (inprogressTextSection !== undefined) {
			giveEntities.push(new TextSection(inprogressTextSection))
			inprogressTextSection = undefined
		}

		if (item.type !== 'directive') {
			giveEntities.push(item)

			// finalize the inprogressDirective
			throw
			continue
		}

		function processInsertableCode(isSlot: boolean, code: string): [string | undefined, string | undefined] {
			if (code.trim() === '')
				return [undefined, undefined]

			const [nameSection, ...codeSections] = code.split(/; */)
			if (isSlot && !/^&\S+$/.test(nameSection))
				throw new Error(`invalid slot usage ${code}`)

			const argsExpression = codeSections.join('; ')
			return [isSlot ? nameSection.slice(1) : nameSection, argsExpression]
		}

		const { command, code, entities } = item
		switch (command) {
			case 'if':
			case 'elseif':
			case 'else':
				// always completes the current in progress if it's an if

			case 'each': {
				return new EachBlock(paramsExpression, listExpression, entities)
			}

			case 'match': {
				for (const entity of entities) {
					//
				}
				return new MatchBlock()
			}
			case 'when':
			case 'switch':
			case 'case':
			case 'fallcase':
			case 'falldefault':

			// belongs to both switch and match
			case 'default':

			case 'slot': {
				const slotEntities = entities.length > 0 ? entities : undefined
				const [slotName, argsExpression] = processInsertableCode(true, code)
				return new SlotUsage(slotName, argsExpression, slotEntities)
			}
			case 'insert': {
				if (entities.length === 0)
					throw new Error("@insert with no nested entities doesn't make any sense")
				const [slotName, paramsExpression] = processInsertableCode(true, code)
				return new SlotInsertion(slotName, paramsExpression, entities)
			}

			case 'template': {
				const [templateName, argsExpression] = processInsertableCode(false, code)
				if (templateName === undefined)
					throw new Error("@template must provide template name")
				return new TemplateDefinition(templateName, paramsExpression, entities)
			}
			case 'include': {
				const [templateName, argsExpression] = processInsertableCode(false, code)
				if (templateName === undefined)
					throw new Error("@include must provide template name")
				return new TemplateInclusion(templateName, argsExpression)
			}

			default:
				throw new Error(`unknown directive ${command}`)
		}
	}

	return giveEntities
}

type DirectivePending = DirectiveDescriptor & { entities: Entity[] }
type NotReadyEntity = Tag | ComponentInclusion | NonEmpty<TextItem> | DirectivePending
export function entity(): NotReadyEntity {
	return or(
		c((): NotReadyEntity => {
			const entity_item = entity_descriptor()
			const entities = maybe_or(
				c(() => {
					consume(tok.colon, tok.large_space)
					return finalizeEntities([entity()])
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
			)

			switch (entity_item.type) {
				case 'tag':
					const { ident, metas, attributes } = entity_item
					return new Tag(ident, metas, attributes, entities)
				case 'inclusion':
					const { name, params } = entity_item
					return new ComponentInclusion(name, params, entities)
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
					return text_items.flat_map(s => s)
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

type TagDescriptor = { type: 'tag', ident: string, metas: Meta[], attributes: Attribute[] }
type InclusionDescriptor = { type: 'inclusion', name: string, params: Attribute[] }
type DirectiveDescriptor = { type: 'directive', command: string, code: string }
export function entity_descriptor() {
	return or(
		c((): TagDescriptor => {
			const { tag_name, metas } = tag()
			const attributes = maybe(attributes, _NFQGh) || []
			// TODO this would allow children of a self-closing tag
			// maybe(tok.slash)

			return { type: 'tag', ident: tag_name, metas, attributes }
		}, _Z1s8tjH),

		c((): InclusionDescriptor => {
			const ident = consume(tok.plus_identifier)
			const attributes = maybe(attributes, _NFQGh) || []

			const name = ident[0].content.slice(1)
			return { type: 'inclusion', name, params: attributes }
		}, _ZiAKh1),

		c((): DirectiveDescriptor => {
			const ident = consume(tok.at_identifier)
			const segments = maybe(() => {
				maybe(tok.large_space)
				consume(tok.open_paren)
				const segments = many(paren_code, _Z1O2lKj)
				consume(tok.close_paren)
				return segments.join('')
			}, _2w47cC)

			const command = ident[0].content.slice(1)
			return { type: 'directive', command, code: segments || '' }
		}, _Z1kIVyP),
	)
}

type TagItem = { tag_name: string, metas: Meta[] }
export function tag(): TagItem {
	return or(
		c((): TagItem => {
			const tag_item = consume(tok.tag_identifier)
			const metas = maybe_many(meta, _1VQg9s) || []

			return { tag_name: tag_item[0].content, metas }
		}, _Z1yGH1N),

		c((): TagItem => {
			const metas = many(meta, _1VQg9s)
			return { tag_name: 'div', metas }
		}, _1VQg9s),
	)
}

export function meta(): Meta {
	const meta_item = or(
		c(tok.id_identifier), c(tok.class_identifier),

		c((): Meta => {
			consume(tok.dot)
			const segment = code_segment()
			return new Meta(true, true, segment.code)
		}, _qLI),

		c((): Meta => {
			consume(tok.pound)
			const segment = code_segment()
			return new Meta(false, true, segment.code)
		}, _7HLiJ),
	)

	if (Array.isArray(meta_item)) {
		const content = meta_item[0].content
		return new Meta(content.startsWith('.'), false, content)
	}
	return meta_item
}

export function attributes(): Attribute[] {
	consume(tok.open_paren)
	const result_attributes = or(
		c((): Attribute[] => {
			consume(tok.indent)
			const result_attributes = lines(() => {
				const result = attribute_line()
				consume(tok.comma)
				return result
			}, _Z1F9dGs)
			consume(tok.deindent)
			return result_attributes.flat_map(r => r)
		}, _Z1owlnn),

		c((): Attribute[] => {
			maybe(tok.large_space)
			const result_attributes = attribute_line()
			maybe(tok.large_space)
			return result_attributes
		}, _Z1KbEOG),
	)
	consume(tok.close_paren)

	return result_attributes
}

export function attribute_line(): Attribute[] {
	const results = [attribute()]
	const rest_results = maybe_many(() => {
		consume(tok.comma)
		results.push(attribute())
	}, _6PPJc)

	return results.concat(rest_results || [])
}

export function attribute(): Attribute {
	const name_token = consume(tok.attribute_name)
	const value = maybe((): string | AttributeCode => {
		consume(tok.equals)
		const value_item = or(c(tok.identifier), c(str, _uGx), c(code_segment, _J5AgF))

		return Array.isArray(value_item)
			? new AttributeCode(true, value_item[0].content)
			: value_item
	}, _Z1wyrvk)

	return new Attribute(name_token[0].content, value)
}

export function str() {
	const str_token = consume(tok.str)
	return str_token[0].content
}

export function code_segment(): AttributeCode {
	consume(tok.open_bracket)
	const segments = maybe_many(code, _14hbOa) || []
	consume(tok.close_bracket)

	return new AttributeCode(false, segments.join(''))
}

export function code(): string {
	const item = or(
		c(() => {
			consume(tok.open_bracket)
			const segments = maybe_many(code, _14hbOa) || []
			consume(tok.close_bracket)
			return `{${segments.join('')}}`
		}, _J5AgF),
		c(tok.str), c(tok.not_bracket),
	)
	return flatten_string(item)
}

export function paren_code(): string {
	const item = or(
		c(() => {
			consume(tok.open_paren)
			const segments = maybe_many(paren_code, _Z1O2lKj) || []
			consume(tok.close_paren)
			return `(${segments.join('')})`
		}, _NFQGh),
		c(tok.not_paren),
	)
	return flatten_string(item)
}

export function text(): TextItem {
	const item = or(
		c(() => {
			consume(tok.open_double_bracket)
			const segments = maybe_many(code, _14hbOa) || []
			consume(tok.close_double_bracket)

			return new TextItem(true, segments.join(''))
		}, _Z2cNPgr),
		c(tok.not_double_bracket),
	)

	return Array.isArray(item)
		? TextItem(false, item[0].content)
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


interface TokenLike { content: string }
function flatten_string(item: string | [TokenLike]) {
	return Array.isArray(item)
		? item[0].content
		: item
}
