// file:///home/blaine/lab/project-f/lib/dom/main.html

// import { ContentState, Displayable, replaceContent, Range, RangeType, replaceRange } from './index'
import { Immutable, Mutable, effect, statefulEffect, data, value, channel, computed, thunk, sample } from '../reactivity'

function reactiveText() {
	const div = document.createElement('div')

	const text = value('')
	const input = document.createElement('input')
	input.type = 'text'
	input.placeholder = 'yo yo'
	input.oninput = e => {
		text((e.target as typeof input).value)
	}
	effect(() => {
		input.value = text()
	})

	const display = document.createTextNode('')
	effect(() => {
		display.data = text()
	})


	div.appendChild(input)
	div.appendChild(display)

	return div
}

const el = reactiveText()
document.body.appendChild(el)
