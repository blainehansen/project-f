// https://mattallan.me/posts/modern-javascript-without-a-bundler/
// file:///home/blaine/lab/project-f/lib/dom/main.html

import { NonLone } from '../utils'
import { replaceContent, replaceRange, Displayable, DisplayType, Range, ContentState } from './index'
import { Immutable, Mutable, effect, statefulEffect, data, value, channel, computed, thunk, sample } from '../reactivity'

// div
// 	input(type="text", placeholder="yo yo", :value=text)
// 	| {{ text() }}
function TextInput(parent: Node) {
	const component = document.createElement('div')
	parent.appendChild(component)

	const text = value('')
	const input = document.createElement('input')
	input.type = 'text'
	input.placeholder = 'yo yo'
	input.oninput = $event => {
		text(($event.target as typeof input).value)
	}
	// in order to
	effect(() => {
		input.value = text()
	})
	component.appendChild(input)

	const display = document.createTextNode('')
	effect(() => {
		display.data = text()
	})
	component.appendChild(display)

	return component
}


// div
// 	input(type="checkbox", :value=checked)
// 	div
// 		@if (checked()) hello checked world
// 		@else: b oh no!
function CheckboxIfElseBlock(parent: Node) {
	const component = document.createElement('div')
	parent.appendChild(component)

	const checked = value(true)
	const input = document.createElement('input')
	input.type = 'checkbox'
	effect(() => {
		input.checked = checked()
	})
	input.onchange = $event => {
		checked(input.checked)
	}
	component.appendChild(input)

	const contentDiv = document.createElement('div')
	const elseDiv = document.createElement('b')
	elseDiv.textContent = 'oh no!'
	statefulEffect(current => {
		return replaceContent(
			contentDiv, current,
			checked()
				? 'hello checked world'
				: elseDiv
				// : null
				// undefined for a branch with no else
				// and chain these ternaries for an else-if chain
		)
	}, { type: DisplayType.empty, content: undefined } as ContentState)
	component.appendChild(contentDiv)
	// effect(() => {
	// 	contentDiv.textContent = checked() ? 'on' : 'off'
	// })

	return component
}

// div
// 	h1 Here are some letters:
// 	@map (letter in list()): div
// 	@map ((letter: string) in list()): div
// 	@map ((letter, index) in list()): div
// 		i the letter: {{ letter() }}
// 		button(@click={ deleteItem(index) }) delete this letter
// 	input(type="text", placeholder="add a new letter", @keyup.enter=pushNewLetter)
function ForLoop(parent: Node) {
	const component = document.createElement('div')
	parent.appendChild(component)

	const header = document.createElement('h1')
	header.textContent = 'Here are some letters:'
	component.appendChild(header)

	const list = channel(['a', 'b', 'c'])
	const placeholder = new Comment()
	component.appendChild(placeholder)
	statefulEffect(current => {
		return replaceRange(
			current,
			list().map((letter, index) => {
				const d = document.createElement('div')

				const item = document.createElement('i')
				item.textContent = `the letter: "${letter}"`
				d.appendChild(item)

				const deleteButton = document.createElement('button')
				deleteButton.textContent = "delete this letter"
				// function deleteItem(index) {
				// 	list.splice(index, 1)
				// }
				deleteButton.onclick = $event => {
					const currentList = list()
					currentList.splice(index, 1)
					list(currentList)
				}
				d.appendChild(deleteButton)

				return d
			}),
		)
	}, { parent: component, type: DisplayType.empty, item: placeholder } as Range)

	const input = document.createElement('input')
	input.type = 'text'
	input.placeholder = 'add a new letter'
	input.onkeyup = $event => {
		if ($event.key !== 'Enter') return

		const newLetter = ($event.target as typeof input).value
		;($event.target as typeof input).value = ''

		const currentList = list()
		currentList.push(newLetter)
		list(currentList)
	}
	component.appendChild(input)

	return component
}


// @if (condition())
//   @each (item of items()) {{ item }}
function IfThenEach(parent: Node) {
	const component = document.createElement('div')

	const condition = value(true)
	const items = channel(['a', 'b', 'c'])
	statefulEffect(current => {
		return replaceContent(
			component, current,
			condition()
				? items().map(item => document.createTextNode(item))
				: undefined
		)
	}, { type: DisplayType.empty, content: undefined } as ContentState)

	parent.appendChild(component)
	return component
}


// @each (item of items())
//   @if (item.condition()) {{ item.name }}
function EachThenIf(parent: Node) {
	const component = document.createElement('div')

	const items = channel([
		{ name: 'a', condition: value(true) },
		{ name: 'b', condition: value(false) },
		{ name: 'c', condition: value(false) },
		{ name: 'd', condition: value(true) },
	])
	statefulEffect(current => {
		return replaceContent(
			component, current,
			items().map(item => {
				const placeholder = new Comment()
				component.appendChild(placeholder)

				statefulEffect(current => {
					return replaceRange(
						current,
						item.condition()
							? document.createTextNode(item.name)
							: new Comment()
					)
				}, { parent: component, type: DisplayType.empty, item: placeholder } as Range)

				return placeholder
			})
		)
	}, { type: DisplayType.empty, content: undefined } as ContentState)

	parent.appendChild(component)
	return component
}


// TextInput(document.body)
// CheckboxIfElseBlock(document.body)
// ForLoop(document.body)
// IfThenEach(document.body)
EachThenIf(document.body)
