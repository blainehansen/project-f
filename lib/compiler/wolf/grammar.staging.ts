import { Parser, ParseArg, Decidable, path, branch, c } from 'kreia'
import { IndentationLexer } from 'kreia/dist/virtual_lexers/IndentationLexer'

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
	class_identifier: /\.(?:[0-9A-Za-z_]|-)+/,
}, { IndentationLexer: IndentationLexer() })

const { _Z2nLjPg, _17D7Of, _Z1F9dGs, _ZCgW0s, _6PPuF, _Z1owlnn, _7U1Cw, _Z2evaAJ, _Z1bsgQT, _Z1s8tjH, _NFQGh, _ZiAKh1, _Z1kIVyP, _2w47cC, _Z1O2lKj, _Z1yGH1N, _1VQg9s, _qLI, _7HLiJ, _Z1KbEOG, _6PPJc, _Z1wyrvk, _uGx, _J5AgF, _14hbOa, _Z2cNPgr } = {
	_Z2nLjPg: branch(path(branch(path(branch(path([tok.tag_identifier]), path(branch(path([tok.id_identifier]), path([tok.class_identifier]), path([tok.dot]), path([tok.pound])))), branch(path([tok.open_paren]), path(branch(path([tok.slash]))))), path([tok.plus_identifier]), path([tok.at_identifier]))), path([tok.text_bar])),
	_17D7Of: path([tok.comment]),
	_Z1F9dGs: path([tok.indent_continue]),
	_ZCgW0s: branch(path(branch(path([tok.tag_identifier]), path(branch(path([tok.id_identifier]), path([tok.class_identifier]), path([tok.dot]), path([tok.pound])))), branch(path([tok.open_paren]), path(branch(path([tok.slash]))))), path([tok.plus_identifier]), path([tok.at_identifier])),
	_6PPuF: path([tok.colon]),
	_Z1owlnn: path([tok.indent]),
	_7U1Cw: path([tok.space]),
	_Z2evaAJ: branch(path([tok.open_double_bracket]), path([tok.not_double_bracket])),
	_Z1bsgQT: path([tok.text_bar]),
	_Z1s8tjH: path(branch(path([tok.tag_identifier]), path(branch(path([tok.id_identifier]), path([tok.class_identifier]), path([tok.dot]), path([tok.pound])))), branch(path([tok.open_paren]), path(branch(path([tok.slash]))))),
	_NFQGh: path([tok.open_paren]),
	_ZiAKh1: path([tok.plus_identifier]),
	_Z1kIVyP: path([tok.at_identifier]),
	_2w47cC: branch(path([tok.large_space]), path([tok.open_paren])),
	_Z1O2lKj: branch(path([tok.open_paren]), path([tok.not_paren])),
	_Z1yGH1N: path([tok.tag_identifier]),
	_1VQg9s: branch(path([tok.id_identifier]), path([tok.class_identifier]), path([tok.dot]), path([tok.pound])),
	_qLI: path([tok.dot]),
	_7HLiJ: path([tok.pound]),
	_Z1KbEOG: branch(path([tok.large_space]), path([tok.attribute_name])),
	_6PPJc: path([tok.comma]),
	_Z1wyrvk: path([tok.equals]),
	_uGx: path([tok.str]),
	_J5AgF: path([tok.open_bracket]),
	_14hbOa: branch(path([tok.open_bracket]), path([tok.str]), path([tok.not_bracket])),
	_Z2cNPgr: path([tok.open_double_bracket]),
}

export function wolf() {
	lines(() => {
		or(c(entity, _Z2nLjPg), c(comment, _17D7Of))
	}, _Z1F9dGs)
}

