import { readFileSync } from 'fs'

import { processFile } from './templating/process'

export function compileFile(filename: string) {
	const source = readFileSync(filename, 'utf-8')
	return processFile(source, process.stdout.columns, filename)
}
