import ts = require('typescript')
import { UniqueDict } from '@ts-std/collections'
import { SourceFile, Span } from 'kreia/dist/runtime/lexer'
import { Result, Ok, Err, Maybe, Some, None } from '@ts-std/monads'

import { Parser, Context } from './utils'
import { Dict, NonEmpty, exec } from '../utils'
import { reset, exit, wolf } from './wolf/grammar'
import { generateComponentDefinition } from './codegen'
import { ComponentDefinition, Entity, CTXFN } from './ast'
import { ComponentDefinitionTypes, parseComponentDefinition } from './ast.parse'

// we generally want to allow people to have scriptless component files
// if there's no script section at all, then we can backfill slots (which suddenly requires that useages are unique)

// the compiler can also be called as a library, taking various hooks:
// - custom section processors, since it doesn't seem reasonable to let them change the way we handle the template or script, we can just only call these after template and script are processed and provide them with the script section sourcefile and the template ast
// custom section processors could return some discriminated prepend/append section for the script
// - maybe allow custom style processors? or assume that one of these days I'll make my own?
// - various classname hooks, things to add type assertions to class producing expressions, and possibly some "prepend" string, to include things like css library types

export function compileSource(
	source: string, filename: string,
	lineWidth: number, requireCustomLangs: boolean,
) {
	const parser = new Parser(lineWidth)
	const { template, script, style, ...others } = parser.expect(cutSource({ source, filename }))
	for (const section of Object.values(others)) {
		if (requireCustomLangs && section.lang === undefined)
			parser.warn('LANGLESS_CUSTOM_SECTION', section.span)
	}

	const entities = exec(() => {
		if (template === undefined)
			return []
		if (template.lang && template.lang !== 'wolf')
			return parser.die('UNSUPPORTED_TEMPLATE_LANG', template.span)

		reset(template.text, filename)
		const entitiesResult = wolf()
		exit()
		const entities = parser.expect(entitiesResult)
		if (entities.length === 0)
			parser.warn('EMPTY_TEMPLATE', template.span)
		return entities
	})

	const [definitionArgs, createFn, scriptText] = script === undefined ? [undefined, undefined, ''] : exec(() => {
		if (script.lang && script.lang !== 'ts')
			return parser.die('NON_TS_SCRIPT_LANG', script.span)
		const sourceFile = ts.createSourceFile(filename, script.text, ts.ScriptTarget.Latest, true)
		return [...parser.expect(inspect(sourceFile)), script.text]
	})

	const definition = parser.expect(parseComponentDefinition(definitionArgs, createFn, entities))
	return parser.finalize(() => ({
		transformed: generateComponentDefinition(definition) + '\n\n' + scriptText,
		style, others,
	}))
}


export function inspect(file: ts.SourceFile) {
	const ctx = new Context<[ComponentDefinitionTypes | undefined, NonEmpty<string> | CTXFN | undefined]>()
	let foundCreateFns = [] as [ReturnType<typeof inspectCreateFn> | CTXFN, Span][]
	let foundComponents = [] as [ReturnType<typeof inspectComponentType>, Span][]

	function visitor(node: ts.Node): undefined {
		if (ts.isFunctionDeclaration(node)) {
			if (!node.name || !['create', 'createCtx'].includes(node.name.text)) return undefined
			foundCreateFns.push([node.name.text === 'createCtx' ? CTXFN : inspectCreateFn(file, node), getSpan(file, node)])
		}
		else if (ts.isTypeAliasDeclaration(node)) {
			if (node.name.text !== 'Component') return undefined
			foundComponents.push([inspectComponentType(file, node), getSpan(file, node)])
		}
		return undefined
	}
	file.forEachChild(visitor)

	const createFn = exec(() => {
		if (foundCreateFns.length > 1) {
			ctx.error('COMPONENT_CONFLICTING_CREATE', foundCreateFns[0][1], foundCreateFns[1][1])
			return undefined
		}
		if (foundCreateFns.length === 0) return undefined
		const foundCreateFn = foundCreateFns[0][0]
		if (foundCreateFn === CTXFN) return foundCreateFn
		return ctx.take(foundCreateFn).change(NonEmpty.undef).ok_undef()
	})
	const component = exec(() => {
		if (foundComponents.length > 1) {
			ctx.error('COMPONENT_CONFLICTING_COMPONENT', foundComponents[0][1], foundComponents[1][1])
			return undefined
		}
		if (foundComponents.length === 0) return undefined
		return ctx.take(foundComponents[0][0]).ok_undef()
	})

	return ctx.Ok(() => [component, createFn])
}


