// https://mattallan.me/posts/modern-javascript-without-a-bundler/
// file:///home/blaine/lab/project-f/lib/dom/main.html

// import { ContentState, Displayable, replaceContent, Range, RangeType, replaceRange } from './index'
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


// input(type="checkbox", :value=checked)
function Component() {
	const component = document.createElement('div')

	const checked = value(true)
	const input = document.createElement('input')
	input.type = 'checkbox'

	effect(() => {
		input.checked = checked()
	})
	input.onchange = () => {
		checked(input.checked)
	}

	const checkedDiv = document.createElement('div')
	effect(() => {
		checkedDiv.textContent = checked() ? 'on' : 'off'
	})

	component.appendChild(input)
	component.appendChild(checkedDiv)
	return component
}

const el = Component()
document.body.appendChild(el)
