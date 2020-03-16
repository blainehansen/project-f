import * as ts from 'typescript'

const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
	// const typeChecker = program.getTypeChecker

	// const visitor: ts.Visitor = node => transform(node) || ts.visitEachChild(node, visitor, context)
	// return sourceFile => ts.visitNode(sourceFile, visitor)
	return sourceFile => {
		return ts.updateSourceFileNode(sourceFile, [
			ts.createExpressionStatement(ts.createIdentifier('stuff')),
		  // Ensures the rest of the source files statements are still defined.
		  ...sourceFile.statements,
		])
	}
}
export default transformer



// function transform(node: ts.Node, typeChecker: ts.TypeChecker) {
// function transform(node: ts.Node) {
// 	// typeChecker.getSymbolAtLocation()
// 	// ts.getAliasedSymbol
// 	if (ts.isIdentifier(node)) {
// 		switch (node.escapedText) {
// 			case 'babel':
// 				return ts.createIdentifier('typescript')

// 			case 'plugins':
// 				return ts.createIdentifier('transformers')
// 		}
// 	}
// }
