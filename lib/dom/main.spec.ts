import 'mocha'
import { expect } from 'chai'
import { boilString } from '../utils.spec'
import { divText, tagText, inputText } from './index.spec'

import { NonLone, exec } from '../utils'
import {
	Displayable, DisplayType, Range, ContentState,
	nodeReceiver, createElement, createTextNode, contentEffect, rangeEffect,
	syncTextElement, syncCheckboxElement, syncElementAttribute,
	syncRadioElement, syncRadioElementReactive, syncSelectElement, syncSelectMultipleElement
 } from './index'
import { Immutable, Mutable, effect, statefulEffect, data, value, channel, computed, thunk, sample } from '../reactivity'

const body = document.body
beforeEach(() => {
	body.textContent = ''
})


const inputCheck = `<input type="checkbox">`
const comment = '<!---->'
const begin = '<!--begin-->'
const end = '<!--end-->'
const someInput = (placeholder: string) => `<input type="text" placeholder="${placeholder}">`
function eachText<T>(collection: T[], fn: (t: T) => string) {
	return collection.length === 0 ? comment
		: collection.length === 1 ? fn(collection[0])
		: begin + collection.map(fn).join('') + end
}


export function switcher(parent: Node, checked: Mutable<boolean>) {
	const input = createElement(parent, 'input')
	input.type = 'checkbox'
	syncElementAttribute(input, 'onchange', 'checked', checked)
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
	const input = createElement(parent, 'input')
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

	return input
}
// describe('appender', () => it('works', () => {
// 	const list = channel([])
// 	const input = appender(body, list, s => s)

// 	expect(list()).eql([])
// }))

export function deleter(parent: Node, list: Mutable<unknown[]>, index: number) {
	const button = createElement(parent, 'button')
	button.textContent = "delete"
	button.onclick = $event => {
		const currentList = list()
		currentList.splice(index, 1)
		list(currentList)
	}
	return button
}
// describe('deleter', () => it('works', () => {
// 	const list = channel(['a', 'b', 'c'])
// 	const button = deleter(body, list, 1)

// 	expect(body.innerHTML).equal()
// }))




