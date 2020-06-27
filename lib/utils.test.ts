import fc from 'fast-check'
import { expect } from 'chai'

export function boilString(value: string) {
	return value
		.replace(/\s+/g, ' ')
		.replace(/\( /g, '(')
		.replace(/ \)/g, ')')
		.replace(/\{ /g, '{')
		.replace(/ \}/g, '}')
		.replace(/\[ /g, '[')
		.replace(/ \]/g, ']')
		.replace(/;/g, '')
		.trim()
}

export function boilEqual(actual: string, expected: string) {
	expect(boilString(actual)).equal(boilString(expected))
}


export function Command<R, M extends object>(
	toString: (this: fc.Command<M, R>) => string,
	check: (this: fc.Command<M, R>, m: Readonly<M>) => boolean,
	run: (this: fc.Command<M, R>, m: M, r: R) => void,
): fc.Command<M, R> {
	return { toString, check, run }
}
export type Command<R, M extends object> = fc.Command<M, R>
