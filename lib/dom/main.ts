// https://mattallan.me/posts/modern-javascript-without-a-bundler/
// file:///home/blaine/lab/project-f/lib/dom/main.html

import { NonLone, exec } from '../utils'
import { replaceContent, replaceRange, Displayable, DisplayType, Range, ContentState } from './index'
import { Immutable, Mutable, effect, statefulEffect, data, value, channel, computed, thunk, sample } from '../reactivity'

function switcher(parent: Node, checked: Mutable<boolean>) {
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

function appender<T>(parent: Node, list: Mutable<T[]>, fn: (s: string) => T) {
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

function deleter(parent: Node, list: Mutable<unknown[]>, index: number) {
	const deleteButton = document.createElement('button')
	deleteButton.textContent = "delete"
	deleteButton.onclick = $event => {
		const currentList = list()
		currentList.splice(index, 1)
		list(currentList)
	}
	parent.appendChild(deleteButton)
}


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
	switcher(component, checked)

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
// 	@each (letter of list()): div
// 	@each ((letter: string) of list()): div
// 	@each ((letter, index) of list()): div
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
				deleter(d, list, index)
				return d
			}),
		)
	}, { parent: component, type: DisplayType.empty, item: placeholder } as Range)

	appender(component, list, s => s)

	return component
}

// input(type="checkbox", !sync=condition)
// @if (condition())
//   @each ((item, index) of items()): div
// 		| {{ item }}
// 		button(@click={ delete(index) }) delete
// input(type="text", @click.enter=append)
function IfThenEach(parent: Node) {
	const component = document.createElement('div')

	const condition = value(true)
	switcher(component, condition)

	const items = channel(['a', 'b', 'c'])
	const placeholder = new Comment()
	component.appendChild(placeholder)
	statefulEffect(current => {
		return replaceRange(
			current,
			condition()
				? items().map((item, index) => {
					const div = document.createElement('div')
					const text = document.createTextNode(item)
					div.appendChild(text)
					deleter(div, items, index)
					return div
				})
				: undefined,
		)
	}, { parent: component, type: DisplayType.empty, item: placeholder } as Range)

	appender(component, items, s => s)

	parent.appendChild(component)
	return component
}



// @each (item of items())
// 	@if (item.condition()): div
// 		| {{ item.name }}
// 		button(@click=delete)
// @each (item of items())
// 	input(type="checkbox", !sync={ item.condition })
// appender
function EachThenIf(parent: Node) {
	const component = document.createElement('div')

	const items = channel([
		{ name: 'a', condition: value(true) },
		{ name: 'b', condition: value(false) },
		{ name: 'c', condition: value(false) },
		{ name: 'd', condition: value(true) },
	])
	const placeholder = new Comment()
	component.appendChild(placeholder)
	statefulEffect(current => {
		return replaceRange(
			current,
			items().map((item, index) => {
				const itemPlaceholder = new Comment()
				fragment.appendChild(itemPlaceholder)

				statefulEffect(current => {
					return replaceRange(
						current,
						item.condition()
							? exec(() => {
								const div = document.createElement('div')
								const text = document.createTextNode(item.name)
								div.appendChild(text)
								deleter(div, items, index)
								return div
							})
							: undefined
					)
				}, { parent: fragment, type: DisplayType.empty, item: itemPlaceholder } as Range)

				return itemPlaceholder
			})
		)
	}, { parent: component, type: DisplayType.empty, item: placeholder } as Range)

	appender(component, items, name => ({ name, condition: value(Math.random() > 0.5) }))

	const conditionsPlaceholder = new Comment()
	component.appendChild(conditionsPlaceholder)
	statefulEffect(current => {
		const fragment = document.createDocumentFragment()
		return replaceRange(
			current,
			items().map(item => {
				return switcher(fragment, item.condition)
			})
		)
	}, { parent: component, type: DisplayType.empty, item: conditionsPlaceholder } as Range)

	parent.appendChild(component)
	return component
}


// TextInput(document.body)
// CheckboxIfElseBlock(document.body)
// ForLoop(document.body)
// IfThenEach(document.body)
EachThenIf(document.body)