// div
// 	input(type="checkbox", !sync=checked)
// 	div
// 		@if (checked()) hello checked world
// 		@else: b oh no!
export function CheckboxIfElseBlock(realParent: Node, parent: DocumentFragment) {
	const component = createElement(parent, 'div')

	const checked = value(true)
	switcher(component, checked)

	const div = createElement(component, 'div')
	const b = document.createElement('b')
	b.textContent = 'oh no!'
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


// @if (letter() === 'a') raw text
// @else-if (letter() === 'b')
// 	span multiple
// 	div things
// @else-if (letter() === 'c'): div the letter: {{ letter() }}
export function ChainedIfElse(realParent: Node, parent: DocumentFragment) {
	const letter = value('')

	rangeEffect((realParent, parent) => {
		if ((letter() === 'a')) {
			createTextNode(parent, 'raw text')
		}
		else if (letter() === 'b') {
			const span = createElement(parent, 'span')
			span.textContent = 'multiple'
			const div = createElement(parent, 'div')
			div.textContent = 'things'
		}
		else if (letter() === 'c') {
			const div = createElement(parent, 'div')
			effect(() => {
				div.textContent = `the letter: ${ letter() }`
			})
		}
	}, realParent, parent)

	return letter
}
describe('ChainedIfElse', () => it('works', () => {
	const letter = ChainedIfElse(body, body as unknown as DocumentFragment)

	expect(body.innerHTML).equal(comment)

	letter('a')
	expect(body.innerHTML).equal('raw text')

	letter('c')
	expect(body.innerHTML).equal(divText('the letter: c'))

	letter('b')
	expect(body.innerHTML).equal(begin + tagText('span', 'multiple') + divText('things') + end)

	letter('c')
	expect(body.innerHTML).equal(divText('the letter: c'))

	letter('d')
	expect(body.innerHTML).equal(comment)
}))


// div
// 	input(type="text", placeholder="yo yo", !sync=text)
// 	| {{ text() }}
export function TextInput(realParent: Node, parent: DocumentFragment) {
	const component = createElement(parent, 'div')

	const text = value('')
	const input = createElement(component, 'input')
	input.type = 'text'
	input.placeholder = 'yo yo'
	syncTextElement(input, text)

	const display = createTextNode(component, '')
	effect(() => {
		display.data = text()
	})

	return { text, input }
}
describe('TextInput', () => it('works', () => {
	const { text, input } = TextInput(body, body as unknown as DocumentFragment)

	const inputText = `<input type="text" placeholder="yo yo">`
	expect(body.innerHTML).equal(divText(inputText))
	expect(input.value).equal('')

	text('stuff')
	expect(body.innerHTML).equal(divText(`${inputText}stuff`))
	expect(input.value).equal('stuff')
}))


// textarea(placeholder="yo yo", !sync=text)
// | {{ text() }}
export function TextareaInput(realParent: Node, parent: DocumentFragment) {
	const text = value('')

	const textarea = createElement(parent, 'textarea')
	textarea.placeholder = 'yo yo'
	syncTextElement(textarea, text)

	const display = createTextNode(parent, '')
	effect(() => {
		display.data = text()
	})

	return { text, textarea }
}
describe('TextareaInput', () => it('works', () => {
	const { text, textarea } = TextareaInput(body, body as unknown as DocumentFragment)

	const textareaText = `<textarea placeholder="yo yo"></textarea>`
	expect(body.innerHTML).equal(textareaText)

	text('stuff')
	expect(body.innerHTML).equal(textareaText + 'stuff')
}))


// // input(type="checkbox", !sync=thing, value="some string")
// // input(type="checkbox", !sync=thing, value={ [1, 2, 3] })
// // input(type="checkbox", !sync=thing, :value=stringValue)
// // | {{ '' + thing() }}
// export function CheckboxGroupInput(realParent: Node, parent: DocumentFragment) {
// 	const things = channel([] as (string | number[])[])
// 	const stringValue = value("changes")

// 	const one = createElement(parent, 'input')
// 	one.type = 'checkbox'
// 	syncGroupCheckboxElement(one, things, () => "some string")
// 	const two = createElement(parent, 'input')
// 	two.type = 'checkbox'
// 	const arr = [1, 2, 3]
// 	syncGroupCheckboxElement(two, things, () => arr)
// 	const three = createElement(parent, 'input')
// 	three.type = 'checkbox'
// 	syncGroupCheckboxElement(three, things, stringValue)

// 	const display = createTextNode(parent, '')
// 	effect(() => {
// 		display.data = '' + things()
// 	})

// 	return { things, arr, stringValue, one, two, three }
// }
// describe('CheckboxGroupInput', () => it('works', () => {
// 	const { things, arr, stringValue, one, two, three } = CheckboxGroupInput(body, body as unknown as DocumentFragment)
// 	const checkboxText = inputText('checkbox')
// 	const checkboxInputText = (v: string) => checkboxText + checkboxText + checkboxText + v

// 	expect([one.checked, two.checked, three.checked]).eql([false, false, false])
// 	expect(body.innerHTML).equal(checkboxInputText(''))

// 	let t = things()
// 	t.push("some string")
// 	things(t)
// 	expect([one.checked, two.checked, three.checked]).eql([true, false, false])
// 	expect(body.innerHTML).equal(checkboxInputText("some string"))

// 	t.push(arr)
// 	things(t)
// 	expect([one.checked, two.checked, three.checked]).eql([true, true, false])
// 	expect(body.innerHTML).equal(checkboxInputText("some string,1,2,3"))

// 	t.push("changes")
// 	things(t)
// 	expect([one.checked, two.checked, three.checked]).eql([true, true, true])
// 	expect(body.innerHTML).equal(checkboxInputText("some string,1,2,3,changes"))

// 	stringValue("not changes")
// 	things(t)
// 	expect([one.checked, two.checked, three.checked]).eql([true, true, false])
// 	expect(body.innerHTML).equal(checkboxInputText("some string,1,2,3,changes"))

// 	t = []
// 	things(t)
// 	expect([one.checked, two.checked, three.checked]).eql([false, false, false])
// 	expect(body.innerHTML).equal(checkboxInputText(''))
// }))


// input(type="radio", !sync=thing, value="")
// input(type="radio", !sync=thing, value="some string")
// input(type="radio", !sync=thing, :value=stringValue)
// | {{ '' + thing() }}
export function RadioInput(realParent: Node, parent: DocumentFragment) {
	const thing = channel("blargh")
	const stringValue = value("changes")

	const one = createElement(parent, 'input')
	one.type = 'radio'
	syncRadioElement(one, thing, '')
	const two = createElement(parent, 'input')
	two.type = 'radio'
	syncRadioElement(two, thing, "some string")
	const three = createElement(parent, 'input')
	three.type = 'radio'
	syncRadioElementReactive(three, thing, stringValue)

	const display = createTextNode(parent, '')
	effect(() => {
		display.data = '' + thing()
	})

	return { thing, stringValue, one, two, three }
}
describe('RadioInput', () => it('works', () => {
	const { thing, stringValue, one, two, three } = RadioInput(body, body as unknown as DocumentFragment)
	const radioInputText = (v: string) => one.outerHTML + two.outerHTML + three.outerHTML + v

	expect([one.checked, two.checked, three.checked]).eql([false, false, false])
	expect(body.innerHTML).equal(radioInputText('blargh'))

	thing("")
	expect([one.checked, two.checked, three.checked]).eql([true, false, false])
	expect(body.innerHTML).equal(radioInputText(""))

	thing("some string")
	expect([one.checked, two.checked, three.checked]).eql([false, true, false])
	expect(body.innerHTML).equal(radioInputText("some string"))

	thing("changes")
	expect([one.checked, two.checked, three.checked]).eql([false, false, true])
	expect(body.innerHTML).equal(radioInputText("changes"))

	stringValue("not changes")
	// AGH
	expect([one.checked, two.checked, three.checked]).eql([false, false, false])
	expect(body.innerHTML).equal(radioInputText('changes'))

	thing("not changes")
	expect([one.checked, two.checked, three.checked]).eql([false, false, true])
	expect(body.innerHTML).equal(radioInputText('not changes'))
}))


// select(!sync=selected)
//   option(disabled, value="") Please select one
//   option A
//   option(value="Basic") B
//   option(:value=changingC) C
// {{ '' + selected }}
export function SelectInput(realParent: Node, parent: DocumentFragment) {
	const selected = value("")
	const changingC = value("C")

	const select = createElement(parent, 'select')

	const def = createElement(select, 'option')
	def.textContent = "Please select one"
	def.disabled = true
	def.value = ""
	const A = createElement(select, 'option')
	A.textContent = 'A'
	const B = createElement(select, 'option')
	B.textContent = 'B'
	B.value = 'Basic'
	const C = createElement(select, 'option')
	C.textContent = 'C'
	effect(() => {
		C.value = changingC()
	})
	syncSelectElement(select, selected)

	const display = createTextNode(parent, '')
	effect(() => {
		display.data = '' + selected()
	})

	return { selected, select, changingC, def, A, B, C }
}
describe('SelectInput', () => it('works', () => {
	const { selected, select, changingC, def, A, B, C } = SelectInput(body, body as unknown as DocumentFragment)
	const selectText = (v: string) => select.outerHTML + v

	expect([def.selected, A.selected, B.selected, C.selected]).eql([true, false, false, false])
	expect(body.innerHTML).equal(selectText(''))

	selected("some string")
	expect([def.selected, A.selected, B.selected, C.selected]).eql([false, false, false, false])
	expect(body.innerHTML).equal(selectText("some string"))

	selected("A")
	expect([def.selected, A.selected, B.selected, C.selected]).eql([false, true, false, false])
	expect(body.innerHTML).equal(selectText("A"))

	selected("Basic")
	expect([def.selected, A.selected, B.selected, C.selected]).eql([false, false, true, false])
	expect(body.innerHTML).equal(selectText("Basic"))

	selected("C")
	expect([def.selected, A.selected, B.selected, C.selected]).eql([false, false, false, true])
	expect(body.innerHTML).equal(selectText("C"))

	changingC("Casic")
	// AGH
	expect([def.selected, A.selected, B.selected, C.selected]).eql([false, false, false, true])
	expect(body.innerHTML).equal(selectText("C"))

	selected("Casic")
	expect([def.selected, A.selected, B.selected, C.selected]).eql([false, false, false, true])
	expect(body.innerHTML).equal(selectText("Casic"))

	selected("")
	expect([def.selected, A.selected, B.selected, C.selected]).eql([true, false, false, false])
	expect(body.innerHTML).equal(selectText(''))
}))


// select(!sync=selected, multiple)
//   option A
//   option(value="Basic") B
//   option(:value=changingC) C
// {{ '' + selected }}
export function SelectInputMultiple(realParent: Node, parent: DocumentFragment) {
	const selected = channel([] as string [])
	const changingC = value("C")

	const select = createElement(parent, 'select')
	select.multiple = true

	const A = createElement(select, 'option')
	A.textContent = 'A'
	const B = createElement(select, 'option')
	B.textContent = 'B'
	B.value = 'Basic'
	const C = createElement(select, 'option')
	C.textContent = 'C'
	effect(() => {
		C.value = changingC()
	})
	syncSelectMultipleElement(select, selected)

	const display = createTextNode(parent, '')
	effect(() => {
		display.data = '' + selected()
	})

	return { selected, select, changingC, A, B, C }
}
describe('SelectInputMultiple', () => it('works', () => {
	const { selected, select, changingC, A, B, C } = SelectInputMultiple(body, body as unknown as DocumentFragment)
	const selectText = (v: string) => select.outerHTML + v

	expect([A.selected, B.selected, C.selected]).eql([false, false, false])
	expect(body.innerHTML).equal(selectText(''))

	selected(["some string"])
	expect([A.selected, B.selected, C.selected]).eql([false, false, false])
	expect(body.innerHTML).equal(selectText("some string"))

	selected(["A", "Basic"])
	expect([A.selected, B.selected, C.selected]).eql([true, true, false])
	expect(body.innerHTML).equal(selectText("A,Basic"))

	selected(["C"])
	expect([A.selected, B.selected, C.selected]).eql([false, false, true])
	expect(body.innerHTML).equal(selectText("C"))

	changingC("Casic")
	// AGH
	expect([A.selected, B.selected, C.selected]).eql([false, false, true])
	expect(body.innerHTML).equal(selectText("C"))

	selected(["Casic"])
	expect([A.selected, B.selected, C.selected]).eql([false, false, true])
	expect(body.innerHTML).equal(selectText("Casic"))

	selected([])
	expect([A.selected, B.selected, C.selected]).eql([false, false, false])
	expect(body.innerHTML).equal(selectText(''))
}))


// h1 Letters:
// @each ((letter, index) of list()): div
// 	i letter: {{ letter }}
// 	button(@click={ deleteItem(index) }) delete this letter
// input(type="text", placeholder="add a new letter", @keyup.enter=pushNewLetter)
export function BasicEach(realParent: Node, parent: DocumentFragment) {
	const header = createElement(parent, 'h1')
	header.textContent = "Letters:"

	const list = channel(['a', 'b', 'c'])
	rangeEffect((realParent, parent) => {
		for (const [index, letter] of list().entries()) {
			const div = createElement(parent, 'div')
			const item = createElement(div, 'i')
			item.textContent = `letter: "${letter}"`
			deleter(div, list, index)
		}
	}, realParent, parent)

	appender(parent, list, s => s)
	return { list }
}
describe('BasicEach', () => it('works', () => {
	const { list } = BasicEach(body, body as unknown as DocumentFragment)
	const l = list()

	const loop = (...s: string[]) => {
		return tagText('h1', 'Letters:')
			+ begin
			+ s.map(s => divText(`${tagText('i', `letter: "${s}"`)}${tagText('button', 'delete')}`)).join('')
			+ end
			+ someInput('append')
	}
	expect(body.innerHTML).equal(loop('a', 'b', 'c'))

	l.splice(1, 1)
	list(l)
	expect(body.innerHTML).equal(loop('a', 'c'))

	l.push('d')
	list(l)
	expect(body.innerHTML).equal(loop('a', 'c', 'd'))
}))


// input(type="checkbox", !sync=condition)
// @if (condition())
//   @each ((item, index) of items()): div
// 		| {{ item }}
// 		button(@click={ delete(index) }) delete
// input(type="text", @click.enter=append)
export function IfThenEach(realParent: Node, parent: DocumentFragment) {
	const condition = value(true)
	switcher(parent, condition)

	const items = channel(['a', 'b', 'c'])
	rangeEffect((realParent, parent) => {
		if (condition()) {
			for (const [index, item] of items().entries()) {
				const div = createElement(parent, 'div')
				const text = createTextNode(div, item)
				deleter(div, items, index)
			}
		}
	}, realParent, parent)

	appender(parent, items, s => s)
	return { condition, items }
}
describe('IfThenEach', () => it('works', () => {
	const { condition, items } = IfThenEach(body, body as unknown as DocumentFragment)

	const i = items()
	const loop = (...s: string[]) => {
		return inputCheck
			+ begin
			+ s.map(s => divText(`${s}${tagText('button', 'delete')}`)).join('')
			+ end
			+ someInput('append')
	}
	expect(body.innerHTML).equal(loop('a', 'b', 'c'))

	condition(false)
	expect(body.innerHTML).equal(inputCheck + comment + someInput('append'))

	i.push('d')
	items(i)
	expect(body.innerHTML).equal(inputCheck + comment + someInput('append'))

	condition(true)
	expect(body.innerHTML).equal(loop('a', 'b', 'c', 'd'))
}))


// @each (item of items())
// 	@if (item.condition()): div
// 		| {{ item.name }}
// 		button(@click=delete)
// @each (item of items())
// 	input(type="checkbox", !sync={ item.condition })
// appender
export function EachThenIf(realParent: Node, parent: DocumentFragment) {
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
					const div = createElement(parent, 'div')
					const text = createTextNode(div, item.name)
					deleter(div, items, index)
				}
			}, realParent, parent)
		}
	}, realParent, parent)

	return { items }
}
describe('EachThenIf', () => it('works', () => {
	const { items } = EachThenIf(body, body as unknown as DocumentFragment)

	const i = items()
	const loop = (...s: { name: string, condition: boolean }[]) => {
		return someInput('append')
			+ begin
			+ s.map(() => inputCheck).join('')
			+ end
			+ begin
			+ s.map(item => item.condition ? divText(`${item.name}${tagText('button', 'delete')}`) : comment).join('')
			+ end
	}
	expect(body.innerHTML).equal(loop(
		{ name: 'a', condition: true },
		{ name: 'b', condition: false },
		{ name: 'c', condition: false },
		{ name: 'd', condition: true },
	))

	const item = { name: 'e', condition: value(true) }
	i.push(item)
	items(i)
	expect(body.innerHTML).equal(loop(
		{ name: 'a', condition: true },
		{ name: 'b', condition: false },
		{ name: 'c', condition: false },
		{ name: 'd', condition: true },
		{ name: 'e', condition: true },
	))

	item.condition(false)
	expect(body.innerHTML).equal(loop(
		{ name: 'a', condition: true },
		{ name: 'b', condition: false },
		{ name: 'c', condition: false },
		{ name: 'd', condition: true },
		{ name: 'e', condition: false },
	))

	i.pop()
	items(i)
	expect(body.innerHTML).equal(loop(
		{ name: 'a', condition: true },
		{ name: 'b', condition: false },
		{ name: 'c', condition: false },
		{ name: 'd', condition: true },
	))

	i.splice(2, 1)
	items(i)
	expect(body.innerHTML).equal(loop(
		{ name: 'a', condition: true },
		{ name: 'b', condition: false },
		{ name: 'd', condition: true },
	))
}))





