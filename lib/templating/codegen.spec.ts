import 'mocha'
import { expect } from 'chai'

import { boilString } from '../utils.spec'
import { Tag, Meta, Attribute, AttributeCode, Directive, TextSection, TextItem, Entity, AttributeValue } from './ast.spec'
import {
	generate, generateEntity,
} from './codegen'

// function b(node: Parameters<typeof printNode>[0]) {
// 	return expect(boilString(printNode(node)))
// }
function boilEqual(actual: string, expected) {
	expect(boilString(actual)).equal(boilString(expected))
}

describe('generate', () => {
	// div
	// 	input(type="text", placeholder="yo yo", :value=text)
	// 	| {{ text() }}
	it('TextInput example', () => {
		const entity = Tag('div', [], [], [
			Tag('input', [], [
				Attribute('type', "text"),
				Attribute('placeholder', "yo yo"),
				Attribute(':value', AttributeCode(true, 'text')),
			], []),
			TextSection(TextItem(true, ' text() ')),
		])
		const expected = `
			const ___parentFragment = document.createDocumentFragment()

			const ___component1 = document.createElement("div")
			const ___component1Fragment = document.createDocumentFragment()
			___parentFragment.appendChild(___component1)

			createSyncedTextInput(___component1Fragment, text, { placeholder: "yo yo" })
			// for the setter case
			createSyncedCheckboxInput(___component1Fragment, '', '', setter(completed, complete))

			const ___input1 = document.createElement("input")
			___input1.type = "text"
			___input1.placeholder = "yo yo"
			___input1.oninput = e => {
				text((e.target as typeof ___input1).value)
			}
			effect(() => {
				___input1.value = text()
			})
			___component1Fragment.appendChild(___input1)


			createdBoundText(___component1Fragment, text)
			const ___text2 = document.createTextNode('')
			effect(() => {
				___text2.data = text()
			})
			___component1Fragment.appendChild(___text2)


			___component1.appendChild(___component1Fragment)
			___parent.appendChild(___parentFragment)
		`
		boilEqual(generateEntity(entity, true, '___parent'), expected)
	})
})

// describe('generateEntity', () => {
// 	it('', () => {
// 		//
// 	})
// })
