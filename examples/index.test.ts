import 'mocha'
import * as glob from 'glob'
import * as path from 'path'
import { expect } from 'chai'
import { readFileSync } from 'fs'

import { compileSource } from '../lib/compiler'
function boilSource(source: string) {
	return source
		.replace(/    /g, '	')
		.replace(/\n+/g, '\n')
		.replace(/;\n/g, '\n')
		.trim()
}

describe('examples', () => {
	for (const sourceFilename of glob.sync('./examples/**/*.iron'))
		it(path.basename(sourceFilename, '.iron'), () => {
			const source = readFileSync(sourceFilename, 'utf-8')
			const expected = readFileSync(sourceFilename + '.expected.ts', 'utf-8')
			const { script: actual } = compileSource(source, sourceFilename, 0, () => ({}))
			expect(boilSource(actual)).equal(boilSource(expected))
		})
})

