import 'mocha'
import { expect } from 'chai'

import {
	reset, exit, tok,
	wolf, entity, entity_descriptor, tag, meta, attributes, attribute_line, attribute, str, code_segment, code, paren_code, text,
} from './grammar'
import { boilString } from '../../utils.test'

// _Z1s8tjH: branch(
// 	path([tok.tag_identifier]), path([tok.id_identifier]), path([tok.class_identifier]), path([tok.dot]), path([tok.pound]),
// ),
// _6PPJc: path([tok.comma, tok.attribute_name]),

// _Z2nLjPg: branch(
// 	path([tok.tag_identifier]), path([tok.id_identifier]), path([tok.class_identifier]), path([tok.dot]), path([tok.pound]),
// 	path([tok.plus_identifier]), path([tok.at_identifier]), path([tok.text_bar]),
// ),
// _ZCgW0s: branch(
// 	path([tok.tag_identifier]), path([tok.id_identifier]), path([tok.class_identifier]), path([tok.dot]), path([tok.pound]),
// 	path([tok.plus_identifier]), path([tok.at_identifier]),
// ),

// delete extra or block in attributes


function parse(fn: () => any, input: string) {
	reset(input)
	fn()
	exit()
}
function parse_give<R>(fn: () => R, input: string): R {
	reset(input)
	const result = fn()
	exit()
	return result
}

function bad(fn: () => any, input: string) {
	reset(input)
	expect(fn).throw()
}
function incomplete(fn: () => any, input: string) {
	reset(input)
	fn()
	expect(exit).throw()
}

const str_simple_double = `"sdfd"`
const str_simple_single = `'sdfd'`
const str_complex = `"sdf453  43\\"34d\\""`

describe('str', () => it('works', () => {
	parse(str, str_simple_double)
	parse(str, str_simple_single)
	parse(str, str_complex)

	bad(str, `"sdfds\nsdfd"`)
}))


const code_simple = `something.dude(whatever.thing[2])`
const code_simple_brackets = `{ a }`
const code_complex_brackets = `{ a{]} { )))} 'imbalanced here {' { sadfsd{}sdf {}} dsfds{ ds} }`
const code_imbalanced = '{ sdfsdf'
const code_imbalanced_more = '{ sdfsdf {}  sdf'

const text_simple = `ssdfd`
const text_garbage = ` !@#$%^&*\\()_-+=[]|\\~\`\\ qwegfgsfjk <>,.?/ 1234567890  	`
const text_interpolation = `{{ ${code_complex_brackets} }}`
const text_interpolation_extra = `{{ asdf ${code_complex_brackets} asdfsfd }}`
const text_lone = `sdfd  { sdfd }  dfd`
const text_escaped = `sdfd  \\{{  sdfd }  \\dfd \\}}`
const text_nightmare = `\\{{ {  \\}}  { sdfds {  ds } ssdf ssdsd sds\\}}\\}\\{`

describe('text', () => it('works', () => {
	parse(text, text_simple)
	parse(text, text_garbage)
	parse(text, text_interpolation)
	parse(text, text_interpolation_extra)
	parse(text, text_lone)
	parse(text, text_escaped)
	parse(text, text_nightmare)

	bad(text, '\nsdf')
	incomplete(text, 'sdfsd\nsdf')
	incomplete(text, 'sdfsd \nsdf')
}))

describe('code', () => it('works', () => {
	parse(code, code_simple)
	incomplete(code, `fdfjk\nddk`)
	bad(code, `\nfdfjk\nddk`)
	parse(code, str_complex)
	parse(code, code_simple_brackets)
	parse(code, code_complex_brackets)

	bad(code, code_imbalanced)
	bad(code, code_imbalanced_more)
}))

describe('code_segment', () => it('works', () => {
	parse(code_segment, `{${code_simple}}`)
	parse(code_segment, `{ ${code_simple} }`)
	parse(code_segment, `{${str_complex}}`)
	parse(code_segment, code_simple_brackets)
	parse(code_segment, code_complex_brackets)

	parse(code_segment, '{}')
	bad(code_segment, code_imbalanced)
	bad(code_segment, code_imbalanced_more)
}))

