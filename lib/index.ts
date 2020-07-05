import { readFileSync } from 'fs'

import { compileSource } from './compiler'

export function compileFile(filename: string) {
	const source = readFileSync(filename, 'utf-8')
	return compileSource(source, process.stdout.columns, filename)
}
