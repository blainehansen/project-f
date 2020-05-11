import ts = require('typescript')
import { ComponentDefinition } from './ast'

export function inspector(file: ts.SourceFile): ComponentDefinition | undefined {
	return file.forEachChild(visitor)
}

function visitor(node: ts.Node): ComponentDefinition | undefined {
	if (ts.isTypeAliasDeclaration(node)) {
		if (node.name.text !== 'Component') return undefined
		processComponentType(node)
	}
	if (ts.isFunctionDeclaration(node)) {
		if (!node.name || node.name.text !== 'create') return undefined
		processCreateFn(node)
	}

	// createFnNames
	// entities
	// return new ComponentDefinition()
	return undefined
}


function processComponentType(componentType: ts.TypeAliasDeclaration) {
	if (!isNodeExported(componentType)) throw new Error("your Component type isn't exported")
	if (componentType.typeParameters !== undefined) throw new Error("your Component type shouldn't have generic parameters")
	const definition = componentType.type
	if (!ts.isTypeLiteralNode(definition)) throw new Error("your Component type must be an object literal type")

	for (const definitionMember of definition.members) {
		const [signature, variety, optional] = processMember(definitionMember)
		if (optional)
			throw new Error("doesn't make sense here")

		const signatureType = signature.type
		if (!signatureType || !ts.isTypeLiteralNode(signatureType)) throw new Error(`${variety} must be an object literal type`)

		switch (variety) {
			case 'props': case 'events': case 'syncs':
				const bindings = signatureType
				for (const bindingMember of bindings.members) {
					const [, binding, optional] = processMember(bindingMember)
					if (optional)
						throw new Error("doesn't make sense here")
					console.log(`${variety}:`, binding)
				}
				break

			case 'slots':
				const syncs = signatureType
				for (const syncsMember of syncs.members) {
					const [, sync, optional] = processMember(syncsMember)
					console.log('slot:', sync, optional)
				}
				break

			default:
				throw new Error("doesn't make sense here")
		}
	}
}

function processCreateFn(createFn: ts.FunctionDeclaration) {
	if (!isNodeExported(createFn)) throw new Error("your create function isn't exported")

	const block = createFn.body
	if (!block) throw new Error("undefined FunctionDeclaration block??")
	// in the future we should emit a warning that they don't have to have a create function if there's nothing for it to do
	if (block.statements.length === 0) return

	const lastStatement = block.statements[block.statements.length - 1]
	if (!lastStatement || !ts.isReturnStatement(lastStatement))
		throw new Error("the last statement of a create function has to be a return")
	const returnExpression = lastStatement.expression
	if (!returnExpression || !ts.isObjectLiteralExpression(returnExpression))
		throw new Error("the return value of a create function has to be an object literal")

	for (const property of returnExpression.properties) {
		if (ts.isShorthandPropertyAssignment(property)) {
			console.log('shorthand:', property.name.text)
			continue
		}
		if (ts.isPropertyAssignment(property) || ts.isMethodDeclaration(property)) {
			if (!ts.isIdentifier(property.name))
				throw new Error("at this point we can only handle simple property assignments")
			console.log('property:', property.name.text)
			continue
		}
		if (ts.isGetAccessorDeclaration(property) || ts.isSetAccessorDeclaration(property)) {
			throw new Error("get or set accessors don't really make any sense in a component create function")
		}

		// TODO it's possible to do anything with a value known at compile time
		// so computed or spreads with some known values could be done
		// https://learning-notes.mistermicheels.com/javascript/typescript/compiler-api/#getting-type-information
		throw new Error("at this point we can only handle simple property assignments")
	}
}

function processMember(member: ts.TypeElement): [ts.PropertySignature, string, boolean] {
	if (!ts.isPropertySignature(member))
		throw new Error("doesn't make sense here")
	const optional = member.questionToken !== undefined
	if (member.initializer !== undefined)
		throw new Error("doesn't make sense here")
	const name = member.name
	if (!ts.isIdentifier(name))
		throw new Error("doesn't make sense here")

	return [member, name.text, optional]
}

function isNodeExported(node: ts.Node): boolean {
	return (
		(ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0
		|| (!!node.parent && node.parent.kind === ts.SyntaxKind.SourceFile)
	)
}


const source = `
export type Component = {
	props: {
		a: number, b: Something<whatever>,
	},
	events: {
		msg: [string, boolean],
	},
	syncs: {
		checked: boolean,
	},
	slots: {
		s: whatever,
		y?: anything,
	},
}
export function create() {
	const a = d()
	return { a, e: 'a', s() {} }
}
`

const sourceFile = ts.createSourceFile('blah', source, ts.ScriptTarget.Latest, /*setParentNodes */ true)
inspector(sourceFile)
