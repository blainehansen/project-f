#!/usr/bin/env node

// https://stackoverflow.com/questions/30335637/get-width-of-terminal-in-node-js

import { readFileSync, writeFileSync } from 'fs'


import { processFile } from './templating/process'

const args = process.argv.slice(2)

const inputFilename = args[0]
if (inputFilename === undefined)
	throw new Error("no input filename provided")

const source = readFileSync(inputFilename, 'utf-8')
const code = compile(source, inputFilename)

if (output_filename === undefined)
	process.stdout.write(code)
else
	writeFileSync(output_filename, code)




// import * as glob from 'glob'
// import * as path from 'path'

// import { wolf, reset, exit } from './wolf/grammar'
// import { transform } from './C/compiler/transform'
// import { codeGen } from './C/compiler/codeGen'

// type Dict<T> = { [key: string]: T }

// export function compile_directory(input: string) {
// 	const input_directory = path.normalize(input)

// 	for (const file of glob.sync(path.join(input_directory, '**/*.iron'))) {
// 		const contents = process_source(readFileSync(file, 'utf-8'))

// 		reset(contents.template.trimStart())
// 		const raw_ast = wolf()
// 		exit()

// 		const ast = { type: 'Program' as const, segments: raw_ast }
// 		const params = { sourcemap: null, sourcefile: '', targetfile: '' }
// 		const transformed = transform(ast, params)
// 		const code = codeGen(transformed, params)

// 		const dest = file + '.ts'
// 		const final_code = replace(
// 			code.slice(14, code.length - 4),
// 			'Surplus.S.effect(function (__range) { return Surplus.insert(__range',
// 			`Surplus.S.effect(function (__range: Parameters<typeof Surplus.insert>['0']) { return Surplus.insert(__range`,
// 		)

// 		writeFileSync(
// 			dest, [
// 				`import * as Surplus from 'surplus'`,
// 				contents.script,
// 				`export default function () {${final_code}}`,
// 			].join('\n\n'),
// 			{ flag: 'w' },
// 		)
// 	}
// }

// compile_directory('./app')
