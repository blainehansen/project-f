import ts = require('typescript')
import { UniqueDict } from '@ts-std/collections'
import { SourceFile, Span } from 'kreia/dist/runtime/lexer'
import { Result, Ok, Err, Maybe, Some, None } from '@ts-std/monads'

import { Parse } from './utils'
import { Dict, NonEmpty } from '../utils'
import { reset, exit, wolf } from './wolf.grammar'
import { ComponentDefinition, Entity } from './ast'
import { generateComponentDefinition } from './codegen'

// we generally want to allow people to have scriptless component files
// if there's no script section at all, then we can backfill slots (which suddenly requires that useages are unique),
// and we simply don't call


// let scriptSection = None as Maybe<string>
// let styleSection = None as Maybe<Section>
// let templateSection = None as Maybe<Section>
// const sections = {} as Dict<Section>

// function placeSection(name: string, lang: string | undefined, text: string) {
// 	switch (name) {
// 		case 'script':
// 			if (lang !== undefined) throw new Error("script section must be in typescript")
// 			if (scriptSection !== undefined) throw new Error("duplicate script section")
// 			scriptSection = text
// 			break
// 		case 'style':
// 			if (styleSection !== undefined) throw new Error("duplicate style section")
// 			styleSection = { name, lang: lang || 'css', text }
// 			break
// 		case 'template':
// 			if (templateSection !== undefined) throw new Error("duplicate template section")
// 			templateSection = { name, lang: lang || 'wolf', text }
// 			break
// 		default:
// 			if (lang === undefined) throw new Error("custom sections must specify a lang")
// 			if (sections[name] !== undefined) throw new Error(`duplicate section ${name}`)
// 			sections[name] = { name, lang, text }
// 	}
// }
// if (templateSection === undefined) throw new Error("component files have to have a template")
// return {
// 	template: templateSection,
// 	script: scriptSection || '',
// 	style: styleSection || '',
// 	others: Object.values(sections),
// }
type AlmostComponentDefinition = Omit<ConstructorParameters<ComponentDefinition>, '5'>
export function processFile(source: string, filename = '') {
	const parse = new Parse<string>()
	// TODO what to do with these? style, others
	const { template, script, style, ...others } = parse.expect(cutSource(source))
	for (const section of Object.values(others))
		parse.warn('UNSUPPORTED_SECTION', section.span)
	if (style !== undefined)
		parse.warn('UNSUPPORTED_STYLE_SECTION', style.span)

	if (template === undefined)
		return parse.die('NO_TEMPLATE', filename)
	if (template.lang && template.lang !== 'wolf')
		return parse.die('UNSUPPORTED_TEMPLATE_LANG', template.span)

	reset(template.text)
	const entitiesResult = wolf()
	exit()
	const { value: entities, warnings } = parse.expect(entitiesResult)
	if (entities.length === 0)
		return parse.die('EMPTY_TEMPLATE', filename)

	const [props, syncs, events, slots, createFn] = script === undefined
		// TODO here's where we'd add backfilled slots
		? [[], [], [], {}, undefined]
		: exec(() => {
			if (script.lang && script.lang !== 'ts')
				return parse.die('NON_TS_SCRIPT_LANG', script.span)
			const sourceFile = ts.createSourceFile(filename, script, ts.ScriptTarget.Latest, true)
			return parse.expect(inspect(sourceFile))
		})

	const definition = new ComponentDefinition(props, syncs, events, slots, createFn, entities as NonEmpty<Entity>)
	return generateComponentDefinition(definition)
}


