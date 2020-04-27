// https://mattallan.me/posts/modern-javascript-without-a-bundler/
// file:///home/blaine/lab/project-f/lib/dom/main.html



const parent = document.body
const container = document.createDocumentFragment()
// BasicEach(parent, container)
// IfThenEach(parent, container)
EachThenIf(parent, container)
parent.appendChild(container)





// @each (item of items())
// 	@if (item.condition()): div
// 		| {{ item.name }}
// 		button(@click=delete)
// @each (item of items())
// 	input(type="checkbox", !sync={ item.condition })
// appender
function EachThenIf(realParent: Node, parent: DocumentFragment) {
	const items = channel([
		{ name: 'a', condition: value(true) },
		{ name: 'b', condition: value(false) },
		{ name: 'c', condition: value(false) },
		{ name: 'd', condition: value(true) },
	])

	appender(parent, items, name => ({ name, condition: value(Math.random() > 0.5) }))
	rangeEffect((realParent, parent) => {
		for (const item of items()) {
			switcher(parent, item.condition)
		}
	}, realParent, parent)

	rangeEffect((realParent, parent) => {
		for (const [index, item] of items().entries()) {
			rangeEffect((realParent, parent) => {
				if (item.condition()) {
					const div = document.createElement('div')
					parent.appendChild(div)
					const text = document.createTextNode(item.name)
					div.appendChild(text)
					deleter(div, items, index)
				}
			}, realParent, parent)
		}
	}, realParent, parent)


}








// h1 Here are some letters:
// @each ((letter, index) of list()): div
// 	i the letter: {{ letter() }}
// 	button(@click={ deleteItem(index) }) delete this letter
// input(type="text", placeholder="add a new letter", @keyup.enter=pushNewLetter)
function BasicEach(realParent: Node, parent: DocumentFragment) {
	const header = document.createElement('h1')
	header.textContent = "Here are some letters:"
	parent.appendChild(header)

	const list = channel(['a', 'b', 'c'])
	rangeEffect((realParent, parent) => {
		for (const [index, letter] of list().entries()) {
			const div = document.createElement('div')
			parent.appendChild(div)
			const item = document.createElement('i')
			item.textContent = `the letter: "${letter}"`
			div.appendChild(item)
			deleter(div, list, index)
		}
	}, realParent, parent)

	appender(parent, list, s => s)
}

// input(type="checkbox", !sync=condition)
// @if (condition())
//   @each ((item, index) of items()): div
// 		| {{ item }}
// 		button(@click={ delete(index) }) delete
// input(type="text", @click.enter=append)
function IfThenEach(realParent: Node, parent: DocumentFragment) {
	const condition = value(true)
	switcher(parent, condition)

	const items = channel(['a', 'b', 'c'])
	rangeEffect((realParent, parent) => {
		if (condition()) {
			for (const [index, item] of items().entries()) {
				const div = document.createElement('div')
				parent.appendChild(div)
				const text = document.createTextNode(item)
				div.appendChild(text)
				deleter(div, items, index)
			}
		}
	}, realParent, parent)

	appender(parent, items, s => s)
}































































// // div
// // 	input(type="text", placeholder="yo yo", :value=text)
// // 	| {{ text() }}
// function TextInput(parent: Node) {
// 	const component = document.createElement('div')
// 	parent.appendChild(component)

// 	const text = value('')
// 	const input = document.createElement('input')
// 	input.type = 'text'
// 	input.placeholder = 'yo yo'
// 	input.oninput = $event => {
// 		text(($event.target as typeof input).value)
// 	}
// 	// in order to
// 	effect(() => {
// 		input.value = text()
// 	})
// 	component.appendChild(input)

// 	const display = document.createTextNode('')
// 	effect(() => {
// 		display.data = text()
// 	})
// 	component.appendChild(display)

// 	return component
// }
