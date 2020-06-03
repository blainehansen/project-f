import { Span } from 'kreia/dist/runtime/lexer'
import { Result, Ok, Err } from '@ts-std/monads'

import { NonEmpty, Dict } from '../utils'

export type ParseError = Readonly<{ span: Span, title: string, message: string, error: true }>
export function ParseError(span: Span, title: string, ...paragraphs: string[]) {
	return { span, title, message: paragraphs.join('\n'), error: true } as ParseError
}

export type ParseWarning = Readonly<{ span: Span, title: string, message: string, error: false }>
export function ParseWarning(span: Span, title: string, ...paragraphs: string[]): ParseWarning {
	return { span, title, message: paragraphs.join('\n'), error: false } as ParseWarning
}

export type ParseOkPayload<T> = { value: T, warnings: ParseWarning[] }
export type ParseErrPayload = { errors: NonEmpty<ParseError>, warnings: ParseWarning[] }
export type ParseResult<T> = Result<ParseOkPayload<T>, ParseErrPayload>

export abstract class ParseContext<T> {
	private errors: ParseError[] = []
	private warnings: ParseWarning[] = []
	private drop() {
		const errors = this.errors.slice()
		const warnings = this.warnings.slice()
		this.errors.splice(0, this.errors.length)
		this.warnings.splice(0, this.warnings.length)
		return { errors, warnings }
	}
	warn<K extends keyof Warnings>(warningName: K, ...args: Parameters<Warnings[K]>) {
		this.warnings.push(Warnings[warningName](...args))
	}
	error<K extends keyof Errors>(errorName: K, ...args: Parameters<Errors[K]>) {
		this.errors.push(Errors[errorName](...args))
	}

	take<T>(result: ParseResult<T>): Result<T, void> {
		if (result.is_err()) {
			this.errors = this.concat(result.error.errors) as NonEmpty<ParseError>
			this.warnings = this.concat(result.error.warnings)
			return Err(undefined as void)
		}
		this.warnings = this.warnings.concat(result.value.warnings)
		return Ok(result.value.value)
	}
}

