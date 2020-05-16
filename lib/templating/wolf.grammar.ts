import { Parser, ParseArg, Decidable, path, branch, c } from 'kreia'
import { IndentationLexer } from 'kreia/dist/virtual_lexers/IndentationLexer'

import {
	Entity, Directive,
	ComponentDefinition, Tag, Meta, Attribute, AttributeCode, TextSection, TextItem,
	ComponentInclusion, IfBlock, EachBlock, MatchBlock, SwitchBlock, SwitchCase, SwitchDefault,
	SlotUsage, SlotInsertion, TemplateDefinition, TemplateInclusion,
} from './ast'
import { NonEmpty } from '../utils'

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

	return finalizeEntities(items)
}

function processInsertableCode(isSlot: boolean, code: string | undefined): [string | undefined, string | undefined] {
	if (code === undefined || code.trim() === '')
		return [undefined, undefined]

	const [nameSection, ...codeSections] = code.split(/; */)
	if (isSlot && !/^&\S+$/.test(nameSection))
		throw new Error(`invalid slot usage ${code}`)

	const argsExpression = codeSections.join('; ')
	return [isSlot ? nameSection.slice(1) : nameSection, argsExpression]
}

type InProgressDirective = InProgressIf | InProgressMatch | InProgressSwitch
type InProgressIf = {
	type: 'if', expression: string, entities: NonEmpty<Entity>,
	elseIfBranches: [string, NonEmpty<Entity>][], elseBranch: NonEmpty<Entity> | undefined,
}
type InProgressMatch = {
	type: 'match', matchExpression: string,
	patterns: [string, Entity[]][], defaultPattern: Entity[] | undefined,
}
type InProgressSwitch = {
	type: 'switch', switchExpression: string,
	cases: (SwitchCase | SwitchDefault)[],
}
function finalizeEntities(items: (NotReadyEntity | undefined)[]): Entity[] {
	const giveEntities = []
	let inProgressTextSection = undefined as NonEmpty<TextItem> | undefined
	let inProgressDirective = undefined as InProgressDirective | undefined
	function finalizeInProgressDirective() {
		if (inProgressDirective === undefined) return

		switch (inProgressDirective.type) {
			case 'if':
				const { expression, entities, elseIfBranches, elseBranch } = inProgressDirective
				giveEntities.push(new IfBlock(expression, entities, elseIfBranches, elseBranch))
				break
			case 'match':
				const { matchExpression, patterns, defaultPattern } = inProgressDirective
				giveEntities.push(new MatchBlock(
					matchExpression,
					// TODO these should probably just be warnings
					NonEmpty.expect(patterns, "no patterns given for @match"),
					defaultPattern,
				))
				break
			case 'switch':
				const { switchExpression, cases } = inProgressDirective
				giveEntities.push(new SwitchBlock(
					switchExpression,
					NonEmpty.expect(cases, "no cases given for @switch"),
				))
				break
		}
	}

	for (const item of items) {
		if (item === undefined) {
			finalizeInProgressDirective()
			continue
		}
		if (Array.isArray(item)) {
			finalizeInProgressDirective()
			inProgressTextSection = (inProgressTextSection || [] as TextItem[]).concat(item) as NonEmpty<TextItem>
			continue
		}
		// finalize inProgressTextSection
		if (inProgressTextSection !== undefined) {
			giveEntities.push(new TextSection(inProgressTextSection))
			inProgressTextSection = undefined
		}

		if (item.type !== 'directive') {
			finalizeInProgressDirective()
			giveEntities.push(item)
			continue
		}

		function validateCodeEmpty(command: string, code: string | undefined): undefined {
			if (code !== undefined)
				throw new Error(`code arguments have no meaning on @${command}`)
			return code
		}
		function validateCode(command: string, code: string | undefined): string {
			if (code === undefined)
				throw new Error(`@${command} must have some code expression`)
			return code
		}

		const { command, code, entities } = item
		switch (command) {
			case 'if':
				finalizeInProgressDirective()
				inProgressDirective = {
					type: 'if', expression: validateCode(command, code),
					entities: NonEmpty.expect(entities, "@if without any nested entities doesn't make any sense"),
					elseIfBranches: [], elseBranch: undefined,
				} as InProgressIf
				break
			case 'elseif':
				if (inProgressDirective === undefined || inProgressDirective.type !== 'if')
					throw new Error("@elseif without a preceding @if")
				inProgressDirective.elseIfBranches.push([
					validateCode(command, code),
					NonEmpty.expect(entities, "@elseif without any nested entities doesn't make any sense"),
				])
				break
			case 'else':
				if (inProgressDirective === undefined || inProgressDirective.type !== 'if')
					throw new Error("@else without a preceding @if")
				validateCodeEmpty(command, code)
				inProgressDirective.elseBranch = NonEmpty.expect(entities, "@else without any nested entities doesn't make any sense")
				finalizeInProgressDirective()
				break

			case 'each':
				finalizeInProgressDirective()
				function processEachBlockCode(code: string): [EachBlock['params'], string] {
					const [paramsSection, ...remainingSections] = code.split(/ +of +/)
					const paramsMatch = paramsSection.match(/\( *(\S+) *, *(\S+) *\)/)
					const [variableCode, indexCode] = paramsMatch === null
						? [paramsSection, undefined]
						: [paramsMatch[1], paramsMatch[2]]

					return [{ variableCode, indexCode }, remainingSections.join(' of ')]
				}
				const [paramsExpression, listExpression] = processEachBlockCode(validateCode(command, code))
				giveEntities.push(new EachBlock(
					paramsExpression, listExpression,
					NonEmpty.expect(entities, "@each without any nested entities doesn't make any sense"),
				))
				break

			case 'match':
				finalizeInProgressDirective()
				if (entities.length > 0)
					throw new Error("@match with nested entities doesn't make any sense")
				inProgressDirective = { type: 'match', matchExpression: validateCode(command, code), patterns: [], defaultPattern: undefined } as InProgressMatch
				break
			case 'when':
				if (inProgressDirective === undefined || inProgressDirective.type !== 'match')
					throw new Error("@when without a preceding @match")
				inProgressDirective.patterns.push([validateCode(command, code), entities])
				break

			case 'switch':
				finalizeInProgressDirective()
				if (entities.length > 0)
					throw new Error("@switch with nested entities doesn't make any sense")
				inProgressDirective = { type: 'switch', switchExpression: validateCode(command, code), cases: [] } as InProgressSwitch
				break
			case 'case':
			case 'fallcase':
				if (inProgressDirective === undefined || inProgressDirective.type !== 'switch')
					throw new Error(`@${command} without a preceding @switch`)
				inProgressDirective.cases.push(new SwitchCase(command === 'fallcase', validateCode(command, code), entities))
				break
			case 'falldefault':
				if (inProgressDirective === undefined || inProgressDirective.type !== 'switch')
					throw new Error("@falldefault without a preceding @switch")
				validateCodeEmpty(command, code)
				inProgressDirective.cases.push(new SwitchDefault(true, entities))
				break

			// belongs to both switch and match
			case 'default':
				validateCodeEmpty(command, code)
				if (inProgressDirective === undefined)
					throw new Error("@default without a preceding @match or @switch")
				switch (inProgressDirective.type) {
					case 'if':
						throw new Error("@default without a preceding @match or @switch")
					case 'match':
						if (inProgressDirective.defaultPattern !== undefined)
							throw new Error("duplicate @default in @match")
						inProgressDirective.defaultPattern = entities
						break
					case 'switch':
						inProgressDirective.cases.push(new SwitchDefault(false, entities))
						break
				}
				break

			case 'slot': {
				finalizeInProgressDirective()
				const [slotName, argsExpression] = processInsertableCode(true, code)
				giveEntities.push(new SlotUsage(slotName, argsExpression, NonEmpty.undef(entities)))
				break
			}
			case 'insert': {
				finalizeInProgressDirective()
				if (entities.length === 0)
					throw new Error("@insert with no nested entities doesn't make any sense")
				const [slotName, paramsExpression] = processInsertableCode(true, code)
				giveEntities.push(new SlotInsertion(
					slotName, paramsExpression,
					NonEmpty.expect(entities, "@insert without any nested entities doesn't make any sense"),
				))
				break
			}

			case 'template': {
				finalizeInProgressDirective()
				const [templateName, argsExpression] = processInsertableCode(false, code)
				if (templateName === undefined)
					throw new Error("@template must provide template name")
				giveEntities.push(new TemplateDefinition(
					templateName, argsExpression,
					NonEmpty.expect(entities, "@template without any nested entities doesn't make any sense"),
				))
				break
			}
			case 'include': {
				finalizeInProgressDirective()
				const [templateName, argsExpression] = processInsertableCode(false, code)
				if (templateName === undefined)
					throw new Error("@include must provide template name")
				giveEntities.push(new TemplateInclusion(templateName, argsExpression))
				break
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
			) || []

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

type TagDescriptor = { type: 'tag', ident: string, metas: Meta[], attributes: Attribute[] }
type InclusionDescriptor = { type: 'inclusion', name: string, params: Attribute[] }
type DirectiveDescriptor = { type: 'directive', command: string, code: string | undefined }
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
				return segments.join('')
			}, _2w47cC)

			const command = ident[0].content.slice(1)
			return { type: 'directive', command, code }
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
			consume(tok.deindent, tok.indent_continue)
			return ([] as Attribute[]).concat(...result_attributes)
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
		? new TextItem(false, item[0].content)
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
