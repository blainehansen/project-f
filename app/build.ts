import ts = require('typescript')
import {
	Macro,
	BlockMacro, BlockMacroReturn,
	FunctionMacro, FunctionMacroReturn,
	ImportMacro, ImportMacroReturn,
} from 'macro-ts'
import { createTransformer } from 'macro-ts/lib/transformer'
import * as path from 'path'
import * as fs from 'fs'

import { Dict } from '../lib/utils'
import { compileSource } from '../lib/compiler'

type UnprocessedFile = { extension: string, source: string }
type BundlePayload = {
	ts?: { path: string, source: string },
	files: UnprocessedFile[],
}

// TODO we need a caching mechanism for import macros to use for their results
const macros: Dict<Macro<BundlePayload>> = {
	iron: ImportMacro(({ entryDir, currentDir }, target, clause, args, typeArgs) => {
		if (clause.isExport || !clause.clause || !clause.clause.name || clause.clause.namedBindings)
			throw new Error('unsupported')

		const fullTarget = `${target}.iron`
		const targetPath = path.join(entryDir, currentDir, fullTarget)
		const targetSource = fs.readFileSync(targetPath, 'utf-8')

		const { script, sectionFiles } = compileSource(
			targetSource, targetPath, process.stdout.columns,
			(name, { lang, span, text }, component, script) => {
				if (name !== 'style') throw new Error('unimplemented')

				return { files: [{ extension: lang || 'css', source: text }] }
			},
		)

		const statements = [ts.createImportDeclaration(
			undefined, undefined,
			ts.createImportClause(clause.clause.name, undefined),
			ts.createStringLiteral(fullTarget),
		)]
		return { statements, payload: { ts: { path: targetPath + '.ts', source: script }, files: sectionFiles } }
	}),
}


const alwaysOptions = {
	strict: true, target: ts.ScriptTarget.ESNext,
	module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.NodeJs,
	baseUrl: './examples',
	paths: {
		"project-f": ["../lib/runtime"],
		"project-f/*": ["../lib/*"]
	},
}

function compile(entryScript: string, macros: Dict<Macro<BundlePayload>>) {
	const transformedTsSourceMap: Dict<string> = {}
	const outputFiles: Dict<string> = {}

	const unprocessedFiles = [] as UnprocessedFile[]
	function receivePayload({ ts: script, files }: BundlePayload) {
		if (script) {
			console.log('script.path:', script.path)
			const sourceFile = ts.createSourceFile(script.path, script.source, alwaysOptions.target)
			const { transformed: [newSourceFile] } = ts.transform(sourceFile, [transformer])
			transformedTsSourceMap[script.path] = printer.printFile(newSourceFile)
		}
		Array.prototype.push.apply(unprocessedFiles, files)
	}

	const entryDir = path.dirname(entryScript)
	const entryFile = path.basename(entryScript)
	function dirMaker(sourceFileName: string) {
		const currentDir = path.relative(entryDir, path.dirname(sourceFileName))
		const currentFile = path.basename(sourceFileName)
		return { currentDir, currentFile }
	}

	const transformer = createTransformer(macros, receivePayload, entryDir, entryFile, dirMaker)


	const initialOptions = { ...alwaysOptions, noEmit: true, declaration: false, sourceMap: false }
	const initialProgram = ts.createProgram([entryScript], initialOptions)

	const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
	for (const sourceFile of initialProgram.getSourceFiles()) {
		if (sourceFile.isDeclarationFile) continue
		const { transformed: [newSourceFile] } = ts.transform(sourceFile, [transformer])
		transformedTsSourceMap[sourceFile.fileName] = printer.printFile(newSourceFile)
		if (sourceFile.fileName !== 'app/App.ts') continue
		console.log('sourceFile.fileName:', sourceFile.fileName)
		console.log('transformedTsSourceMap[sourceFile.fileName]')
		console.log(transformedTsSourceMap[sourceFile.fileName])
		console.log()
	}

	// const transformedRoundOptions = { ...alwaysOptions, outDir: 'dist', declaration: true, sourceMap: true }
	const transformedRoundOptions = {
		...alwaysOptions, declaration: false, sourceMap: false,
		// outDir: 'dist',
		module: ts.ModuleKind.AMD,
		outFile: "./app/App.js",
	}
	const defaultCompilerHost = ts.createCompilerHost(transformedRoundOptions)
	// https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#customizing-module-resolution
	const capturingCompilerHost: ts.CompilerHost = {
		...defaultCompilerHost,
		getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile) {
			if (!fileName.includes('node_modules')) {
				console.log('getSourceFile')
				console.log(fileName)
				console.log()
			}
			const transformedSource = transformedTsSourceMap[path.relative(process.cwd(), fileName)]
			return transformedSource !== undefined
				? ts.createSourceFile(fileName, transformedSource, languageVersion)
				: defaultCompilerHost.getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile)
		},
		fileExists(fileName) {
			if (!fileName.includes('node_modules')) {
				console.log('fileExists')
				console.log(fileName)
				console.log()
			}
			return path.relative(process.cwd(), fileName) in transformedTsSourceMap || defaultCompilerHost.fileExists(fileName)
		},
		writeFile(fileName, content) {
			console.log()
			console.log('writeFile')
			console.log(fileName)
			// console.log()
			// console.log(content)
			// console.log()
			outputFiles[fileName] = content
		},
		// getDefaultLibFileName: () => "lib.d.ts",
		// getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
		// getDirectories: path => ts.sys.getDirectories(path),
		// getCanonicalFileName: fileName => ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase(),
		// getNewLine: () => ts.sys.newLine,
		// useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
		// fileExists,
		// readFile,
		// resolveModuleNames,
	}
	const transformedProgram = ts.createProgram([entryScript], transformedRoundOptions, capturingCompilerHost)

	const diagnostics = ts.getPreEmitDiagnostics(transformedProgram)
	// use diagnostic.category === ts.DiagnosticCategory.Error to see if any of these are actually severe
	// if (diagnostics.length)
	for (const diagnostic of diagnostics)
		console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))
	// const emitResult = transformedProgram.emit()
	transformedProgram.emit()

	// const exitCode = emitResult.emitSkipped ? 1 : 0
	// process.exit(exitCode)

	// for (const { extension, source } of unprocessedFiles) {
	// 	console.log('extension:', extension)
	// }
}