function inspectComponentType(sourceFile: ts.SourceFile, componentType: ts.TypeAliasDeclaration) {
	const ctx = new Context<ComponentDefinitionTypes>()

	if (!isNodeExported(componentType))
		ctx.warn('COMPONENT_NOT_EXPORTED', getSpan(sourceFile, componentType))

	if (componentType.typeParameters !== undefined)
		// TODO
		throw new Error("We actually can AND SHOULD handle generic components properly")
		// return ctx.Err('COMPONENT_GENERIC', getSpan(sourceFile, componentType))

	const definition = componentType.type
	if (!ts.isTypeLiteralNode(definition))
		return ctx.Err('COMPONENT_NOT_OBJECT', getSpan(sourceFile, definition))

	const types: ComponentDefinitionTypes = { props: [], events: [], syncs: [], slots: {} }
	for (const definitionMember of definition.members) {
		const result = ctx.subsume(inspectMember(sourceFile, definitionMember))
		if (result.is_err()) return ctx.subsumeFail(result.error)
		const [signature, variety, optional] = result.value

		if (optional)
			ctx.warn('OPTIONAL_COMPONENT_BLOCK', getSpan(sourceFile, definitionMember))

		const signatureType = signature.type
		if (!signatureType || !ts.isTypeLiteralNode(signatureType))
			return ctx.Err('COMPONENT_BLOCK_NOT_OBJECT', getSpan(sourceFile, signature))

		switch (variety) {
			case 'props': case 'events': case 'syncs':
				for (const bindingMember of signatureType.members) {
					const result = ctx.subsume(inspectMember(sourceFile, bindingMember))
					if (result.is_err()) return ctx.subsumeFail(result.error)
					const [, binding, optional] = result.value
					if (optional)
						ctx.warn('OPTIONAL_NON_SLOT', getSpan(sourceFile, bindingMember))

					types[variety].push(binding)
				}
				break

			case 'slots':
				for (const syncsMember of signatureType.members) {
					const result = ctx.subsume(inspectMember(sourceFile, syncsMember))
					if (result.is_err()) return ctx.subsumeFail(result.error)
					const [, sync, optional] = result.value
					types.slots[sync] = optional
				}
				break

			default:
				return ctx.Err('UNKNOWN_COMPONENT_BLOCK', getSpan(sourceFile, definitionMember))
		}
	}

	return ctx.Ok(() => types)
}

function inspectCreateFn(sourceFile: ts.SourceFile, createFn: ts.FunctionDeclaration) {
	const ctx = new Context<string[]>()
	if (!isNodeExported(createFn))
		ctx.warn('CREATE_NOT_EXPORTED', getSpan(sourceFile, createFn))

	const block = createFn.body!
	if (block.statements.length === 0)
		return ctx.Ok(() => [])

	const lastStatement = block.statements[block.statements.length - 1]
	if (!lastStatement || !ts.isReturnStatement(lastStatement))
		return ctx.Err('CREATE_FINAL_NOT_RETURN', getSpan(sourceFile, lastStatement))
	const returnExpression = lastStatement.expression
	if (!returnExpression || !ts.isObjectLiteralExpression(returnExpression))
		return ctx.Err('CREATE_FINAL_NOT_OBJECT', getSpan(sourceFile, lastStatement))

	const returnNames = [] as string[]
	for (const property of returnExpression.properties) {
		if (ts.isShorthandPropertyAssignment(property)) {
			returnNames.push(property.name.text)
			continue
		}
		if (ts.isPropertyAssignment(property) || ts.isMethodDeclaration(property)) {
			if (!ts.isIdentifier(property.name))
				return ctx.Err('CREATE_COMPLEX_NAME', getSpan(sourceFile, property))
			returnNames.push(property.name.text)
			continue
		}
		if (ts.isGetAccessorDeclaration(property) || ts.isSetAccessorDeclaration(property))
			return ctx.Err('CREATE_ACCESSOR_PROPERTY', getSpan(sourceFile, property))

		return ctx.Err('CREATE_UNSUPPORTED_PROPERTY', getSpan(sourceFile, property))
	}

	return ctx.Ok(() => returnNames)
}

