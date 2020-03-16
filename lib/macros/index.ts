// import ts from "typescript"

// // hardcode our input file
// const filePath = "./src/models.ts"

// // create a program instance, which is a collection of source files
// // in this case we only have one source file
// const program = ts.createProgram([filePath], {})

// // pull off the typechecker instance from our program
// const checker = program.getTypeChecker()

// // get our models.ts source file AST
// const source = program.getSourceFile(filePath)

// // create TS printer instance which gives us utilities to pretty print our final AST
// const printer = ts.createPrinter()

// // helper to give us Node string type given kind
// const syntaxToKind = (kind: ts.Node["kind"]) => {
// 	return ts.SyntaxKind[kind]
// }
// // visit each node in the root AST and log its kind
// ts.forEachChild(source, node => {
// 	console.log(syntaxToKind(node.kind))
// })



// function compiler (configFilePath: string) {
// 	const host: ts.ParseConfigFileHost = ts.sys as any
// 	// Fix after https://github.com/Microsoft/TypeScript/issues/18217
// 	host.onUnRecoverableConfigFileDiagnostic = printDiagnostic
// 	const parsedCmd = ts.getParsedCommandLineOfConfigFile(configFilePath, undefined, host)
// 	host.onUnRecoverableConfigFileDiagnostic = undefined

// 	const {options, fileNames} = parsedCmd

// 	const program = ts.createProgram({
// 		rootNames: fileNames,
// 		options,
// 	})

// 	const emitResult = program.emit(
// 		undefined,
// 		undefined,
// 		undefined,
// 		undefined,
// 		{
// 			before: [],
// 			after: [],
// 			afterDeclarations: [],
// 		}
// 	)

// 	ts.getPreEmitDiagnostics(program)
// 		.concat(emitResult.diagnostics)
// 		.forEach(diagnostic => {
// 			let msg = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
// 			if (diagnostic.file) {
// 				const {line, character} = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
// 				msg = `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${msg}`
// 			}
// 			console.error(msg)
// 		})

// 	const exitCode = emitResult.emitSkipped ? 1 : 0
// 	if (exitCode) {
// 		console.log(red(`Process exiting with code '${exitCode}'.`))
// 		process.exit(exitCode)
// 	}
// }




// import ts = require('typescript')

// const transformer = sourceFile => {
// 	const visitor = (node: ts.Node): ts.Node => {
// 		console.log(node.kind, `\t# ts.SyntaxKind.${ts.SyntaxKind[node.kind]}`)
// 		return ts.visitEachChild(node, visitor, context)
// 	}

// 	return ts.visitNode(sourceFile, visitor)
// }
