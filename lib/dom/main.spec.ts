import 'mocha'
import { expect } from 'chai'
import { boilString } from '../utils.spec'
import { divText, tagText } from './index.spec'

import { NonLone, exec } from '../utils'
import { contentEffect, rangeEffect, Displayable, DisplayType, Range, ContentState } from './index'
import { Immutable, Mutable, effect, statefulEffect, data, value, channel, computed, thunk, sample } from '../reactivity'

const body = document.body
beforeEach(() => {
	body.textContent = ''
})

const inputCheck = `<input type="checkbox">`

// div
// 	input(type="checkbox", :value=checked)
// 	div
// 		@if (checked()) hello checked world
// 		@else: b oh no!
export function CheckboxIfElseBlock(realParent: Node, parent: DocumentFragment) {
	const component = document.createElement('div')
	parent.appendChild(component)

	const checked = value(true)
	switcher(component, checked)

	const div = document.createElement('div')
	const b = document.createElement('b')
	b.textContent = 'oh no!'
	component.appendChild(div)
	contentEffect(() => {
		return checked()
			? 'hello checked world'
			: b
			// undefined for a branch with no else
			// and chain these ternaries for an else-if chain
	}, div)
	// effect(() => {
	// 	div.textContent = checked() ? 'on' : 'off'
	// })

	return { checked }
}
describe('CheckboxIfElseBlock', () => it('works', () => {
	const { checked } = CheckboxIfElseBlock(body, body as unknown as DocumentFragment)

	expect(body.innerHTML).equal(divText(`${inputCheck}${divText('hello checked world')}`))

	checked(false)
	expect(body.innerHTML).equal(divText(`${inputCheck}${divText(tagText('b', 'oh no!'))}`))
}))







export function switcher(parent: Node, checked: Mutable<boolean>) {
	const input = document.createElement('input')
	input.type = 'checkbox'
	effect(() => {
		input.checked = checked()
	})
	input.onchange = $event => {
		checked(input.checked)
	}
	parent.appendChild(input)
	return input
}
describe('switcher', () => it('works', () => {
	const checked = value(false)
	const checkbox = switcher(body, checked)

	expect(checkbox.checked).false
	expect(checked()).false

	checkbox.click()
	expect(checkbox.checked).true
	expect(checked()).true

	checked(false)
	expect(checked()).false
	expect(checkbox.checked).false
}))

export function appender<T>(parent: Node, list: Mutable<T[]>, fn: (s: string) => T) {
	const input = document.createElement('input')
	input.type = 'text'
	input.placeholder = 'append'
	input.onkeyup = $event => {
		if ($event.key !== 'Enter') return

		const newLetter = ($event.target as typeof input).value
		;($event.target as typeof input).value = ''

		const currentList = list()
		currentList.push(fn(newLetter))
		list(currentList)
	}

	parent.appendChild(input)
	return input
}
// describe('appender', () => it('works', () => {
// 	const list = channel([])
// 	const input = appender(body, list, s => s)

// 	expect(list()).eql([])
// }))

export function deleter(parent: Node, list: Mutable<unknown[]>, index: number) {
	const deleteButton = document.createElement('button')
	deleteButton.textContent = "delete"
	deleteButton.onclick = $event => {
		const currentList = list()
		currentList.splice(index, 1)
		list(currentList)
	}
	parent.appendChild(deleteButton)
	return deleteButton
}
