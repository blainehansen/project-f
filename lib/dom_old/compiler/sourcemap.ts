import { Params } from './compile'
import { LOC } from './parse'

const rx = {
	locs: /(\n)|(\u0000(\d+),(\d+)\u0000)/g,
}
const vlqFinalDigits = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef'
const vlqContinuationDigits = 'ghijklmnopqrstuvwxyz0123456789+/'

export function locationMark(loc: LOC) {
	return `\u0000${ loc.line },${ loc.col }\u0000`
}

function extractMappings(embedded: string) {
	let line = [] as string[]
	const lines = [] as string[][]
	let lastGeneratedCol = 0
	let lastSourceLine = 0
	let lastSourceCol = 0
	let lineStartPos = 0
	let lineMarksLength = 0

	const src = embedded.replace(rx.locs, (_, nl: string, mark: string, sourceLine: string, sourceCol: string, offset: number) => {
		if (nl) {
			lines.push(line)
			line = []

			lineStartPos = offset + 1
			lineMarksLength = 0
			lastGeneratedCol = 0

			return nl
		}
		else {
			const generatedCol = offset - lineStartPos - lineMarksLength
			const sourceLineNum = parseInt(sourceLine, 10)
			const sourceColNum = parseInt(sourceCol, 10)

			line.push(`${vlq(generatedCol - lastGeneratedCol)
			}A${ // only one file
				vlq(sourceLineNum - lastSourceLine)
			}${vlq(sourceColNum - lastSourceCol)}`)

			lineMarksLength += mark.length

			lastGeneratedCol = generatedCol
			lastSourceLine = sourceLineNum
			lastSourceCol = sourceColNum

			return ''
		}
	})

	lines.push(line)

	const mappings = lines.map(l => l.join(',')).join(';')

	return {
		src,
		mappings,
	}
}

export function extractMap(src: string, original: string, opts: Params) {
	const extract = extractMappings(src)
	const map = createMap(extract.mappings, original, opts)

	return {
		src: extract.src,
		map,
	}
}

function createMap(mappings: string, original: string, opts: Params) {
	return {
		version: 3,
		file: opts.targetfile,
		sources: [opts.sourcefile],
		sourcesContent: [original],
		names: [],
		mappings,
	}
}

export function appendMap(src: string, original: string, opts: Params) {
	const extract = extractMap(src, original, opts)
	const appended = `${extract.src
	}\n//# sourceMappingURL=data:application/json,${
		encodeURIComponent(JSON.stringify(extract.map))}`

	return appended
}

function vlq(num: number) {
	let str = ''; let i

	// convert num sign representation from 2s complement to sign bit in lsd
	num = num < 0 ? (-num << 1) + 1 : num << 1 + 0

	// convert num to base 32 number
	const numstr = num.toString(32)

	// convert base32 digits of num to vlq continuation digits in reverse order
	for (i = numstr.length - 1; i > 0; i--)
		str += vlqContinuationDigits[parseInt(numstr[i], 32)]

	// add final vlq digit
	str += vlqFinalDigits[parseInt(numstr[0], 32)]

	return str
}