// @each (post of posts())
// 	@if (post.important): h1 {{ post.title }}
// 	@else
// 		p not important: {{ post.title }}
// 	small {{ post.subscript }}
// 	@each (tag of post.tags()): .tag
// 		@if (tag.project()): .project-star
// 		| {{ tag.name }}
// 		@each (n of [1, 2, 3, 4, 5])
// 			.star: @if (tag.stars() >= n) filled
export function ComplexIfEachNesting(realParent: Node, parent: DocumentFragment) {
	const posts = channel([
		{ important: false, title: 'A', subscript: 'a', tags: channel([
			{ project: value(true), name: 't1', stars: value(3) },
		]) },
		{ important: true, title: 'B', subscript: 'b', tags: channel([
			{ project: value(false), name: 't2', stars: value(5) },
			{ project: value(true), name: 't3', stars: value(0) },
		]) },
		{ important: false, title: 'C', subscript: 'c', tags: channel([]) },
	])

	rangeEffect((realParent, parent) => {
		for (const post of posts()) {
			// first if/else
			rangeEffect((realParent, parent) => {
				if (post.important) {
					const h1 = createElement(parent, 'h1')
					effect(() => {
						h1.textContent = post.title
					})
				}
				else {
					const p = createElement(parent, 'p')
					effect(() => {
						p.textContent = `not important: ${ post.title }`
					})
				}
			}, realParent, parent)

			// small
			const small = createElement(parent, 'small')
			effect(() => {
				small.textContent = post.subscript
			})

			// nested each
			rangeEffect((realParent, parent) => {
				for (const tag of post.tags()) {
					const tagDiv = createElement(parent, 'div')
					tagDiv.className = 'tag'
					const tagDivFragment = document.createDocumentFragment()

					// project-star if block
					rangeEffect((tagDiv, tagDivFragment) => {
						if (tag.project()) {
							const projectStarDiv = createElement(tagDivFragment, 'div')
							projectStarDiv.className = 'project-star'
						}
					}, tagDiv, tagDivFragment)

					const text = createTextNode(tagDivFragment, '')
					effect(() => {
						text.data = tag.name
					})

					// stars divs
					rangeEffect((tagDiv, tagDivFragment) => {
						for (const n of [1, 2, 3, 4, 5]) {
							const starDiv = createElement(tagDivFragment, 'div')
							starDiv.className = 'star'

							effect(() => {
								starDiv.textContent = tag.stars() >= n ? 'filled' : ''
							})
						}
					}, tagDiv, tagDivFragment)

					// append the fragment
					tagDiv.appendChild(tagDivFragment)
				}
			}, realParent, parent)
		}

	}, realParent, parent)

	return posts
}
describe('ComplexIfEachNesting', () => it('works', () => {
	const postsChannel = ComplexIfEachNesting(body, body as unknown as DocumentFragment)
	const posts = postsChannel()

	type Post = { important: boolean, title: string, subscript: string, tags: { project: boolean, name: string, stars: number }[] }
	const loop = (...posts: Post[]) => {
		return eachText(posts, post => {
			return (post.important ? tagText('h1', post.title) : tagText('p', `not important: ${post.title}`))
				+ tagText('small', post.subscript)
				+ eachText(post.tags, tag => {
					return divText(
						(tag.project ? divText('', 'project-star') : comment)
							+ tag.name
							+ eachText([1, 2, 3, 4, 5], n => {
								return divText(tag.stars >= n ? 'filled' : '', 'star')
							}),
						'tag',
					)
				})
		})
	}

	expect(body.innerHTML).equal(loop(
		{ important: false, title: 'A', subscript: 'a', tags: [
			{ project: true, name: 't1', stars: 3 },
		] },
		{ important: true, title: 'B', subscript: 'b', tags: [
			{ project: false, name: 't2', stars: 5 },
			{ project: true, name: 't3', stars: 0 },
		] },
		{ important: false, title: 'C', subscript: 'c', tags: [] },
	))

	let tags = posts[1]!.tags()
	tags.splice(1, 1)
	posts[1]!.tags(tags)
	expect(body.innerHTML).equal(loop(
		{ important: false, title: 'A', subscript: 'a', tags: [
			{ project: true, name: 't1', stars: 3 },
		] },
		{ important: true, title: 'B', subscript: 'b', tags: [
			{ project: false, name: 't2', stars: 5 },
		] },
		{ important: false, title: 'C', subscript: 'c', tags: [] },
	))

	tags[0]!.name = 'yoyo'
	posts[1]!.tags(tags)
	expect(body.innerHTML).equal(loop(
		{ important: false, title: 'A', subscript: 'a', tags: [
			{ project: true, name: 't1', stars: 3 },
		] },
		{ important: true, title: 'B', subscript: 'b', tags: [
			{ project: false, name: 'yoyo', stars: 5 },
		] },
		{ important: false, title: 'C', subscript: 'c', tags: [] },
	))

	tags[0]!.project(true)
	expect(body.innerHTML).equal(loop(
		{ important: false, title: 'A', subscript: 'a', tags: [
			{ project: true, name: 't1', stars: 3 },
		] },
		{ important: true, title: 'B', subscript: 'b', tags: [
			{ project: true, name: 'yoyo', stars: 5 },
		] },
		{ important: false, title: 'C', subscript: 'c', tags: [] },
	))

	tags[0]!.stars(0)
	expect(body.innerHTML).equal(loop(
		{ important: false, title: 'A', subscript: 'a', tags: [
			{ project: true, name: 't1', stars: 3 },
		] },
		{ important: true, title: 'B', subscript: 'b', tags: [
			{ project: true, name: 'yoyo', stars: 0 },
		] },
		{ important: false, title: 'C', subscript: 'c', tags: [] },
	))

	tags[0]!.stars(1)
	expect(body.innerHTML).equal(loop(
		{ important: false, title: 'A', subscript: 'a', tags: [
			{ project: true, name: 't1', stars: 3 },
		] },
		{ important: true, title: 'B', subscript: 'b', tags: [
			{ project: true, name: 'yoyo', stars: 1 },
		] },
		{ important: false, title: 'C', subscript: 'c', tags: [] },
	))

	tags.unshift({ project: value(false), name: 'yello', stars: value(-1) })
	posts[1]!.tags(tags)
	expect(body.innerHTML).equal(loop(
		{ important: false, title: 'A', subscript: 'a', tags: [
			{ project: true, name: 't1', stars: 3 },
		] },
		{ important: true, title: 'B', subscript: 'b', tags: [
			{ project: false, name: 'yello', stars: -1 },
			{ project: true, name: 'yoyo', stars: 1 },
		] },
		{ important: false, title: 'C', subscript: 'c', tags: [] },
	))

	posts.push({ important: false, title: 'C', subscript: 'c', tags: channel([
		{ project: value(true), name: 'blah blah', stars: value(9) },
		{ project: value(false), name: 'blah once', stars: value(0) },
	]) })
	postsChannel(posts)
	expect(body.innerHTML).equal(loop(
		{ important: false, title: 'A', subscript: 'a', tags: [
			{ project: true, name: 't1', stars: 3 },
		] },
		{ important: true, title: 'B', subscript: 'b', tags: [
			{ project: false, name: 'yello', stars: -1 },
			{ project: true, name: 'yoyo', stars: 1 },
		] },
		{ important: false, title: 'C', subscript: 'c', tags: [] },
		{ important: false, title: 'C', subscript: 'c', tags: [
			{ project: true, name: 'blah blah', stars: 9 },
			{ project: false, name: 'blah once', stars: 0 },
		] },
	))

	posts.splice(0, posts.length)
	postsChannel(posts)
	expect(body.innerHTML).equal(comment)
}))



