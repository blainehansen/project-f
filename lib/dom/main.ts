// https://mattallan.me/posts/modern-javascript-without-a-bundler/
// file:///home/blaine/lab/project-f/lib/dom/main.html

import { NonLone } from '../utils'
import { ContentState, Displayable, replaceContent, Range, RangeType, replaceRange } from './index'
import { Immutable, Mutable, effect, statefulEffect, data, value, channel, computed, thunk, sample } from '../reactivity'

// function Component() {
// 	const component = document.createElement('div')

// 	const text = value('')
// 	const input = document.createElement('input')
// 	input.type = 'text'
// 	input.placeholder = 'yo yo'
// 	input.oninput = e => {
// 		text((e.target as typeof input).value)
// 	}
// 	effect(() => {
// 		input.value = text()
// 	})

// 	const display = document.createTextNode('')
// 	effect(() => {
// 		display.data = text()
// 	})


// 	component.appendChild(input)
// 	component.appendChild(display)

// 	return component
// }


// function Component() {
// 	const component = document.createElement('div')

// 	const checked = value(true)
// 	const input = document.createElement('input')
// 	input.type = 'checkbox'

// 	effect(() => {
// 		input.checked = checked()
// 	})
// 	input.onchange = () => {
// 		checked(input.checked)
// 	}

// 	const contentDiv = document.createElement('div')
// 	const elseDiv = document.createElement('b')
// 	elseDiv.textContent = 'oh no!'
// 	statefulEffect(current => {
// 		return replaceContent(
// 			contentDiv, current,
// 			checked()
// 				? 'hello checked world'
// 				: elseDiv
// 				// undefined for a branch with no else
// 				// and chain these ternaries for an else-if chain
// 		)
// 	}, undefined as ContentState)
// 	// effect(() => {
// 	// 	contentDiv.textContent = checked() ? 'on' : 'off'
// 	// })

// 	component.appendChild(input)
// 	component.appendChild(contentDiv)
// 	return component
// }

function Component() {
	const component = document.createElement('div')

	const header = document.createElement('h1')
	header.textContent = 'Here are some letters:'
	component.appendChild(header)

	const list = channel(['a', 'b', 'c'])
	const placeholder = new Comment()
	component.appendChild(placeholder)
	statefulEffect(current => {
		return replaceRange(
			current,
			list().map(letter => {
				const d = document.createElement('div')
				const item = document.createElement('i')
				item.textContent = `the letter: "${letter}"`
				d.appendChild(item)
				return d
			}) as unknown as NonLone<Node>,
		)
	}, { parent: component, type: RangeType.empty, placeholder } as Range)

	const input = document.createElement('input')
	input.type = 'text'
	input.placeholder = 'add a new letter'
	input.onkeyup = e => {
		if (e.key !== 'Enter') return

		const newLetter = (e.target as typeof input).value
		;(e.target as typeof input).value = ''

		const currentList = list()
		currentList.push(newLetter)
		list(currentList)
	}
	component.appendChild(input)

	return component
}

const el = Component()
document.body.appendChild(el)
