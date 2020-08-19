import { Result, Ok, Err } from '@ts-std/monads'
import { Span, Spanned } from 'kreia/dist/runtime/lexer'

import { NonEmpty, Dict, KeysOfType } from '../utils'

export type ParseError = Readonly<{ region: Span | string, title: string, message: string, error: true }>
export function ParseError(region: Span | string, title: string, ...paragraphs: string[]) {
	return { region, title, message: paragraphs.join('\n'), error: true } as ParseError
}

export type ParseWarning = Readonly<{ region: Span | string, title: string, message: string, error: false }>
export function ParseWarning(region: Span | string, title: string, ...paragraphs: string[]): ParseWarning {
	return { region, title, message: paragraphs.join('\n'), error: false } as ParseWarning
}

export type ParseOkPayload<T> = { value: T, warnings: ParseWarning[] }
export type ParseErrPayload = { errors: NonEmpty<ParseError>, warnings: ParseWarning[] }
export type ParseResult<T> = Result<ParseOkPayload<T>, ParseErrPayload>

export type KeysOTypeReturners<T, U> = { [K in keyof T]: T[K] extends (...args: any[]) => U ? K : never }[keyof T]
export type ArgsOfTypeReturner<T, U, K extends KeysOTypeReturners<T, U>> = T[K] extends (...args: infer A) => U ? A : never
function unsafePass<T, U, K extends KeysOTypeReturners<T, U>>(t: T, k: K, args: ArgsOfTypeReturner<T, U, K>): U {
	return (t[k] as ((...args: any[]) => U))(...args)
}

export function unspan<T>(s: Spanned<T> | [T, Span]): T {
	return Array.isArray(s) ? s[0] : s.item
}

export abstract class ParseContext<T> {
	protected errors: ParseError[] = []
	protected warnings: ParseWarning[] = []
	protected drop() {
		const errors = this.errors.slice()
		const warnings = this.warnings.slice()
		this.errors.splice(0, this.errors.length)
		this.warnings.splice(0, this.warnings.length)
		return { errors, warnings }
	}
	warn<K extends KeysOTypeReturners<Warnings, ParseWarning>>(warningName: K, ...args: ArgsOfTypeReturner<Warnings, ParseWarning, K>) {
		this.warnings.push(unsafePass(Warnings, warningName, args))
	}
	error<K extends KeysOTypeReturners<Errors, ParseError>>(errorName: K, ...args: ArgsOfTypeReturner<Errors, ParseError, K>) {
		this.errors.push(unsafePass(Errors, errorName, args))
	}

	take<T>(result: ParseResult<T>): Result<T, void> {
		if (result.is_err()) {
			this.errors = this.errors.concat(result.error.errors) as NonEmpty<ParseError>
			this.warnings = this.warnings.concat(result.error.warnings)
			return Err(undefined as void)
		}
		this.warnings = this.warnings.concat(result.value.warnings)
		return Ok(result.value.value)
	}
}

export class Parser extends ParseContext<void> {
	constructor(readonly lineWidth: number) { super() }
	expect<T>(result: ParseResult<T>): T {
		const r = this.take(result)
		if (r.is_ok()) return r.value
		return parseDie(this.errors as NonEmpty<ParseError>, this.warnings, this.lineWidth)
	}
	die<K extends KeysOTypeReturners<Errors, ParseError>>(errorName: K, ...args: ArgsOfTypeReturner<Errors, ParseError, K>) {
		this.error(errorName, ...args)
		return parseDie(this.errors as NonEmpty<ParseError>, this.warnings, this.lineWidth)
	}
	finalize<T>(finalizer: () => T): T {
		const { errors, warnings } = this.drop()
		return errors.length > 0
			? parseDie(errors as NonEmpty<ParseError>, warnings, this.lineWidth)
			: withWarnings(finalizer(), warnings, this.lineWidth)
	}
}