// @template (excitedGreeting)
//   strong Wow how are you doing!!!!
// @template (hello, name: Immutable<string>)
//   div How are you doing {{ name() }}?
//   div Are you having a nice day?
// @include (excitedGreeting)
// @include (hello, 'Everybody')
// @if (condition())
// 	@include (hello, 'Dudes')
export function Templates(realParent: Node, parent: DocumentFragment) {
	function excitedGreeting(realParent: Node, parent: DocumentFragment) {
		const strong = createElement(parent, 'strong')
		strong.textContent = 'Wow how are you doing!!!!'
	}

	function hello(realParent: Node, parent: DocumentFragment, name: Immutable<string>) {
		const div1 = createElement(parent, 'div')
		effect(() => {
			div1.textContent = `How are you doing ${ name() }?`
		})
		const div2 = createElement(parent, 'div')
		div2.textContent = 'Are you having a nice day?'
	}

	const everybody = value('Everybody')
	excitedGreeting(realParent, parent)
	hello(realParent, parent, everybody)

	const condition = value(false)

	const dudes = value('Dudes')
	rangeEffect((realParent, parent) => {
		if (condition()) {
			hello(realParent, parent, dudes)
		}
	}, realParent, parent)

	return { condition, everybody, dudes }
}
describe('Templates', () => it('works', () => {
	const { condition, everybody, dudes } = Templates(body, body as unknown as DocumentFragment)

	const strong = tagText('strong', 'Wow how are you doing!!!!')
	const niceDay = divText('Are you having a nice day?')
	const hello = (s: string) => divText(`How are you doing ${s}?`) + niceDay
	expect(body.innerHTML).equal(
		strong
		+ hello('Everybody')
		+ comment
	)

	condition(true)
	expect(body.innerHTML).equal(
		strong
		+ hello('Everybody')
		+ begin + hello('Dudes') + end
	)

	everybody('not everybody')
	expect(body.innerHTML).equal(
		strong
		+ hello('not everybody')
		+ begin + hello('Dudes') + end
	)

	dudes('not dudes')
	expect(body.innerHTML).equal(
		strong
		+ hello('not everybody')
		+ begin + hello('not dudes') + end
	)

	condition(false)
	expect(body.innerHTML).equal(
		strong
		+ hello('not everybody')
		+ comment
	)

	dudes('invisible')
	expect(body.innerHTML).equal(
		strong
		+ hello('not everybody')
		+ comment
	)

	condition(true)
	expect(body.innerHTML).equal(
		strong
		+ hello('not everybody')
		+ begin + hello('invisible') + end
	)
}))