compile('./app/App.ts', macros)










// https://developer.mozilla.org/en-US/docs/Glossary/Prefetch
// https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types
// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script
// https://developer.mozilla.org/en-US/docs/Web/HTML/Preloading_content
// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/style
// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link
// https://philipwalton.com/articles/deploying-es2015-code-in-production-today/

// type Resource =
// 	| {
// 		// sourcemaps?
// 		type: 'script' | 'style',
// 		mode: 'normal' | 'preload' | 'prefetch' | 'inline',
// 		location: 'head' | 'body',
// 		text: string,
// 	}
// 	| { type: 'static', path: string, extension: string, content: Buffer }


// let's just get brutally pragmatic and hack this thing together to understand all the ramifications
// we'll start with a typescript entry, at least for now





















// so concretely, the *real* steps in a bundler are:
// - first we need to be given some top level pipeline. this pipeline essentially takes whatever "entry" files make sense in this context and processes them in all the ways they need to be processed. perhaps this really just means that we need *some* way of marking entry files so they can get a special post processing step of some kind at the end
// - it seems we need to capture all normal typescript imports so that we're aware of all the dependencies. import macros need to also provide this same information by returning the files they produce, and of course if they produce a typescript file we'll capture *its* dependencies in the same way we did for those above
// - we need to be able to process files obviously, but we should do it in a filesystem agnostic way
// - given the Dict of macros, we have a readymade list of processors that can be applied to that set of file types. those macros should be used at every stage of processing

// - at the very end, we need a way to write out the final list of files. this seems as natural as to take a Dict of files, where the keys are the path it will be written to


// it seems that perhaps the system is this:
// first we take an array of entry files or a function that can produce a promise of them. the only way these files are different or special is that they're marked as "entry", and they also provide a function that takes those files after they've been processed and performs the final processing to turn them into their full "output" status
// in the context of a single page web app, a single entry is processed into a single html file, and that is done by this special function mentioned above
// the next step is that these files are simply processed according to the provided import macros! this means that any type of file can act as an entry
// as these files are processed, they might produce *more* files. those are simply processed in the exact same way, using import macros

// type File = { extension: string, source: string }
// type EntryFile = { entry: true } & File





// let's sketch out some examples:

// a single page app bundler:
// a single page app only really has one entry, whatever the main App component or main script is
// it still however should be able to have async components/code splitting and vendor chunks
// let's say we start with one entry ts file. that file (transitively) imports at least one component.
// that component will be processed with whatever import macro is registered for its extension. that component and
