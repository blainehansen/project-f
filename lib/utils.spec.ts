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