export class Context<T> extends ParseContext<T> {
	subsume<T>(result: ParseResult<T>): Result<T, ParseErrPayload> {
		if (result.is_err()) return Err(result.error)

		const { value, warnings } = result.value
		this.warnings = this.warnings.concat(warnings)
		return Ok(value)
	}
	subsumeFail(err: ParseErrPayload): ParseResult<T> {
		const { errors: selfErrors, warnings: selfWarnings } = this.drop()
		const errors = selfErrors.concat(err.errors) as NonEmpty<ParseError>
		const warnings = selfWarnings.concat(err.warnings)
		return Err({ errors, warnings })
	}

	Err<K extends KeysOTypeReturners<Errors, ParseError>>(errorName: K, ...args: ArgsOfTypeReturner<Errors, ParseError, K>): ParseResult<T> {
		const { errors, warnings } = this.drop()
		errors.push(unsafePass(Errors, errorName, args))
		return Err({ errors: errors as NonEmpty<ParseError>, warnings })
	}
	Ok(lazyValue: () => T): ParseResult<T> {
		const { errors, warnings } = this.drop()
		return errors.length > 0
			? Err({ errors: errors as NonEmpty<ParseError>, warnings })
			: Ok({ value: lazyValue(), warnings })
	}

	static Err<T, K extends KeysOTypeReturners<Errors, ParseError>>(errorName: K, ...args: ArgsOfTypeReturner<Errors, ParseError, K>): ParseResult<T> {
		return Err({ errors: [unsafePass(Errors, errorName, args)], warnings: [] })
	}
	static Ok<T>(value: T): ParseResult<T> {
		return Ok({ value, warnings: [] })
	}
}

function formatDiagnostics(diagnostics: (ParseError | ParseWarning)[], lineWidth: number) {
	return diagnostics
		.sort((a, b) => {
			if (typeof a.region === 'string' && typeof b.region === 'string')
				return a.region < b.region ? -1 : 1
			if (typeof a.region === 'string') return -1
			if (typeof b.region === 'string') return 1
			return a.region.start - b.region.start
		})
		.map(d => formatDiagnostic(d, lineWidth))
		.join('\n\n\n') + '\n'
}
function parseDie(errors: NonEmpty<ParseError>, warnings: ParseWarning[], lineWidth: number): never {
	const message = formatDiagnostics((errors as (ParseError | ParseWarning)[]).concat(warnings), lineWidth)
	// if (typeof process === 'object') {
	// 	console.error('\n\n' + message)
	// 	process.exit(1)
	// }
	// else
	throw new Error('\n\n' + message)
}
function withWarnings<T>(value: T, warnings: ParseWarning[], lineWidth: number): T {
	if (warnings.length > 0) {
		const message = formatDiagnostics(warnings, lineWidth)
		console.warn(message)
	}
	return value
}


import chalk = require('chalk')
const info = chalk.blue.bold
const file = chalk.magentaBright.bold

export function formatDiagnostic(
	{ region, title, message, error }: ParseError | ParseWarning,
	lineWidth: number,
): string {
	const header = info(`-- ${title} ` + '-'.repeat(lineWidth - (title.length + 4)))

	if (typeof region === 'string') {
		const fileHeader = '\n' + ' '.repeat(3) + file(region)
		return header + '\n' + fileHeader + formatMessage(message, '\n  ', lineWidth)
	}

	const { file: { source, filename }, start, end, line, column } = region
	const lineNumberWidth = line.toString().length
	function makeGutter(lineNumber?: number) {
		const insert = lineNumber !== undefined
			? ' '.repeat(lineNumberWidth - lineNumber.toString().length) + lineNumber
			: ' '.repeat(lineNumberWidth)
		return info(`\n ${insert} |  `)
	}
	const blankGutter = makeGutter()
	const margin = `\n${' '.repeat(lineNumberWidth)}  `

	let sourceLineStart = start
	for (; sourceLineStart >= 0; sourceLineStart--)
		if (source[sourceLineStart] === '\n') break

	const sourceLineEnd = source.indexOf('\n', start)
	const sourceLine = source.slice(sourceLineStart + 1, sourceLineEnd)

	const printSourceLine = sourceLine.replace('\t', '  ')
	const pointerPrefix = ' '.repeat(sourceLine.slice(0, column).replace('\t', '  ').length)
	const highlight = error ? chalk.red.bold : chalk.yellow.bold
	const pointerWidth = end - start
	const pointer = pointerPrefix + highlight('^'.repeat(pointerWidth))

	const fileHeader = (filename ? '\n' + ' '.repeat(lineNumberWidth + 3) + file(filename) : '')
	return header
		+ '\n' + fileHeader
		+ blankGutter
		+ makeGutter(line) + printSourceLine
		+ blankGutter + pointer
		+ '\n' + formatMessage(message, margin, lineWidth)
}