export class Parser extends ParseContext<void> {
	constructor(readonly lineWidth: number) {}
	expect<T>(result: ParseResult<T>): T {
		const r = this.take(result)
		if (r.is_ok()) return result.value
		return parseDie(this.errors, this.warnings, this.lineWidth)
	}
	die<K extends keyof Errors>(errorName: K, ...args: Parameters<Errors[K]>) {
		this.error(errorName, ...args)
		return parseDie(this.errors, this.warnings, this.lineWidth)
	}
	finalize<T>(finalizer: () => T): T {
		const { errors, warnings } = this.drop()
		return errors.length > 0
			? parseDie(errors, warnings, this.lineWidth)
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

	Err<K extends keyof Errors>(errorName: K, ...args: Parameters<Errors[K]>): ParseResult<T> {
		const { errors, warnings } = this.drop()
		errors.push(Errors[errorName](...args))
		return Err({ errors: errors as NonEmpty<ParseError>, warnings })
	}
	Ok(lazyValue: () => T): ParseResult<T> {
		const { errors, warnings } = this.drop()
		return errors.length > 0
			? Err({ errors: errors as NonEmpty<ParseError>, warnings })
			: Ok({ value: lazyValue(), warnings })
	}

	static Err<K extends keyof Errors>(errorName: K, ...args: Parameters<Errors[K]>): ParseResult<T> {
		return Err({ errors: [Errors[errorName](...args)], warnings: [] })
	}
	static Ok(value: T): ParseResult<T> {
		return Ok({ value, warnings: [] })
	}
}

function formatDiagnostics(diagnostics: (ParseError | ParseWarning)[], lineWidth: number) {
	return diagnostics
		.sort((a, b) => a.span.start - b.span.start)
		.map(d => formatDiagnostic(d, lineWidth))
		.join('\n\n\n') + '\n'
}
function parseDie(errors: NonEmpty<ParseError>, warnings: ParseWarning[], lineWidth: number): never {
	const message = formatDiagnostics((errors as (ParseError | ParseWarning)[]).concat(warnings), lineWidth)
	throw new Error(message)
}
function withWarnings<T>(value: T, warnings: ParseWarning[], lineWidth: number): T {
	if (warnings.length > 0) {
		const message = formatDiagnostics(warnings, lineWidth)
		console.warn(message)
	}
	return value
}


const chalk = require('chalk')
const info = chalk.blue.bold
const file = chalk.magentaBright.bold

export function formatDiagnostic(
	{ span: { file: { source, filename }, start, end, line, column }, title, message, error }: ParseError | ParseWarning,
	lineWidth: number,
): string {
	const headerPrefix = info(`-- ${title.toUpperCase()} `)
	const header = headerPrefix + info('-'.repeat(lineWidth - (title.length + 4)))
	const fileHeader = (filename ? file(filename) + '\n' : '')

	const pointerWidth = end - start
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
	const pointerPrefix = sourceLine.slice(0, column).replace('\t', '  ')
	const highlight = error ? chalk.red.bold : chalk.yellow.bold
	const pointer = pointerPrefix + highlight('^'.repeat(pointerWidth))

	return header
		+ '\n' + fileHeader
		+ blankGutter
		+ makeGutter(line) + printSourceLine
		+ blankGutter + pointer
		+ '\n' + formatMessage(message, margin, lineWidth)
}

function formatMessage(message: string, margin: string, lineWidth: number) {
	return message.split(/\n+/).map(paragraph => {
		const lines: string[] = []
		let line = margin
		const words = paragraph.split(/[ \t]+/)
		for (const word of words) {
			if (line.length + word.length + 1 > lineWidth) {
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

// const source = `span something stufff
// if (def)
// 	whatevs() then sdf
// sdfd
// `


// const span = { file: { source, filename: 'lib/compiler/lexer.ts' }, start: 32, end: 32 + 7, line: 3, column: 1 }
// const m = [
// 	formatDiagnostic(ParseError(span, 'big problem', "This is a very big problem.\nIn order to solve this you really have to do a big thing and this and this and this and this and this and this and this and this and this and this and this and this and this and this and this and this and this and this and this and this and this and this and this and this and this and this and this and this and this.\nSound good?"), process.stdout.columns),
// 	formatDiagnostic(ParseWarning(span, 'big problem', "This is a very big problem"), process.stdout.columns),
// ].join('\n\n\n') + '\n'
// console.log(m)



function paragraphs(...p: string[]) {
	return p.join('\n')
}

export const Errors = {
	// requiresCode: (span: Span, variety: string) => ParseError(span, 'requires code', `static attribute values are invalid for ${variety}`),
	// // noModifiers: (span: Span, variety: string) => ParseError(span, 'invalid modifiers', `modifiers aren't allowed on ${variety}`),
	// conflictingModifiers: (span: Span, message: string) => ParseError(span, 'conflicting modifiers', message),
	// invalidModifier: (span: Span, message: string) => ParseError(span, 'invalid modifier', message),
	// invalidTagSync: (span: Span, message: string) => ParseError(span, 'invalid tag sync', message),
	// invalidSelectMultiple: (span: Span) =>
	// 	ParseError(span, 'invalid select multiple', `the 'multiple' attribute must be either absent or a simple boolean flag`),

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
		"Sections of the `Component` declaration doesn't make sense as anything other than an object.",
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
	DUPLICATE_SECTIONS: (_first: Span, _second) => ParseError(_second, 'DUPLICATE_SECTIONS',
		"I don't know what to do with multiple copies of the same section.",
	),
	NO_SECTIONS: (span: Span) => ParseError(span, 'NO_SECTIONS',
		"Somehow there are no sections.",
	),
}
export type Errors = typeof Errors
export const Warnings = {
	checkExtraneousModifiers(parse: Parse<unknown>, span: Span, modifiers: Dict<true>, variety: string) {
		const m = Object.keys(modifiers)
		if (m.length > 0)
			parse.warn(ParseWarning(span, 'extraneous modifiers', `these modifiers don't apply to ${variety}: ${m.join(', ')}`))
	},
	// leafChildren: (span: Span, tagIdent: string) => ParseWarning(span, 'invalid children', `${tagIdent} tags don't have children`)
	EMPTY_TEMPLATE: (span: Span) => ParseWarning(span, 'EMPTY_TEMPLATE', ""),
	OPTIONAL_COMPONENT_BLOCK: (span: Span) => ParseWarning(span, 'OPTIONAL_COMPONENT_BLOCK',
		"An optional section of the `Component` declaration doesn't really make any sense",
	),
	OPTIONAL_NON_SLOT: (span: Span) => ParseWarning(span, 'OPTIONAL_NON_SLOT',
		"Only slots really make any sense to be optional.",
		"Consider making the inner type undefinable instead `A | undefined`."
	),
	UNSUPPORTED_CUSTOM_SECTION: (span: Span) => ParseWarning(span, 'UNSUPPORTED_CUSTOM_SECTION',
		"",
	),
	LANGLESS_CUSTOM_SECTION: (span: Span) => ParseWarning(span, 'LANGLESS_CUSTOM_SECTION',
		"",
	),
	UNSUPPORTED_STYLE_SECTION: (span: Span) => ParseWarning(span, 'UNSUPPORTED_STYLE_SECTION',
		"",
	),
}
export type Warnings = typeof Warnings