const CTXFN: unique symbol = Symbol()
type CTXFN = typeof CTXFN
export function inspect(file: ts.SourceFile) {
	const parse = new Parse<AlmostComponentDefinition>()
	let foundCreateFns = [] as [ReturnType<typeof processCreateFn> | CTXFN, Span][]
	let foundComponents = [] as [ReturnType<typeof processComponentType>, Span][]

	function visitor(node: ts.Node): undefined {
		if (ts.isFunctionDeclaration(node)) {
			if (!node.name || !['create', 'createCtx'].includes(node.name.text)) return undefined
			foundCreateFns.push([node.name.text === 'createCtx' ? CTXFN : processCreateFn(node), getSpan(file, node)])
		}
		else if (ts.isTypeAliasDeclaration(node)) {
			if (node.name.text !== 'Component') return undefined
			foundComponents.push([processComponentType(node), getSpan(file, node)])
		}
		return undefined
	}
	file.forEachChild(visitor)

	const [foundCreateFn, ] = foundCreateFns.length > 1
		? [undefined, parse.error('COMPONENT_CONFLICTING_CREATE', foundCreateFns[0][1], foundCreateFns[1][1])]
		: [parse.take(foundCreateFn[0]).default(undefined)]
	const [foundComponent, ] = foundComponents.length > 1
		? [undefined, parse.error('COMPONENT_CONFLICTING_COMPONENT', foundComponents[0][1], foundComponents[1][1])]
		: [parse.take(foundComponents[0]).default(undefined)]

	const createFn = !foundCreateFn || foundCreateFn === CTXFN ? undefined : foundCreateFn
	const { bindings: { props = [], syncs = [], events = [] } = {}, slots = {} } = foundComponent || {}
	return parse.Ok(() => [props, syncs, events, slots, createFn])
}


type ComponentDefinitionTypes = {
	bindings: { props: string[], events: string[], syncs: string[] },
	slots: Dict<boolean>,
}
function processComponentType(sourceFile: ts.SourceFile, componentType: ts.TypeAliasDeclaration) {
	const parse = new Parse<ComponentDefinitionTypes>()

	if (!isNodeExported(componentType))
		parse.warn('COMPONENT_NOT_EXPORTED', getSpan(sourceFile, componentType))

	if (componentType.typeParameters !== undefined)
		return parse.Err('COMPONENT_GENERIC', getSpan(sourceFile, componentType))

	const definition = componentType.type
	if (!ts.isTypeLiteralNode(definition))
		return parse.Err('COMPONENT_NOT_OBJECT', getSpan(sourceFile, definition))

	const types: ComponentDefinitionTypes = { bindings: { props: [], events: [], syncs: [] }, slots: {} }
	for (const definitionMember of definition.members) {
		const result = parse.subsume(processMember(definitionMember))
		if (result.is_err()) return parse.ret(result.error)
		const [signature, variety, optional] = result.value

		if (optional)
			return parse.Err('OPTIONAL_COMPONENT_BLOCK', getSpan(sourceFile, definitionMember))

		const signatureType = signature.type
		if (!signatureType || !ts.isTypeLiteralNode(signatureType))
			return parse.Err('COMPONENT_BLOCK_NOT_OBJECT', getSpan(sourceFile, signatureType))

		switch (variety) {
			case 'props': case 'events': case 'syncs':
				for (const bindingMember of signatureType.members) {
					const result = parse.subsume(processMember(bindingMember))
					if (result.is_err()) return parse.ret(result.error)
					const [, binding, optional] = result.value
					if (optional)
						return parse.Err('OPTIONAL_NON_SLOT', getSpan(sourceFile, bindingMember))

					types.bindings[variety].push(binding)
				}
				break

			case 'slots':
				for (const syncsMember of signatureType.members) {
					const result = parse.subsume(processMember(syncsMember))
					if (result.is_err()) return parse.ret(result.error)
					const [, sync, optional] = result.value
					types.slots[sync] = optional
				}
				break

			default:
				return parse.Err('UNKNOWN_COMPONENT_BLOCK', getSpan(sourceFile, definitionMember))
		}
	}

	return parse.Ok(types)
}

