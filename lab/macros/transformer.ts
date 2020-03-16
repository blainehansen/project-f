import * as ts from 'typescript'

const transformer: ts.TransformerFactory<ts.SourceFile> = context => {
	const visitor: ts.Visitor = node => transform(node) || ts.visitEachChild(node, visitor, context)
	return sourceFile => ts.visitNode(sourceFile, visitor)
}
export default transformer



function transform(node: ts.Node) {
	if (ts.isIdentifier(node)) {
		switch (node.escapedText) {
			case 'babel':
				return ts.createIdentifier('typescript')

			case 'plugins':
				return ts.createIdentifier('transformers')
		}
	}
}
