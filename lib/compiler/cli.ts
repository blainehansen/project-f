#!/usr/bin/env node
import parseArgs = require('minimist')
import { normalize as normalizePath, join as joinPath, basename } from 'path'
import { sync as globSync } from 'glob'
import { readFileSync, writeFileSync } from 'fs'

import { compileSource } from './index'

const args = parseArgs(process.argv.slice(2), { boolean: ['add-require', 'help'] })
const directories = args._
delete args._
const addRequire: boolean = args['add-require']
delete args['add-require']
// TODO get mad about extraneous options

if (directories.length === 0) {
	console.error('expecting one or more directories')
	process.exit(1)
}

console.info([`compiling all *.iron files in these directories:`, ...directories].join('\n'))
for (const directory of directories)
	compileDirectory(directory, addRequire)



function writeFile(dest: string, text: string) {
	console.log(dest)
	// writeFileSync(dest, text, { flag: 'w' })
}

// TODO make this promise based and concurrent
export function compileDirectory(input: string, addRequire: boolean) {
	const inputDirectory = normalizePath(input)

	for (const filename of globSync(joinPath(inputDirectory, '**/*.iron'))) {
		const source = readFileSync(filename, 'utf-8')
		// const fileBasename = basename(filename)
		const { script, sectionFiles } = compileSource(source, filename, process.stdout.columns, undefined)

		let finalScript = script
		for (const { lang, text } of sectionFiles) {

			const sectionDest = `${filename}.${lang}`
			if (addRequire) finalScript += `\n\nrequire("${joinPath('.', sectionDest)}")`
			writeFile(sectionDest, text)
		}

		const dest = filename + '.ts'
		writeFile(dest, finalScript)
	}
}
