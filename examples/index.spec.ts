import 'mocha'
import { expect } from 'chai'
import { readFileSync } from 'fs'

import { compileFile } from '../lib/'
import { boilString } from '../lib/utils.spec'

const cases = ['Rating']

for (const name of cases) {
	const sourceFilename = `./examples/${name}.iron`
	const expected = readFileSync(sourceFilename + '.spec.ts', 'utf-8')
	describe(name, () => it('works', () => {
		expect(boilString(compileFile(sourceFilename))).equal(boilString(expected))
	}))
}
