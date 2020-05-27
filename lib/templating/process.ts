import ts = require('typescript')
import { Span } from 'kreia/dist/runtime/lexer'
import { Result, Ok, Err, Maybe, Some, None } from '@ts-std/monads'

import { parseExpect } from './utils'
import { Dict, NonEmpty } from '../utils'
import { reset, exit, wolf } from './wolf.grammar'
import { ComponentDefinition, Entity } from './ast'
import { generateComponentDefinition } from './codegen'

// we generally want to allow people to have scriptless component files
// if there's no script section at all, then we can backfill slots (which suddenly requires that useages are unique),
// and we simply don't call

export function processFile(source: string, filename = '') {
	// TODO what to do with these? style, others
	const { template, script, style, others } = cutSource(source)
	const sourceFile = ts.createSourceFile(filename, script, ts.ScriptTarget.Latest, true)
	const { props, syncs, events, slots, createFn } = inspect(sourceFile)

	reset(template)
	const entitiesResult = wolf()
	exit()
	const { value: entities, warnings } = parseExpect(entitiesResult)

	const definition = new ComponentDefinition(
		props, syncs, events, slots, createFn,
		NonEmpty.expect(entities, "a component definition's template shouldn't be empty"),
	)
	// warnings
	return generateComponentDefinition(definition)
}


const CTXFN: unique symbol = Symbol()
type CTXFN = typeof CTXFN
export function inspect(file: ts.SourceFile) {
	let foundCreateFn = undefined as string[] | CTXFN | undefined
	let foundNames = undefined as ReturnType<typeof processComponentType> | undefined

	function visitor(node: ts.Node): undefined {
		if (ts.isFunctionDeclaration(node)) {
			if (!node.name || !['create', 'createCtx'].includes(node.name.text)) return undefined
			if (foundCreateFn !== undefined) throw new Error("you can't have a create function and a createCtx function")
			foundCreateFn = node.name.text === 'createCtx' ? CTXFN : processCreateFn(node)
		}
		if (ts.isTypeAliasDeclaration(node)) {
			if (node.name.text !== 'Component') return undefined
			// not going to bother getting mad about foundNames !== undefined, typescript will give them an error soon
			foundNames = processComponentType(node)
		}
		return undefined
	}

	file.forEachChild(visitor)

	if (foundCreateFn === undefined || foundNames === undefined)
		throw new Error("mad")

	const createFn = foundCreateFn === CTXFN ? undefined : foundCreateFn
	const { bindings: { props, syncs, events }, slots } = foundNames
	return { props, syncs, events, slots, createFn }
}


function processComponentType(componentType: ts.TypeAliasDeclaration) {
	if (!isNodeExported(componentType)) throw new Error("your Component type isn't exported")
	if (componentType.typeParameters !== undefined) throw new Error("your Component type shouldn't have generic parameters")
	const definition = componentType.type
	if (!ts.isTypeLiteralNode(definition)) throw new Error("your Component type must be an object literal type")

	const bindings = { props: [] as string[], events: [] as string[], syncs: [] as string[] }
	const slots = {} as Dict<boolean>
	for (const definitionMember of definition.members) {
		const [signature, variety, optional] = processMember(definitionMember)
		if (optional)
			throw new Error("doesn't make sense here")

		const signatureType = signature.type
		if (!signatureType || !ts.isTypeLiteralNode(signatureType)) throw new Error(`${variety} must be an object literal type`)

		switch (variety) {
			case 'props': case 'events': case 'syncs':
				for (const bindingMember of signatureType.members) {
					const [, binding, optional] = processMember(bindingMember)
					if (optional)
						throw new Error("doesn't make sense here")
					bindings[variety].push(binding)
				}
				break

			case 'slots':
				for (const syncsMember of signatureType.members) {
					const [, sync, optional] = processMember(syncsMember)
					slots[sync] = optional
				}
				break

			default:
				throw new Error("doesn't make sense here")
		}
	}

	return { bindings, slots }
}

function processCreateFn(createFn: ts.FunctionDeclaration): string[] {
	if (!isNodeExported(createFn)) throw new Error("your create function isn't exported")

	const block = createFn.body
	if (!block) throw new Error("undefined FunctionDeclaration block??")
	// in the future we should emit a warning that they don't have to have a create function if there's nothing for it to do
	if (block.statements.length === 0) return []

	const lastStatement = block.statements[block.statements.length - 1]
	if (!lastStatement || !ts.isReturnStatement(lastStatement))
		throw new Error("the last statement of a create function has to be a return")
	const returnExpression = lastStatement.expression
	if (!returnExpression || !ts.isObjectLiteralExpression(returnExpression))
		throw new Error("the return value of a create function has to be an object literal")

	const returnNames = [] as string[]
	for (const property of returnExpression.properties) {
		if (ts.isShorthandPropertyAssignment(property)) {
			returnNames.push(property.name.text)
			continue
		}
		if (ts.isPropertyAssignment(property) || ts.isMethodDeclaration(property)) {
			if (!ts.isIdentifier(property.name))
				throw new Error("at this point we can only handle simple property assignments")
			returnNames.push(property.name.text)
			continue
		}
		if (ts.isGetAccessorDeclaration(property) || ts.isSetAccessorDeclaration(property)) {
			throw new Error("get or set accessors don't really make any sense in a component create function")
		}

		throw new Error("at this point we can only handle simple property assignments")
	}

	return returnNames
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


const sectionMarker = /^#! (\S+)(?: lang="(\S+)")?[ \t]*\n?/m
type Section = { name: string, lang: string, text: string }
export function cutSource(rawSource: string) {
	let scriptSection = None as Maybe<string>
	let styleSection = None as Maybe<Section>
	let templateSection = None as Maybe<Section>
	const sections = {} as Dict<Section>

	function placeSection(name: string, lang: string | undefined, text: string) {
		switch (name) {
			case 'script':
				if (lang !== undefined) throw new Error("script section must be in typescript")
				if (scriptSection !== undefined) throw new Error("duplicate script section")
				scriptSection = text
				break
			case 'style':
				if (styleSection !== undefined) throw new Error("duplicate style section")
				styleSection = { name, lang: lang || 'css', text }
				break
			case 'template':
				if (templateSection !== undefined) throw new Error("duplicate template section")
				templateSection = { name, lang: lang || 'wolf', text }
				break
			default:
				if (lang === undefined) throw new Error("custom sections must specify a lang")
				if (sections[name] !== undefined) throw new Error(`duplicate section ${name}`)
				sections[name] = { name, lang, text }
		}
	}

	let source = rawSource
	let last = undefined as { name: string, lang: string | undefined } | undefined
	let result
	while (result = source.match(sectionMarker)) {
		const [entireMatch, sectionName, lang = undefined] = result
		const index = result.index!
		const sectionIndex = index + entireMatch.length

		if (last !== undefined)
			placeSection(last.name, last.lang, source.slice(0, index))

		source = source.slice(sectionIndex)
		last = { name: sectionName, lang }
	}

	if (last === undefined) throw new Error("no sections?")
	placeSection(last.name, last.lang, source)

	if (templateSection === undefined) throw new Error("component files have to have a template")
	return {
		template: templateSection,
		script: scriptSection || '',
		style: styleSection || '',
		others: Object.values(sections),
	}
}
