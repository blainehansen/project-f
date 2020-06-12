import 'mocha'
import * as fs from 'fs'
import { expect } from 'chai'
import ts = require('typescript')

import { processFile, cutSource } from './process'

const cases: [string, string][] = [
	[],
]

describe('file processor', () => {
	for (const [description, filename] of cases)
		it(description, () => {
			const source = fs.readFileSync(filename, 'utf-8')
			const sourceFile = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest)
			processFile(processFile)
		})
})