function formatMessage(message: string, margin: string, lineWidth: number) {
	const finalLineWidth = Math.min(lineWidth, 80)
	return message.split(/\n+/).map(paragraph => {
		const lines: string[] = []
		let line = margin
		const words = paragraph.split(/[ \t]+/)
		for (const word of words) {
			if (line.length + word.length + 1 > finalLineWidth) {
				lines.push(line)
				line = margin + ' ' + word
			}
			else line += ' ' + word
		}
		if (line !== margin)
			lines.push(line)

		return lines.join('')
	}).join('\n')
}


export const Errors = {
	UNSUPPORTED_TEMPLATE_LANG: (span: Span) => ParseError(span, 'UNSUPPORTED_TEMPLATE_LANG',
		"At this time, only the `wolf` templating language is supported.",
		"This is a restriction that will be lifted as soon as possible.",
	),
	NON_TS_SCRIPT_LANG: (span: Span) => ParseError(span, 'NON_TS_SCRIPT_LANG',
		"At this time, only typescript is supported as a script language.",
	),
	COMPONENT_CONFLICTING_CREATE: (_first: Span, _second: Span) => ParseError(_second, 'COMPONENT_CONFLICTING_CREATE',
		"Only one of either `create` or `createCtx` are allowed.",
	),
	COMPONENT_CONFLICTING_COMPONENT: (_first: Span, _second: Span) => ParseError(_second, 'COMPONENT_CONFLICTING_COMPONENT',
		"Only one `Component` declaration is allowed.",
	),
	COMPONENT_NOT_OBJECT: (span: Span) => ParseError(span, 'COMPONENT_NOT_OBJECT',
		"The `Component` declaration doesn't make sense as anything other than an object.",
	),
	COMPONENT_BLOCK_NOT_OBJECT: (span: Span) => ParseError(span, 'COMPONENT_BLOCK_NOT_OBJECT',
		"Sections of the `Component` declaration don't make sense as anything other than an object.",
	),
	UNKNOWN_COMPONENT_BLOCK: (span: Span) => ParseError(span, 'UNKNOWN_COMPONENT_BLOCK',
		"This property isn't a valid section of a `Component` declaration.",
	),
	CREATE_FINAL_NOT_RETURN: (span: Span) => ParseError(span, 'CREATE_FINAL_NOT_RETURN',
		"In a `create` function, the final statement must be a simple return statement giving a plain object with known names.",
		"If you need to do something more complex, consider using a `createCtx` function instead.",
	),
	CREATE_FINAL_NOT_OBJECT: (span: Span) => ParseError(span, 'CREATE_FINAL_NOT_OBJECT',
		"In a `create` function, the final statement must be a simple return statement giving a plain object with known names.",
		"If you need to do something more complex, consider using a `createCtx` function instead.",
	),
	CREATE_COMPLEX_NAME: (span: Span) => ParseError(span, 'CREATE_COMPLEX_NAME',
		"The returned object of a `create` function can only have simple known names.",
		"If you need to do something more complex, consider using a `createCtx` function instead.",
	),
	CREATE_ACCESSOR_PROPERTY: (span: Span) => ParseError(span, 'CREATE_ACCESSOR_PROPERTY',
		"The returned object of a `create` function can only have simple known names.",
		"If you need to do something more complex, consider using a `createCtx` function instead.",
	),
	CREATE_UNSUPPORTED_PROPERTY: (span: Span) => ParseError(span, 'CREATE_UNSUPPORTED_PROPERTY',
		"The returned object of a `create` function can only have simple known names.",
		"If you need to do something more complex, consider using a `createCtx` function instead.",
	),
	COMPONENT_PROPERTY_SIGNATURE: (span: Span) => ParseError(span, 'COMPONENT_PROPERTY_SIGNATURE',
		"The properties of the `Component` type sections have to be simple property signatures.",
	),
	COMPONENT_PROPERTY_INITIALIZED: (span: Span) => ParseError(span, 'COMPONENT_PROPERTY_INITIALIZED',
		"Initializers don't really make a lot of sense in a `Component` type declaration.",
	),
	COMPONENT_COMPLEX_NAME: (span: Span) => ParseError(span, 'COMPONENT_COMPLEX_NAME',
		"The properties of the `Component` type sections have to be simple property signatures.",
	),
	DUPLICATE_SECTIONS: (_first: Span, _second: Span) => ParseError(_second, 'DUPLICATE_SECTIONS',
		"I don't know what to do with multiple copies of the same section.",
	),

	COMPONENT_USAGE_NONEXISTENT_SLOT: (span: Span) => ParseError(span, 'COMPONENT_USAGE_NONEXISTENT_SLOT', ""),
	INVALID_SLOT_INSERTION: (span: Span) => ParseError(span, 'INVALID_SLOT_INSERTION', ""),

	REQUIRES_CODE: (span: Span, variety: string) => ParseError(span, 'REQUIRES_CODE',
		`${variety} don't make any sense if passed a static value.`,
	),

	CONFLICTING_MODIFIERS_FAKE_SETTER: (span: Span) => ParseError(span, 'CONFLICTING_MODIFIERS_FAKE_SETTER', ""),
	INVALID_TAG_SYNC_MULTIPLE: (span: Span) => ParseError(span, 'INVALID_TAG_SYNC_MULTIPLE', ""),
	INVALID_TAG_SYNC_INVALID: (span: Span) => ParseError(span, 'INVALID_TAG_SYNC_INVALID', ""),
	INVALID_TAG_SYNC_MODIFIER: (span: Span) => ParseError(span, 'INVALID_TAG_SYNC_MODIFIER', ""),
	INPUT_TAG_SYNC_NOT_KNOWN_TYPE: (span: Span) => ParseError(span, 'INPUT_TAG_SYNC_NOT_KNOWN_TYPE', ""),
	INPUT_TAG_SYNC_CHECKBOX_NOT_KNOWN_VALUE: (span: Span) => ParseError(span, 'INPUT_TAG_SYNC_CHECKBOX_NOT_KNOWN_VALUE', ""),
	INPUT_TAG_SYNC_RADIO_NOT_KNOWN_VALUE: (span: Span) => ParseError(span, 'INPUT_TAG_SYNC_RADIO_NOT_KNOWN_VALUE', ""),
	INPUT_TAG_SYNC_UNSUPPORTED_TYPE: (span: Span) => ParseError(span, 'INPUT_TAG_SYNC_UNSUPPORTED_TYPE', ""),
	INPUT_TAG_SYNC_SELECT_INVALID_MULTIPLE: (span: Span) => ParseError(span, 'INPUT_TAG_SYNC_SELECT_INVALID_MULTIPLE', ""),
	INVALID_SYNCED_TAG: (span: Span) => ParseError(span, 'INVALID_SYNCED_TAG', ""),
	TAG_DUPLICATE_BINDING: (_first: Span, _second: Span) => ParseError(_second, 'TAG_DUPLICATE_BINDING', ""),
	TAG_CLASS_ATTRIBUTE: (span: Span) => ParseError(span, 'TAG_CLASS_ATTRIBUTE', ""),
	TAG_ID_ATTRIBUTE: (span: Span) => ParseError(span, 'TAG_ID_ATTRIBUTE', ""),

	COMPONENT_INCLUSION_DUPLICATE_ARGUMENT: (_first: Span, _second: Span) => ParseError(_second, 'COMPONENT_INCLUSION_DUPLICATE_ARGUMENT', ""),
	COMPONENT_INCLUSION_RECEIVER: (span: Span) => ParseError(span, 'COMPONENT_INCLUSION_RECEIVER', ""),
	INVALID_SLOT_USAGE: (span: Span) => ParseError(span, 'INVALID_SLOT_USAGE', ""),
	INVALID_SLOT_NAME: (span: Span) => ParseError(span, 'INVALID_SLOT_NAME', ""),
	COMPONENT_INCLUSION_DUPLICATE_SLOT_INSERTION: (_first: Span, _second: Span) => ParseError(_first, 'COMPONENT_INCLUSION_DUPLICATE_SLOT_INSERTION', ""),
	COMPONENT_INCLUSION_CONFLICTING_DEF_SLOT_INSERTION: (span: Span) => ParseError(span, 'COMPONENT_INCLUSION_CONFLICTING_DEF_SLOT_INSERTION', ""),
	SWITCH_NO_CASES: (span: Span) => ParseError(span, 'SWITCH_NO_CASES', ""),
	IF_NO_EXPRESSION: (span: Span) => ParseError(span, 'IF_NO_EXPRESSION', ""),
	IF_UNPRECEDED_ELSEIF: (span: Span) => ParseError(span, 'IF_UNPRECEDED_ELSEIF', ""),
	IF_UNPRECEDED_ELSE: (span: Span) => ParseError(span, 'IF_UNPRECEDED_ELSE', ""),
	IF_ELSE_CONDITION: (span: Span) => ParseError(span, 'IF_ELSE_CONDITION', ""),
	EACH_NO_EXPRESSION: (span: Span) => ParseError(span, 'EACH_NO_EXPRESSION', ""),
	MATCH_NESTED_ENTITIES: (span: Span) => ParseError(span, 'MATCH_NESTED_ENTITIES', ""),
	MATCH_NO_EXPRESSION: (span: Span) => ParseError(span, 'MATCH_NO_EXPRESSION', ""),
	MATCH_UNPRECEDED_WHEN: (span: Span) => ParseError(span, 'MATCH_UNPRECEDED_WHEN', ""),
	WHEN_NO_EXPRESSION: (span: Span) => ParseError(span, 'WHEN_NO_EXPRESSION', ""),
	SWITCH_NESTED_ENTITIES: (span: Span) => ParseError(span, 'SWITCH_NESTED_ENTITIES', ""),
	SWITCH_NO_EXPRESSION: (span: Span) => ParseError(span, 'SWITCH_NO_EXPRESSION', ""),
	SWITCH_UNPRECEDED_CASE: (span: Span) => ParseError(span, 'SWITCH_UNPRECEDED_CASE', ""),
	CASE_NO_EXPRESSION: (span: Span) => ParseError(span, 'CASE_NO_EXPRESSION', ""),
	SWITCH_DEFAULT_CONDITION: (span: Span) => ParseError(span, 'SWITCH_DEFAULT_CONDITION', ""),
	SWITCH_UNPRECEDED_DEFAULT: (span: Span) => ParseError(span, 'SWITCH_UNPRECEDED_DEFAULT', ""),
	MATCH_DUPLICATE_DEFAULT: (span: Span) => ParseError(span, 'MATCH_DUPLICATE_DEFAULT', ""),
	TEMPLATE_NAMELESS: (span: Span) => ParseError(span, 'TEMPLATE_NAMELESS', ""),
	INCLUDE_NAMELESS: (span: Span) => ParseError(span, 'INCLUDE_NAMELESS', ""),
	UNKNOWN_DIRECTIVE: (span: Span) => ParseError(span, 'UNKNOWN_DIRECTIVE',
		"So, this isn't a valid directive.",
		"Instead, try this or this or this or this or this or this or this or this or this or this or this or this or this or this or this or this or this or this or this or this or this.",
	),
}
export type Errors = typeof Errors