// @:bind (weapon = weaponChannel())
// @match (weapon.type)
// 	@when ('blade')
// 		h1 Watch out! It's sharp!
// 	@when ('projectile')
// 		p This is a projectile weapon.
// 		p It shoots {{ weapon.projectile() }}.
// 	@when ('blunt')
// 	@default: span unknown weapon type
export function MatchStatement(realParent: Node, parent: DocumentFragment) {
	type Weapon =
		| { type: 'blade' }
		| { type: 'projectile', projectile: Immutable<string> }
		| { type: 'blunt' }
		| { type: 'energy', voltage: number }

	const weaponChannel = channel({ type: 'blade' } as Weapon)
	rangeEffect((realParent, parent) => {
		const weapon = weaponChannel()
		switch (weapon.type) {
			case 'blade':
				const h1 = createElement(parent, 'h1')
				h1.textContent = "Watch out! It's sharp!"
				break
			case 'projectile':
				const p1 = createElement(parent, 'p')
				p1.textContent = 'This is a projectile weapon.'
				const p2 = createElement(parent, 'p')
				effect(() => {
					p2.textContent = `It shoots ${ weapon.projectile() }.`
				})
				break
			case 'blunt':
				break
			default:
				const span = createElement(parent, 'span')
				span.textContent = 'unknown weapon type'
				break
		}
	}, realParent, parent)

	return weaponChannel
}
describe('MatchStatement', () => it('works', () => {
	const weaponChannel = MatchStatement(body, body as unknown as DocumentFragment)

	expect(body.innerHTML).equal(tagText('h1', "Watch out! It's sharp!"))

	weaponChannel({ type: 'energy', voltage: 1 })
	expect(body.innerHTML).equal(tagText('span', 'unknown weapon type'))

	weaponChannel({ type: 'blunt' })
	expect(body.innerHTML).equal(comment)

	weaponChannel({ type: 'blade' })
	expect(body.innerHTML).equal(tagText('h1', "Watch out! It's sharp!"))

	const projectile = value('bullets')
	weaponChannel({ type: 'projectile', projectile })
	expect(body.innerHTML).equal(
		begin
		+ tagText('p', 'This is a projectile weapon.')
		+ tagText('p', `It shoots bullets.`)
		+ end
	)

	projectile('arrows')
	expect(body.innerHTML).equal(
		begin
		+ tagText('p', 'This is a projectile weapon.')
		+ tagText('p', `It shoots arrows.`)
		+ end
	)
}))