const paren_code_simple = `( some stuff ? therefore : not )`
const paren_code_complex = `(sdf dkd ()  "imbalanced here (" sdf( dsf dsd  sd: 43434 {  {[][][][[]}}) () )`
const paren_code_imbalanced = `( sd( )`
const paren_code_imbalanced_more = `( sd( sdfd () )`

describe('paren_code', () => it('works', () => {
	parse(paren_code, str_simple_double)
	parse(paren_code, str_simple_single)
	parse(paren_code, str_complex)

	parse(paren_code, code_imbalanced)
	parse(paren_code, code_imbalanced_more)

	incomplete(paren_code, 'sd(')
	bad(paren_code, '(sdf')

	parse(paren_code, paren_code_simple)
	parse(paren_code, paren_code_complex)
	bad(paren_code, paren_code_imbalanced)
	bad(paren_code, paren_code_imbalanced_more)
}))


const meta_id = `#something-here_Stuff-1`
const meta_class = `.something-here_Stuff-1`
const meta_id_code = `#${code_complex_brackets}`
const meta_class_code = `.${code_complex_brackets}`

describe('meta', () => it('works', () => {
	parse(meta, meta_id)
	parse(meta, meta_class)

	parse(meta, meta_id_code)
	parse(meta, meta_class_code)
}))

const tag_lone = 'h4'
const tag_id = `${tag_lone}${meta_id}`
const tag_class = `${tag_lone}${meta_class}`
const tag_all = `${tag_lone}${meta_id}${meta_class}${meta_id_code}${meta_class_code}`

describe('tag', () => it('works', () => {
	parse(tag, tag_lone)
	parse(tag, tag_id)
	parse(tag, tag_class)
	parse(tag, tag_all)
}))


const attribute_bare = `disabled`
const attribute_simple = `href="https://example.com"`
const attribute_ident = `href=some_variable_Thing`
const attribute_ident_spaced = `href = some_variable_Thing`
const attribute_code_segment = `href=${code_complex_brackets}`
const attribute_complex_name = `@click=some_variable_Thing`
const attribute_string_name = `${str_simple_single}=some_variable_Thing`
const attribute_nightmare_name = `(f)dd()sd%%$##(sdfds%%)=some_variable_Thing`

describe('attribute', () => it('works', () => {
	parse(attribute, attribute_bare)
	parse(attribute, attribute_simple)
	parse(attribute, attribute_ident)
	parse(attribute, attribute_ident_spaced)
	parse(attribute, attribute_code_segment)

	parse(attribute, attribute_complex_name)
	parse(attribute, attribute_string_name)
	parse(attribute, attribute_nightmare_name)

	bad(attribute, `,d`)
	bad(attribute, `=d`)
	bad(attribute, `(d`)
	bad(attribute, `)d`)
	bad(attribute, `'d`)
	bad(attribute, `"d`)
}))

describe('attribute_line', () => it('works', () => {
	parse(attribute_line, attribute_bare)
	parse(attribute_line, attribute_simple)
	parse(attribute_line, attribute_nightmare_name)

	for (const sep of [',', ', ', ' ,', ' , '])
		parse(attribute_line, [
			attribute_bare,
			attribute_simple,
			attribute_nightmare_name,
		].join(sep))

	for (const sep of [',', ', ', ' ,', ' , '])
		parse(attribute_line, [
			attribute_simple,
			attribute_bare,
			attribute_nightmare_name,
		].join(sep))
}))

const attributes_indented = `(
	${attribute_bare},

)`

const attributes_indented_line = `(

	${attribute_bare}, ${attribute_simple}, ${attribute_nightmare_name},
)`

const attributes_multi_indented = `(
	${attribute_simple},

	${attribute_bare}, ${attribute_simple}, ${attribute_nightmare_name},
	${attribute_nightmare_name}, ${attribute_bare},
)`

describe('attributes', () => it('works', () => {
	parse(attributes, `(${attribute_bare})`)
	parse(attributes, `(${attribute_simple})`)
	parse(attributes, `(${attribute_nightmare_name})`)

	parse(attributes, attributes_indented)
	parse(attributes, attributes_indented_line)
	parse(attributes, attributes_multi_indented)

	for (const sep of [',', ', ', ' ,', ' , '])
		parse(attributes, '(' + [
			attribute_bare,
			attribute_simple,
			attribute_nightmare_name,
		].join(sep) + ')')

	for (const sep of [',', ', ', ' ,', ' , '])
		parse(attributes, '(' + [
			attribute_simple,
			attribute_bare,
			attribute_nightmare_name,
		].join(sep) + ')')
}))


