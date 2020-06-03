import ts = require('typescript')
import { UniqueDict } from '@ts-std/collections'
import { SourceFile, Span } from 'kreia/dist/runtime/lexer'
import { Result, Ok, Err, Maybe, Some, None } from '@ts-std/monads'

import { Parser, Context } from './utils'
import { Dict, NonEmpty, exec } from '../utils'
import { reset, exit, wolf } from './wolf.grammar'
import { ComponentDefinition, Entity } from './ast'
import { generateComponentDefinition } from './codegen'

// we generally want to allow people to have scriptless component files
// if there's no script section at all, then we can backfill slots (which suddenly requires that useages are unique)

type AlmostComponentDefinition = [string[], string[], string[], Dict<boolean>, string[] | undefined]
export function processFile(source: string, lineWidth: number, filename: string): string {
	const parser = new Parser(lineWidth)
	const { template, script, style, ...others } = parser.expect(cutSource({ source, filename }))
	for (const section of Object.values(others)) {
		parser.warn('UNSUPPORTED_CUSTOM_SECTION', section.span)
		if (section.lang === undefined)
			parser.warn('LANGLESS_CUSTOM_SECTION', section.span)
	}
	if (style !== undefined)
		parser.warn('UNSUPPORTED_STYLE_SECTION', style.span)

	const entities = exec(() => {
		if (template === undefined)
			return []
		if (template.lang && template.lang !== 'wolf')
			return parser.die('UNSUPPORTED_TEMPLATE_LANG', template.span)

		reset(template.text)
		const entitiesResult = wolf()
		exit()
		const { value: entities, warnings } = parser.expect(entitiesResult)
		if (entities.length === 0)
			parser.warn('EMPTY_TEMPLATE', template.span)
		return entities
	})

	const [props, syncs, events, slots, createFn] = script === undefined
		// TODO here's where we'd add backfilled slots
		? [[], [], [], {}, undefined]
		: exec(() => {
			if (script.lang && script.lang !== 'ts')
				return parser.die('NON_TS_SCRIPT_LANG', script.span)
			const sourceFile = ts.createSourceFile(filename, script.text, ts.ScriptTarget.Latest, true)
			return parser.expect(inspect(sourceFile))
		})

	return parser.finalize(() => {
		const definition = new ComponentDefinition(props, syncs, events, slots, createFn, entities)
		return generateComponentDefinition(definition)
	})
}


const CTXFN: unique symbol = Symbol()
type CTXFN = typeof CTXFN
export function inspect(file: ts.SourceFile) {
	const ctx = new Context<AlmostComponentDefinition>()
	let foundCreateFns = [] as [ReturnType<typeof processCreateFn> | CTXFN, Span][]
	let foundComponents = [] as [ReturnType<typeof processComponentType>, Span][]

	function visitor(node: ts.Node): undefined {
		if (ts.isFunctionDeclaration(node)) {
			if (!node.name || !['create', 'createCtx'].includes(node.name.text)) return undefined
			foundCreateFns.push([node.name.text === 'createCtx' ? CTXFN : processCreateFn(file, node), getSpan(file, node)])
		}
		else if (ts.isTypeAliasDeclaration(node)) {
			if (node.name.text !== 'Component') return undefined
			foundComponents.push([processComponentType(file, node), getSpan(file, node)])
		}
		return undefined
	}
	file.forEachChild(visitor)

	const foundCreateFn = exec(() => {
		if (foundCreateFns.length > 1) {
			ctx.error('COMPONENT_CONFLICTING_CREATE', foundCreateFns[0][1], foundCreateFns[1][1])
			return undefined
		}
		const foundCreateFn = foundCreateFns[0][0]
		if (foundCreateFn === CTXFN) return foundCreateFn
		return ctx.take(foundCreateFn).ok_undef()
	})
	const foundComponent = exec(() => {
		if (foundComponents.length > 1) {
			ctx.error('COMPONENT_CONFLICTING_COMPONENT', foundComponents[0][1], foundComponents[1][1])
			return undefined
		}
		return ctx.take(foundComponents[0][0]).ok_undef()
	})

	const createFn = !foundCreateFn || foundCreateFn === CTXFN ? undefined : foundCreateFn
	const { bindings: { props = [], syncs = [], events = [] } = {}, slots = {} } = foundComponent || {}
	return ctx.Ok(() => [props, syncs, events, slots, createFn])
}


type ComponentDefinitionTypes = {
	bindings: { props: string[], events: string[], syncs: string[] },
	slots: Dict<boolean>,
}
function processComponentType(sourceFile: ts.SourceFile, componentType: ts.TypeAliasDeclaration) {
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

	const types: ComponentDefinitionTypes = { bindings: { props: [], events: [], syncs: [] }, slots: {} }
	for (const definitionMember of definition.members) {
		const result = ctx.subsume(processMember(sourceFile, definitionMember))
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
					const result = ctx.subsume(processMember(sourceFile, bindingMember))
					if (result.is_err()) return ctx.subsumeFail(result.error)
					const [, binding, optional] = result.value
					if (optional)
						ctx.warn('OPTIONAL_NON_SLOT', getSpan(sourceFile, bindingMember))

					types.bindings[variety].push(binding)
				}
				break

			case 'slots':
				for (const syncsMember of signatureType.members) {
					const result = ctx.subsume(processMember(sourceFile, syncsMember))
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

function processCreateFn(sourceFile: ts.SourceFile, createFn: ts.FunctionDeclaration) {
	const ctx = new Context<string[]>()
	if (!isNodeExported(createFn))
		ctx.warn('CREATE_NOT_EXPORTED', getSpan(sourceFile, createFn))

	const block = createFn.body!
	if (block.statements.length === 0) {
		ctx.warn('EMPTY_CREATE', getSpan(sourceFile, createFn))
		return ctx.Ok(() => [])
	}

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

function processMember(sourceFile: ts.SourceFile, member: ts.TypeElement) {
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
			ctx.error('DUPLICATE_SECTIONS', span, result.error)
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
			setSection(last, source.slice(0, index))

		source = source.slice(sectionIndex)
		last = { name: sectionName, lang, span: sectionMarkerSpan }
	}

	if (last === undefined)
		return ctx.Err('NO_SECTIONS', file)
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