// @:bind (fruit = fruitChannel())
// @switch (fruit)
// 	@case ('oranges')
// 		| Oranges are $0.59 a pound.
// 	@fallcase ('mangoes')
// 		h1 Oh I like mangoes too!
// 	@fallcase ('guavas')
// 	@case ('papayas')
// 		| Mangoes, guavas, and papayas are $2.79 a pound.
// 	@default
// 		| Sorry, we're out of {{ fruit }}.
export function SwitchStatement(realParent: Node, parent: DocumentFragment) {
	const fruitChannel = value('tomatoes')
	rangeEffect((realParent, parent) => {
		const fruit = fruitChannel()
		// in generated code, we will *always* put each case in an enclosed block to prevent scope clashing
		switch (fruit) {
			case 'oranges':
				createTextNode(parent, 'Oranges are $0.59 a pound.')
				break
			/*fall*/case 'mangoes':
				const h1 = createElement(parent, 'h1')
				h1.textContent = 'Oh I like mangoes too!'
			/*fall*/case 'guavas':
				// do nothing
			case 'papayas':
				createTextNode(parent, 'Mangoes, guavas, and papayas are $2.79 a pound.')
				break
			default:
				effect(() => {
					createTextNode(parent, `Sorry, we're out of ${ fruit }.`)
				})
		}
	}, realParent, parent)

	return fruitChannel
}
describe('SwitchStatement', () => it('works', () => {
	const fruitChannel = SwitchStatement(body, body as unknown as DocumentFragment)

	expect(body.innerHTML).equal(`Sorry, we're out of tomatoes.`)

	fruitChannel('papayas')
	expect(body.innerHTML).equal('Mangoes, guavas, and papayas are $2.79 a pound.')

	fruitChannel('oranges')
	expect(body.innerHTML).equal('Oranges are $0.59 a pound.')

	fruitChannel('guavas')
	expect(body.innerHTML).equal('Mangoes, guavas, and papayas are $2.79 a pound.')

	fruitChannel('mangoes')
	expect(body.innerHTML).equal(
		begin
		+ tagText('h1', 'Oh I like mangoes too!')
		+ 'Mangoes, guavas, and papayas are $2.79 a pound.'
		+ end
	)
}))


