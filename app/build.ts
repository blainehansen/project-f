import ts = require('typescript')
import {
	Macro,
	BlockMacro, BlockMacroReturn,
	FunctionMacro, FunctionMacroReturn,
	ImportMacro, ImportMacroReturn,
} from 'macro-ts/lib'
import { createTransformer } from 'macro-ts/lib/transformer'
import * as path from 'path'
import * as fs from 'fs'

import { Dict } from '../lib/utils'
import { compileSource } from '../lib/compiler'

type BundlePayload = {
	ts?: { path: string, source: string },
	// sources: UnprocessedFile[],
	resources: [],
}

// TODO sourcemaps?
type Resource =
	|  {
		type: 'script',
		// https://developer.mozilla.org/en-US/docs/Learn/JavaScript/First_steps/What_is_JavaScript#Script_loading_strategies
		// async is only valid when the script in question is independent, so my guess is it never really applies to us
		// https://javascript.info/script-async-defer
		mode: 'module' | 'defer' | 'async' | 'inline',
		// module has the same behavior as defer
		// and implicitly the other types have the nomodule addition (for modern mode)
		path: string,
	}
	| {
		type: 'style',
		mode: 'normal' | 'preload' | 'prefetch' | 'inline',
		path: string,
	}
	| {}
	| {
		type: 'static',
		preload?: true,
		path: string,
		content: string | Buffer,
	}
	| {
		// for embedding information from server rendering?
		type: 'json',
	}

type HtmlArgs = {
	title?: string,
	body: string,
	scripts: { path: string, mode: 'module' | 'defer' | 'async' | 'inline' }[],
	styles: { path: string, mode: 'normal' | 'preload' | 'inline' }[],
	preloadLinks: { href: string, as: string }[],
	prefetchLinks: { href: string, dns?: true }[],
	// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta
	charset?: string,
	contentSecurityPolicy?: string,
	base?: { href: string, target: '_self' | '_blank' | '_parent' | '_top' },
	metas: { name: string, content: string }[],
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
		return { statements, payload: { ts: { path: targetPath + '.ts', source: script }, sources: sectionFiles } }
	}),

	// scss: ImportMacro(({ entryDir, currentDir }, target, clause, args, typeArgs) => {
	// 	// const result = sass.renderSync({
	// 	// 	data: scss_content
	// 	// 	[, options..]
	// 	// })
	// }),
}


const alwaysOptions = {
	strict: true, target: ts.ScriptTarget.ESNext,
	module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.NodeJs,
	baseUrl: '.',
	paths: {
		"project-f": ["./lib/runtime"],
		"project-f/*": ["./lib/*"],
	},
}

compile('./app/App.ts', macros)










// https://developer.mozilla.org/en-US/docs/Web/HTML/Preloading_content
// (preload is used for resources that will be needed urgently in the current page)
// https://developer.mozilla.org/en-US/docs/Glossary/Prefetch
// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script
// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/style
// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link
// https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types
// https://philipwalton.com/articles/deploying-es2015-code-in-production-today/

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