export function entity() {
	or(c(() => {
		entity_descriptor()
		maybe_or(c(() => {
			consume(tok.colon, tok.large_space)
			entity()
		}, _6PPuF), c(() => {
			consume(tok.indent)
			wolf()
			consume(tok.deindent)
		}, _Z1owlnn), c(() => {
			consume(tok.space)
			many(text, _Z2evaAJ)
		}, _7U1Cw))
	}, _ZCgW0s), c(() => {
		consume(tok.text_bar)
		or(c(() => {
			consume(tok.indent)
			lines(() => {
				many(text, _Z2evaAJ)
			}, _Z1F9dGs)
			consume(tok.deindent)
		}, _Z1owlnn), c(() => {
			consume(tok.space)
			many(text, _Z2evaAJ)
		}, _7U1Cw))
	}, _Z1bsgQT))
}

export function entity_descriptor() {
	or(c(() => {
		tag()
		maybe(attributes, _NFQGh)
		maybe(tok.slash)
	}, _Z1s8tjH), c(() => {
		consume(tok.plus_identifier)
		maybe(attributes, _NFQGh)
	}, _ZiAKh1), c(() => {
		consume(tok.at_identifier)
		maybe(() => {
			maybe(tok.large_space)
			consume(tok.open_paren)
			many(paren_code, _Z1O2lKj)
			consume(tok.close_paren)
		}, _2w47cC)
	}, _Z1kIVyP))
}

export function tag() {
	or(c(() => {
		consume(tok.tag_identifier)
		maybe_many(meta, _1VQg9s)
	}, _Z1yGH1N), c(() => {
		many(meta, _1VQg9s)
	}, _1VQg9s))
}

export function meta() {
	or(c(tok.id_identifier), c(tok.class_identifier), c(() => {
		consume(tok.dot)
		code_segment()
	}, _qLI), c(() => {
		consume(tok.pound)
		code_segment()
	}, _7HLiJ))
}

export function attributes() {
	consume(tok.open_paren)
	or(c(() => {
		consume(tok.indent)
		lines(() => {
			attribute_line()
			consume(tok.comma)
		}, _Z1F9dGs)
		consume(tok.deindent)
	}, _Z1owlnn), c(() => {
		maybe(tok.large_space)
		attribute_line()
		maybe(tok.large_space)
	}, _Z1KbEOG))
	consume(tok.close_paren)
	or(c(() => {
		consume(tok.indent)
		lines(() => {
			attribute_line()
			consume(tok.comma)
		}, _Z1F9dGs)
		consume(tok.deindent)
	}, _Z1owlnn), c(() => {
		maybe(tok.large_space)
		attribute_line()
		maybe(tok.large_space)
	}, _Z1KbEOG))
}

export function attribute_line() {
	attribute()
	maybe_many(() => {
		consume(tok.comma)
		attribute()
	}, _6PPJc)
}

export function attribute() {
	consume(tok.attribute_name)
	maybe(() => {
		consume(tok.equals)
		or(c(tok.identifier), c(str, _uGx), c(code_segment, _J5AgF))
	}, _Z1wyrvk)
}

export function str() {
	consume(tok.str)
}

export function code_segment() {
	consume(tok.open_bracket)
	maybe_many(code, _14hbOa)
	consume(tok.close_bracket)
}

export function code() {
	or(c(() => {
		consume(tok.open_bracket)
		maybe_many(code, _14hbOa)
		consume(tok.close_bracket)
	}, _J5AgF), c(tok.str), c(tok.not_bracket))
}

export function paren_code() {
	or(c(() => {
		consume(tok.open_paren)
		maybe_many(paren_code, _Z1O2lKj)
		consume(tok.close_paren)
	}, _NFQGh), c(tok.not_paren))
}

export function text() {
	or(c(() => {
		consume(tok.open_double_bracket)
		maybe_many(code, _14hbOa)
		consume(tok.close_double_bracket)
	}, _Z2cNPgr), c(tok.not_double_bracket))
}

export function comment() {
	consume(tok.comment)
}

function lines<CONTENT extends ParseArg>(content: CONTENT, _d1: Decidable) {
	content()
	maybe_many(() => {
		consume(tok.indent_continue)
		content()
	}, _d1)
}
