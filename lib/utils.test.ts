import fc from 'fast-check'
import { expect } from 'chai'
import { Dict } from './utils'

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


export function Command<M extends object, R>(
	toString: (this: fc.Command<M, R>) => string,
	check: (this: fc.Command<M, R>, m: Readonly<M>) => boolean,
	run: (this: fc.Command<M, R>, m: M, r: R) => void,
): fc.Command<M, R> {
	return { toString, check, run }
}
export type Command<M extends object, R> = fc.Command<M, R>

// export function Commands<M extends object, R>(): Command<M, R>[] {
// 	//
// }
