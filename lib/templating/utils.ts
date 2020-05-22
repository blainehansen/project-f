import { Result, Ok, Err } from '@ts-std/monads'

export type ParseError = Readonly<{ span: Span, title: string, message: string, error: true }>
export function ParseError(span: Span, title: string, message: string) {
	return { span, title, message, error: true } as ParseError
}

export type ParseWarning = Readonly<{ span: Span, title: string, message: string, error: false }>
export function ParseWarning(span: Span, title: string, message: string): ParseWarning {
	return { span, title, message, error: false } as ParseWarning
}

export type ParseResult<T> = Result<{ value: T, warnings: ParseWarning[] }, { errors: NonEmpty<ParseError>, warnings: ParseWarning[] }>

export class Parse<T> {
	private errors: ParseError[] = []
	private warnings: ParseWarning[] = []
	warn(warning: ParseWarning) {
		this.warnings.push(warning)
	}
	error(error: ParseError) {
		this.errors.push(error)
	}

	private drop() {
		const errors = this.errors.slice()
		const warnings = this.warnings.slice()
		this.errors.splice(0, this.errors.length)
		this.warnings.splice(0, this.warnings.length)
		return { errors, warnings }
	}
	Err(error: ParseError): ParseResult<T> {
		const { errors, warnings } = this.drop()
		errors.push(error)
		return Err({ errors, warnings })
	}
	Ok(value: T): ParseResult<T> {
		const { errors, warnings } = this.drop()
		return errors.length > 0
			? Err({ errors, warnings })
			: Ok({ value, warnings })
	}
}


export const Errors = {
	requiresCode: (span: Span, variety: string) => ParseError(span, "requires code", `static attribute values are invalid for ${variety}`),
	// noModifiers: (span: Span, variety: string) => ParseError(span, "invalid modifiers", `modifiers aren't allowed on ${variety}`),
	conflictingModifiers: (span: Span, message: string) => ParseError(span, "conflicting modifiers", message),
}
export const Warnings = {
	checkExtraneousModifiers(parse: Parse<unknown>, span: Span, modifiers: Dict<true>, variety: string) {
		const m = Object.keys(modifiers)
		if (m.length > 0)
			parse.warn(ParseWarning(span, 'extraneous modifiers', `these modifiers don't apply to ${variety}: ${m.join(', ')}`))
	},
	leafChildren: (span: Span, tagIdent: string) => ParseWarning(span, 'invalid children', `${tagIdent} tags don't have children`)
}