const entity_descriptor_simple = `div`
const entity_descriptor_attrs = `div(disabled)`
// const entity_descriptor_closed = `div/`
// const entity_descriptor_attrs_closed = `div(disabled)/`
const entity_descriptor_plus = `+Something-123`
const entity_descriptor_plus_attrs = `+Something-123${attributes_multi_indented}`
const entity_descriptor_at = `@slot`
const entity_descriptor_at_attrs = `@match${paren_code_complex}`
const entity_descriptor_at_spaced = `@match ${paren_code_complex}`
const entity_descriptor_at_spaced_more = `@match  ${paren_code_complex}`


describe('entity_descriptor', () => it('works', () => {
	parse(entity_descriptor, entity_descriptor_simple)
	parse(entity_descriptor, entity_descriptor_attrs)
	// parse(entity_descriptor, entity_descriptor_closed)
	// parse(entity_descriptor, entity_descriptor_attrs_closed)
	parse(entity_descriptor, entity_descriptor_plus)
	parse(entity_descriptor, entity_descriptor_plus_attrs)
	parse(entity_descriptor, entity_descriptor_at)
	parse(entity_descriptor, entity_descriptor_at_attrs)
	parse(entity_descriptor, entity_descriptor_at_spaced)
	parse(entity_descriptor, entity_descriptor_at_spaced_more)
}))


const entity_simple = `div: p`
const entity_simple_spaced = `div:  p`
const entity_simple_text = `div ${text_garbage}`
const entity_simple_spaced_text = `div:  p ${text_garbage}`
const entity_text_bar = `| ${text_garbage}`
const entity_text_indented = `|
	${text_lone}`
const entity_text_indented_multiple = `|
	${text_lone}
	${text_nightmare}`

const entity_indented = `div
	p`

const entity_indented_multiple = `div
	p
	a(disabled)`

describe('entity alone', () => it('works', () => {
	parse(entity, entity_descriptor_simple)
	parse(entity, entity_descriptor_attrs)
	// parse(entity, entity_descriptor_closed)
	// parse(entity, entity_descriptor_attrs_closed)
	parse(entity, entity_descriptor_plus)
	parse(entity, entity_descriptor_plus_attrs)
	parse(entity, entity_descriptor_at)
	parse(entity, entity_descriptor_at_attrs)
	parse(entity, entity_descriptor_at_spaced)
	parse(entity, entity_descriptor_at_spaced_more)

	parse(entity, entity_simple)
	parse(entity, entity_simple_spaced)
	parse(entity, entity_simple_text)
	parse(entity, entity_simple_spaced_text)
	parse(entity, entity_text_bar)
	parse(entity, entity_text_indented)
	parse(entity, entity_text_indented_multiple)
	parse(entity, entity_indented)
	parse(entity, entity_indented_multiple)

	bad(entity, 'div:p')
}))

describe('wolf', () => it('works', () => {
	parse(wolf, entity_descriptor_simple)
	parse(wolf, entity_descriptor_attrs)
	// parse(wolf, entity_descriptor_closed)
	// parse(wolf, entity_descriptor_attrs_closed)
	parse(wolf, entity_descriptor_plus)
	parse(wolf, entity_descriptor_plus_attrs)
	parse(wolf, entity_descriptor_at)
	parse(wolf, entity_descriptor_at_attrs)
	parse(wolf, entity_descriptor_at_spaced)
	parse(wolf, entity_descriptor_at_spaced_more)

	parse(wolf, entity_simple)
	parse(wolf, entity_simple_spaced)
	parse(wolf, entity_simple_text)
	parse(wolf, entity_simple_spaced_text)
	parse(wolf, entity_text_bar)
	parse(wolf, entity_text_indented)
	parse(wolf, entity_text_indented_multiple)
	parse(wolf, entity_indented)
	parse(wolf, entity_indented_multiple)
}))


const Rating = `

+Rating(:maxStars=maxStars, :hasCounter=hasCounter, !stars=stars)

`

describe('special cases', () => it('works', () => {
	parse(wolf, Rating)
}))
