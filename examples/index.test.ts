import 'mocha'
import * as glob from 'glob'
import * as path from 'path'
import { expect } from 'chai'
import { readFileSync } from 'fs'

import { compileFile } from '../lib/'
function boilSource(source: string) {
	return source
		.replace(/    /g, '	')
		.replace(/\n+/g, '\n')
		.replace(/;\n/g, '\n')
}

for (const sourceFilename of glob.sync('./examples/**/*.iron')) {
	const expected = readFileSync(sourceFilename + '.ts', 'utf-8')
	describe(path.basename(sourceFilename, '.iron'), () => it('works', () => {
		// expect(boilSource(compileFile(sourceFilename))).equal(boilSource(expected))
		console.log(boilSource(compileFile(sourceFilename)))
		console.log(boilSource(expected))
	}))
}
