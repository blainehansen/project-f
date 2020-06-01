import 'mocha'
import * as glob from 'glob'
import * as path from 'path'
import { expect } from 'chai'
import { readFileSync } from 'fs'

import { compileFile } from '../lib/'
import { boilString } from '../lib/utils.spec'

for (const sourceFilename of glob.sync('./examples/**/*.iron')) {
	const expected = readFileSync(sourceFilename + '.spec.ts', 'utf-8')
	describe(path.basename(sourceFilename, '.iron'), () => it('works', () => {
		expect(boilString(compileFile(sourceFilename))).equal(boilString(expected))
	}))
}