function processCreateFn(sourceFile: ts.SourceFile, createFn: ts.FunctionDeclaration) {
	const parse = new Parse<string[]>()
	if (!isNodeExported(createFn))
		parse.warn('CREATE_NOT_EXPORTED', getSpan(sourceFile, createFn))

	const block = createFn.body!
	if (block.statements.length === 0) {
		parse.warn('EMPTY_CREATE', getSpan(sourceFile, createFn))
		return []
	}

	const lastStatement = block.statements[block.statements.length - 1]
	if (!lastStatement || !ts.isReturnStatement(lastStatement))
		return parse.Err('CREATE_FINAL_NON_RETURN', getSpan(sourceFile, lastStatement))
	const returnExpression = lastStatement.expression
	if (!returnExpression || !ts.isObjectLiteralExpression(returnExpression))
		return parse.Err('CREATE_FINAL_NOT_OBJECT', getSpan(sourceFile, returnExpression))

	const returnNames = [] as string[]
	for (const property of returnExpression.properties) {
		if (ts.isShorthandPropertyAssignment(property)) {
			returnNames.push(property.name.text)
			continue
		}
		if (ts.isPropertyAssignment(property) || ts.isMethodDeclaration(property)) {
			if (!ts.isIdentifier(property.name))
				return parse.Err('CREATE_COMPLEX_NAME', getSpan(sourceFile, property))
			returnNames.push(property.name.text)
			continue
		}
		if (ts.isGetAccessorDeclaration(property) || ts.isSetAccessorDeclaration(property))
			return parse.Err('CREATE_ACCESSOR_PROPERTY', getSpan(sourceFile, property))

		return parse.Err('CREATE_UNSUPPORTED_PROPERTY', getSpan(sourceFile, property))
	}

	return parse.Ok(returnNames)
}

function processMember(sourceFile: ts.SourceFile, member: ts.TypeElement) {
	const parse = new Parse<[ts.PropertySignature, string, boolean]>()
	if (!ts.isPropertySignature(member))
		return parse.Err('COMPONENT_PROPERTY_SIGNATURE', getSpan(sourceFile, member))
	const optional = member.questionToken !== undefined
	if (member.initializer !== undefined)
		return parse.Err('COMPONENT_PROPERTY_INITIALIZED', getSpan(sourceFile, member.initializer))
	const name = member.name
	if (!ts.isIdentifier(name))
		return parse.Err('COMPONENT_COMPLEX_NAME', getSpan(sourceFile, name))

	return parse.Ok([member, name.text, optional])
}

function isNodeExported(node: ts.Node): boolean {
	return (
		(ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0
		|| (!!node.parent && node.parent.kind === ts.SyntaxKind.SourceFile)
	)
}


const sectionMarker = /^#! (\S+)(?: lang="(\S+)")?[ \t]*\n?/m
type Section = { lang: string, span: Span, text: string }
export function cutSource(file: SourceFile) {
	const parse = new Parse<Dict<Section>>()
	const sections = new UniqueDict<Section>()

	type AlmostSection = Omit<Section, 'lang' | 'text'> & { name: string, lang: string | undefined }
	function setSection({ name, lang, span }: AlmostSection, text: string) {
		const result = sections.set(name, { lang, span, text })
		if (result.is_err())
			parse.error('DUPLICATE_SECTIONS', span, result.error)
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
		return parse.Err('NO_SECTIONS', file)
	setSection(last, source)

	return parse.Ok(sections.into_dict())
}


function getSpan(sourceFile: ts.SourceFile, { pos: start, end }: ts.TextRange): Span {
	const { line: zeroLine, character: column } = sourceFile.getLineAndCharacterOfPosition(start)
	const { text: source, fileName: filename } = sourceFile
	return { file: { source, filename }, start, end, line: zeroLine + 1, column }
}

function makeSpan(file: SourceFile, start: number, text: string, line: number, column: number): Span {
	return { file, start, end: start + text.length, line, column }
}
