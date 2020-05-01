import 'mocha'
import { expect } from 'chai'

import { boilString } from '../utils.spec'
import {
	Entity, AttributeValue, Directive,
	ComponentDefinition, Tag, Meta, Attribute, AttributeCode, TextSection, TextItem,
	ComponentInclusion, IfBlock, EachBlock, MatchBlock, MatchPattern, SwitchBlock, SwitchCase, SwitchDefault,
	SlotDefinition, SlotInsertion, TemplateDefinition, TemplateInclusion,
} from './ast.spec'
import {
	printNode,
	// generate, generateEntity,
	generateComponentRenderFunction,
} from './codegen'

// function b(node: Parameters<typeof printNode>[0]) {
// 	return expect(boilString(printNode(node)))
// }
function boilEqual(actual: string, expected: string) {
	expect(boilString(actual)).equal(boilString(expected))
}

describe('generateComponentRenderFunction', () => {
	// div hello
	it('no argument component, simple div with text', () => {
		const generatedCode = generateComponentRenderFunction([], [], [], [], [], [
			Tag('div', [], [], [
				TextSection(TextItem(false, 'hello')),
			]),
		])

		const expected = `
			import { createElement as ___createElement, ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"

			const ___Component: ___ComponentDefinition<Component> = (___real, ___parent, {}, {}, {}, {}) => {
				const ___div0 = ___createElement(___parent, "div")
				___div0.textContent = "hello"
			}
			export default ___Component
		`
		boilEqual(generatedCode, expected)
	})

	// div: span hello
	it('no argument component, div with single span with text', () => {
		const generatedCode = generateComponentRenderFunction([], [], [], [], [], [
			Tag('div', [], [], [
				Tag('span', [], [], [TextSection(TextItem(false, 'hello'))]),
			]),
		])

		const expected = `
			import { createElement as ___createElement, ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"

			const ___Component: ___ComponentDefinition<Component> = (___real, ___parent, {}, {}, {}, {}) => {
				const ___div0 = ___createElement(___parent, "div")

				const ___span0_0 = ___createElement(___div0, "span")
				___span0_0.textContent = "hello"
			}
			export default ___Component
		`
		boilEqual(generatedCode, expected)
	})

	// div
	// 	span hello
	// 	div
	it('no argument component, div with two children', () => {
		const generatedCode = generateComponentRenderFunction([], [], [], [], [], [
			Tag('div', [], [], [
				Tag('span', [], [], [TextSection(TextItem(false, 'hello'))]),
				Tag('div', [], [], []),
			]),
		])

		const expected = `
			import { createElement as ___createElement, ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"

			const ___Component: ___ComponentDefinition<Component> = (___real, ___parent, {}, {}, {}, {}) => {
				const ___div0 = ___createElement(___parent, "div")
				const ___div0fragment = document.createDocumentFragment()

				const ___span0_0 = ___createElement(___div0fragment, "span")
				___span0_0.textContent = "hello"

				___createElement(___div0fragment, "div")

				___div0.appendChild(___div0fragment)
			}
			export default ___Component
		`
		boilEqual(generatedCode, expected)
	})
})

// describe('generate', () => {
// 	// div
// 	// 	input(type="text", placeholder="yo yo", :value=text)
// 	// 	| {{ text() }}
// 	it('TextInput example', () => {
// 		const entity = Tag('div', [], [], [
// 			Tag('input', [], [
// 				Attribute('type', "text"),
// 				Attribute('placeholder', "yo yo"),
// 				Attribute(':value', AttributeCode(true, 'text')),
// 			], []),
// 			TextSection(TextItem(true, ' text() ')),
// 		])
// 		const expected = `
// 			const ___parentFragment = document.createDocumentFragment()

// 			const ___component1 = document.createElement("div")
// 			const ___component1Fragment = document.createDocumentFragment()
// 			___parentFragment.appendChild(___component1)

// 			createSyncedTextInput(___component1Fragment, text, { placeholder: "yo yo" })
// 			// for the setter case
// 			createSyncedCheckboxInput(___component1Fragment, '', '', setter(completed, complete))

// 			const ___input1 = document.createElement("input")
// 			___input1.type = "text"
// 			___input1.placeholder = "yo yo"
// 			___input1.oninput = e => {
// 				text((e.target as typeof ___input1).value)
// 			}
// 			effect(() => {
// 				___input1.value = text()
// 			})
// 			___component1Fragment.appendChild(___input1)


// 			createdBoundText(___component1Fragment, text)
// 			const ___text2 = document.createTextNode('')
// 			effect(() => {
// 				___text2.data = text()
// 			})
// 			___component1Fragment.appendChild(___text2)


// 			___component1.appendChild(___component1Fragment)
// 			___parent.appendChild(___parentFragment)
// 		`
// 		boilEqual(generateEntity(entity, true, '___parent'), expected)
// 	})
// })

// describe('generateEntity', () => {
// 	it('', () => {
// 		//
// 	})
// })