export const Warnings = {
	checkExtraneousModifiers(ctx: ParseContext<unknown>, span: Span, modifiers: Dict<true>, variety: string) {
		const m = Object.keys(modifiers)
		if (m.length > 0)
			ctx.warn('EXTRANEOUS_MODIFIERS', span, `these modifiers don't apply to ${variety}: ${m.join(', ')}`)
	},
	EXTRANEOUS_MODIFIERS: (span: Span, message: string) => ParseWarning(span, 'EXTRANEOUS_MODIFIERS', message),

	OPTIONAL_COMPONENT_BLOCK: (span: Span) => ParseWarning(span, 'OPTIONAL_COMPONENT_BLOCK',
		"An optional section of the `Component` declaration doesn't really make any sense",
	),
	OPTIONAL_NON_SLOT: (span: Span) => ParseWarning(span, 'OPTIONAL_NON_SLOT',
		"Only slots really make any sense to be optional.",
		"Consider making the inner type undefinable instead `A | undefined`.",
	),
	LANGLESS_CUSTOM_SECTION: (span: Span) => ParseWarning(span, 'LANGLESS_CUSTOM_SECTION',
		"When using the compiler cli, custom sections must be marked with a `lang` in order to be processed.",
		"This section will be ignored.",
	),
	UNHANDLED_CUSTOM_SECTION: (span: Span) => ParseWarning(span, 'UNHANDLED_CUSTOM_SECTION',
		"There isn't a processor matching this section type.",
		"This section will be ignored.",
	),
	EMPTY_TEMPLATE: (span: Span) => ParseWarning(span, 'EMPTY_TEMPLATE',
		"",
	),
	TAG_DUPLICATE_ID: (_first: Span, _second: Span) => ParseWarning(_second, 'TAG_DUPLICATE_ID', ""),
	TAG_DUPLICATE_CLASS_META: (_first: Span, _second: Span) => ParseWarning(_second, 'TAG_DUPLICATE_CLASS_META', ""),

	COMPONENT_USAGE_REDUNDANT_FALLBACK: (span: Span) => ParseWarning(span, 'COMPONENT_USAGE_REDUNDANT_FALLBACK', ""),

	COMPONENT_NOT_EXPORTED: (span: Span) => ParseWarning(span, 'COMPONENT_NOT_EXPORTED',
		"It's a good idea to export `Component` type declarations.",
	),
	CREATE_NOT_EXPORTED: (span: Span) => ParseWarning(span, 'CREATE_NOT_EXPORTED',
		"It's a good idea to export `create` and `createCtx` functions.",
	),
	NO_SECTIONS: (filename: string) => ParseWarning(filename, 'NO_SECTIONS',
		"No sections were specified in this iron file.",
		"This is fine, and the entire file will be interpreted as a template, but this might be a mistake.",
		"For clarity, add a single `template` section to this file.",
	),

	DUPLICATE_MODIFIER: (span: Span, modifier: string) => ParseWarning(span, 'DUPLICATE_MODIFIER', modifier),
	REDUNDANT_HANDLER_BARE: (span: Span) => ParseWarning(span, 'REDUNDANT_HANDLER_BARE', ""),
	LEAF_CHILDREN: (span: Span, tagIdent: string) => ParseWarning(span, 'LEAF_CHILDREN', `${tagIdent} tags don't have children`),
}
export type Warnings = typeof Warnings