// p((fn)=makeRed)
// p((fn)={ p => { p.style.color = 'red' } })
export function NodeReceiver(realParent: Node, parent: DocumentFragment) {
	const p1Color = value('red')
	function makeRed(node: HTMLParagraphElement) {
		effect(() => {
			node.style.color = p1Color()
		})
	}

	const p1 = createElement(parent, 'p')
	nodeReceiver(p1, makeRed)

	const p2 = createElement(parent, 'p')
	nodeReceiver(p2, p => { p.style.color = p1Color() })

	return p1Color
}
describe('NodeReceiver', () => it('works', () => {
	const p1Color = NodeReceiver(body, body as unknown as DocumentFragment)

	expect(body.innerHTML).equal('<p style="color: red;"></p><p style="color: red;"></p>')

	p1Color('blue')
	expect(body.innerHTML).equal('<p style="color: blue;"></p><p style="color: red;"></p>')
}))


// type TodoComponent = {
// 	props: { id: number },
// 	syncs: { name: string, done: boolean },
// 	events: { completed: [], },
// 	slots: {  },
// }
// // h1 Task {{ id() }}, named: {{ name() }}
// // @if (editing()):
// // 	input(type="text", :value=description, @keyup.enter={ editing(false) })
// // @else
// // 	.{ stateClass() }.{ descriptionColor() }(@click=beginEditing)
// // 		| {{ description() }}

// // input(type="checkbox", !value.fake={ completed, complete })
// // button(@click=archive) Archive
// const TodoComponentDefinition: ComponentDefinition<TodoComponent> = (
// 	realParent, parent,
// 	{ id }, { name, done }, { completed }
// ) => {
// 	const h1 = createElement(parent, 'h1')
// 	effect(() => {
// 		h1.textContent = `Task ${id()}, named: ${name()}`
// 	})
// 	switcher(parent, done)

// 	return { id, name, done, completed }
// }