function inspectMember(sourceFile: ts.SourceFile, member: ts.TypeElement) {
	const ctx = new Context<[ts.PropertySignature, string, boolean]>()
	if (!ts.isPropertySignature(member))
		return ctx.Err('COMPONENT_PROPERTY_SIGNATURE', getSpan(sourceFile, member))
	const optional = member.questionToken !== undefined
	if (member.initializer !== undefined)
		return ctx.Err('COMPONENT_PROPERTY_INITIALIZED', getSpan(sourceFile, member.initializer))
	const name = member.name
	if (!ts.isIdentifier(name))
		return ctx.Err('COMPONENT_COMPLEX_NAME', getSpan(sourceFile, name))

	return ctx.Ok(() => [member, name.text, optional])
}

function isNodeExported(node: ts.Node): boolean {
	return (
		(ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0
		|| (!!node.parent && node.parent.kind === ts.SyntaxKind.SourceFile)
	)
}


const sectionMarker = /^#! (\S+)(?: lang="(\S+)")?[ \t]*\n?/m
type Section = { lang: string | undefined, span: Span, text: string }
export function cutSource(file: SourceFile) {
	const ctx = new Context<Dict<Section>>()
	const sections = new UniqueDict<Section>()

	type AlmostSection = Omit<Section, 'text'> & { name: string }
	function setSection({ name, lang, span }: AlmostSection, text: string) {
		const result = sections.set(name, { lang, span, text })
		if (result.is_err())
			ctx.error('DUPLICATE_SECTIONS', span, result.error[2].span)
	}

	let source = file.source; let position = 0; let line = 1
	let last = undefined as AlmostSection | undefined
	let matchResult
	while (matchResult = source.match(sectionMarker)) {
		const [entireMatch, sectionName, lang = undefined] = matchResult
		const sectionMarkerSpan = makeSpan(file, position, entireMatch, line, 0)

		const index = matchResult.index!
		const sectionIndex = index + entireMatch.length
		position += entireMatch.length
		line += entireMatch.split('\n').length - 1

		if (last !== undefined)
			setSection(last, '\n'.repeat(line - 2) + source.slice(0, index))

		source = source.slice(sectionIndex)
		// if (lang === undefined)
		// 	ctx.error('LANGLESS_SECTION')
		last = { name: sectionName, lang, span: sectionMarkerSpan }
	}

	if (last === undefined) {
		ctx.warn('NO_SECTIONS', file.filename || 'unknown file')
		return ctx.Ok(() => ({ script: { lang: undefined, text: file.source, span: makeSpan(file, 0, file.source, 1, 0) } }))
	}
	setSection(last, source)

	return ctx.Ok(() => sections.into_dict())
}


function getSpan(sourceFile: ts.SourceFile, { pos: start, end }: ts.TextRange): Span {
	const { line: zeroLine, character: column } = sourceFile.getLineAndCharacterOfPosition(start)
	const { text: source, fileName: filename } = sourceFile
	return { file: { source, filename }, start, end, line: zeroLine + 1, column }
}

function makeSpan(file: SourceFile, start: number, text: string, line: number, column: number): Span {
	return { file, start, end: start + text.length, line, column }
}
