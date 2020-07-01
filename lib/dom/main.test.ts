import 'mocha'
import { expect } from 'chai'
import { boilString } from '../utils.test'
import { divText, tagText, inputText } from './manipulate.test'

import { NonLone, exec } from '../utils'
import {
	DisplayType, Content, ContentState, Range, RangeState,
	createElement, createTextNode, contentEffect, rangeEffect,
	syncTextElement, syncCheckboxElement, syncElementAttribute,
	syncRadioElement, syncRadioElementReactive, syncSelectElement, syncSelectMultipleElement
 } from './index'
import { Immutable, Mutable, effect, statefulEffect, primitive, channel, computed } from '../reactivity'

const body = document.body
beforeEach(() => {
	body.textContent = ''
})


const inputCheck = `<input type="checkbox">`
const endAnchor = '<!---->'
const begin = '<!--begin-->'
const end = '<!--end-->'
const someInput = (placeholder: string) => `<input type="text" placeholder="${placeholder}">`
function eachText<T>(collection: T[], fn: (t: T) => string) {
	return collection.map(fn).join('') + endAnchor
}


export function switcher(parent: Node, checked: Mutable<boolean>) {
	const input = createElement(parent, 'input')
	input.type = 'checkbox'
	syncElementAttribute(input, 'onchange', 'checked', checked)
	return input
}
describe('switcher', () => it('works', () => {
	const checked = primitive(false)
	const checkbox = switcher(body, checked)

	expect(checkbox.checked).false
	expect(checked.r()).false

	checkbox.click()
	expect(checkbox.checked).true
	expect(checked.r()).true

	checked.s(false)
	expect(checked.r()).false
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

		const currentList = list.r()
		currentList.push(fn(newLetter))
		list.s(currentList)
	}

	return input
}
// describe('appender', () => it('works', () => {
// 	const list = channel([])
// 	const input = appender(body, list, s => s)

// 	expect(list.r()).eql([])
// }))

export function deleter(parent: Node, list: Mutable<unknown[]>, index: number) {
	const button = createElement(parent, 'button')
	button.textContent = "delete"
	button.onclick = $event => {
		const currentList = list.r()
		currentList.splice(index, 1)
		list.s(currentList)
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
// 		@if (checked.r()) hello checked world
// 		@else: b oh no!
export function CheckboxIfElseBlock(realParent: Node, parent: DocumentFragment) {
	const component = createElement(parent, 'div')

	const checked = primitive(true)
	switcher(component, checked)

	const div = createElement(component, 'div')
	const b = document.createElement('b')
	b.textContent = 'oh no!'
	contentEffect((realParent, parent) => {
		if (checked.r()) createTextNode(parent, 'hello checked world')
		else parent.appendChild(b)
	}, div)

	return { checked }
}
describe('CheckboxIfElseBlock', () => it('works', () => {
	const { checked } = CheckboxIfElseBlock(body, body as unknown as DocumentFragment)

	expect(body.innerHTML).equal(divText(`${inputCheck}${divText('hello checked world')}`))

	checked.s(false)
	expect(body.innerHTML).equal(divText(`${inputCheck}${divText(tagText('b', 'oh no!'))}`))
}))


// @if (letter.r() === 'a') raw text
// @else-if (letter.r() === 'b')
// 	span multiple
// 	div things
// @else-if (letter.r() === 'c'): div the letter: {{ letter.r() }}
export function ChainedIfElse(realParent: Node, parent: DocumentFragment) {
	const letter = primitive('')

	contentEffect((realParent, parent) => {
		if ((letter.r() === 'a')) {
			createTextNode(parent, 'raw text')
		}
		else if (letter.r() === 'b') {
			const span = createElement(parent, 'span')
			span.textContent = 'multiple'
			const div = createElement(parent, 'div')
			div.textContent = 'things'
		}
		else if (letter.r() === 'c') {
			const div = createElement(parent, 'div')
			effect(() => {
				div.textContent = `the letter: ${ letter.r() }`
			})
		}
	}, realParent)

	return letter
}
describe('ChainedIfElse', () => it('works', () => {
	const letter = ChainedIfElse(body, body as unknown as DocumentFragment)
	expect(body.innerHTML).equal('')
	letter.s('a')
	expect(body.innerHTML).equal('raw text')
	letter.s('c')
	expect(body.innerHTML).equal(divText('the letter: c'))
	letter.s('b')
	expect(body.innerHTML).equal(tagText('span', 'multiple') + divText('things'))
	letter.s('c')
	expect(body.innerHTML).equal(divText('the letter: c'))
	letter.s('d')
	expect(body.innerHTML).equal('')
}))


// div
// 	input(type="text", placeholder="yo yo", !sync=text)
// 	| {{ text.r() }}
export function TextInput(realParent: Node, parent: DocumentFragment) {
	const component = createElement(parent, 'div')

	const text = primitive('')
	const input = createElement(component, 'input')
	input.type = 'text'
	input.placeholder = 'yo yo'
	syncTextElement(input, text)

	const display = createTextNode(component, '')
	effect(() => {
		display.data = text.r()
	})

	return { text, input }
}
describe('TextInput', () => it('works', () => {
	const { text, input } = TextInput(body, body as unknown as DocumentFragment)

	const inputText = `<input type="text" placeholder="yo yo">`
	expect(body.innerHTML).equal(divText(inputText))
	expect(input.value).equal('')

	text.s('stuff')
	expect(body.innerHTML).equal(divText(`${inputText}stuff`))
	expect(input.value).equal('stuff')
}))


// textarea(placeholder="yo yo", !sync=text)
// | {{ text.r() }}
export function TextareaInput(realParent: Node, parent: DocumentFragment) {
	const text = primitive('')

	const textarea = createElement(parent, 'textarea')
	textarea.placeholder = 'yo yo'
	syncTextElement(textarea, text)

	const display = createTextNode(parent, '')
	effect(() => {
		display.data = text.r()
	})

	return { text, textarea }
}
describe('TextareaInput', () => it('works', () => {
	const { text, textarea } = TextareaInput(body, body as unknown as DocumentFragment)

	const textareaText = `<textarea placeholder="yo yo"></textarea>`
	expect(body.innerHTML).equal(textareaText)

	text.s('stuff')
	expect(body.innerHTML).equal(textareaText + 'stuff')
}))


// // input(type="checkbox", !sync=thing, value="some string")
// // input(type="checkbox", !sync=thing, value={ [1, 2, 3] })
// // input(type="checkbox", !sync=thing, :value=stringValue)
// // | {{ '' + thing.r() }}
// export function CheckboxGroupInput(realParent: Node, parent: DocumentFragment) {
// 	const things = channel([] as (string | number[])[])
// 	const stringValue = primitive("changes")

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

// 	stringValue.s("not changes")
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
// | {{ '' + thing.r() }}
export function RadioInput(realParent: Node, parent: DocumentFragment) {
	const thing = channel("blargh")
	const stringValue = primitive("changes")

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
		display.data = '' + thing.r()
	})

	return { thing, stringValue, one, two, three }
}
describe('RadioInput', () => it('works', () => {
	const { thing, stringValue, one, two, three } = RadioInput(body, body as unknown as DocumentFragment)
	const radioInputText = (v: string) => one.outerHTML + two.outerHTML + three.outerHTML + v

	expect([one.checked, two.checked, three.checked]).eql([false, false, false])
	expect(body.innerHTML).equal(radioInputText('blargh'))

	thing.s("")
	expect([one.checked, two.checked, three.checked]).eql([true, false, false])
	expect(body.innerHTML).equal(radioInputText(""))

	thing.s("some string")
	expect([one.checked, two.checked, three.checked]).eql([false, true, false])
	expect(body.innerHTML).equal(radioInputText("some string"))

	thing.s("changes")
	expect([one.checked, two.checked, three.checked]).eql([false, false, true])
	expect(body.innerHTML).equal(radioInputText("changes"))

	stringValue.s("not changes")
	// AGH
	expect([one.checked, two.checked, three.checked]).eql([false, false, false])
	expect(body.innerHTML).equal(radioInputText('changes'))

	thing.s("not changes")
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
	const selected = primitive("")
	const changingC = primitive("C")

	const select = createElement(parent, 'select')

	const def = createElement(select, 'option')
	;(def as any)._secret = 'def'
	def.textContent = "Please select one"
	def.disabled = true
	def.value = ""
	const A = createElement(select, 'option')
	;(A as any)._secret = 'A'
	A.textContent = 'A'
	const B = createElement(select, 'option')
	;(B as any)._secret = 'B'
	B.textContent = 'B'
	B.value = 'Basic'
	const C = createElement(select, 'option')
	;(C as any)._secret = 'C'
	C.textContent = 'C'
	effect(() => {
		C.value = changingC.r()
	})
	syncSelectElement(select, selected)

	const display = createTextNode(parent, '')
	effect(() => {
		display.data = '' + selected.r()
	})

	return { selected, select, changingC, def, A, B, C }
}
describe('only SelectInput', () => it('works', () => {
	const { selected, select, changingC, def, A, B, C } = SelectInput(body, body as unknown as DocumentFragment)
	const selectText = (v: string) => select.outerHTML + v

	expect([def.selected, A.selected, B.selected, C.selected]).eql([true, false, false, false])
	expect(body.innerHTML).equal(selectText(''))

	selected.s("some string")
	expect([def.selected, A.selected, B.selected, C.selected]).eql([false, false, false, false])
	expect(body.innerHTML).equal(selectText("some string"))

	selected.s("A")
	expect([def.selected, A.selected, B.selected, C.selected]).eql([false, true, false, false])
	expect(body.innerHTML).equal(selectText("A"))

	selected.s("Basic")
	expect([def.selected, A.selected, B.selected, C.selected]).eql([false, false, true, false])
	expect(body.innerHTML).equal(selectText("Basic"))

	selected.s("C")
	expect([def.selected, A.selected, B.selected, C.selected]).eql([false, false, false, true])
	expect(body.innerHTML).equal(selectText("C"))

	changingC.s("Casic")
	// AGH
	expect([def.selected, A.selected, B.selected, C.selected]).eql([false, false, false, true])
	expect(body.innerHTML).equal(selectText("C"))

	selected.s("Casic")
	expect([def.selected, A.selected, B.selected, C.selected]).eql([false, false, false, true])
	expect(body.innerHTML).equal(selectText("Casic"))

	selected.s("")
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
	const changingC = primitive("C")

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
		C.value = changingC.r()
	})
	syncSelectMultipleElement(select, selected)

	const display = createTextNode(parent, '')
	effect(() => {
		display.data = '' + selected.r()
	})

	return { selected, select, changingC, A, B, C }
}
describe('SelectInputMultiple', () => it('works', () => {
	const { selected, select, changingC, A, B, C } = SelectInputMultiple(body, body as unknown as DocumentFragment)
	const selectText = (v: string) => select.outerHTML + v

	expect([A.selected, B.selected, C.selected]).eql([false, false, false])
	expect(body.innerHTML).equal(selectText(''))

	selected.s(["some string"])
	expect([A.selected, B.selected, C.selected]).eql([false, false, false])
	expect(body.innerHTML).equal(selectText("some string"))

	selected.s(["A", "Basic"])
	expect([A.selected, B.selected, C.selected]).eql([true, true, false])
	expect(body.innerHTML).equal(selectText("A,Basic"))

	selected.s(["C"])
	expect([A.selected, B.selected, C.selected]).eql([false, false, true])
	expect(body.innerHTML).equal(selectText("C"))

	changingC.s("Casic")
	// AGH
	expect([A.selected, B.selected, C.selected]).eql([false, false, true])
	expect(body.innerHTML).equal(selectText("C"))

	selected.s(["Casic"])
	expect([A.selected, B.selected, C.selected]).eql([false, false, true])
	expect(body.innerHTML).equal(selectText("Casic"))

	selected.s([])
	expect([A.selected, B.selected, C.selected]).eql([false, false, false])
	expect(body.innerHTML).equal(selectText(''))
}))


// h1 Letters:
// @each ((letter, index) of list.r()): div
// 	i letter: {{ letter }}
// 	button(@click={ deleteItem(index) }) delete this letter
// input(type="text", placeholder="add a new letter", @keyup.enter=pushNewLetter)
export function BasicEach(realParent: Node, parent: DocumentFragment) {
	const header = createElement(parent, 'h1')
	header.textContent = "Letters:"

	const list = channel(['a', 'b', 'c'])
	rangeEffect((realParent, parent) => {
		for (const [index, letter] of list.r().entries()) {
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
	const l = list.r()

	const loop = (...s: string[]) => {
		return tagText('h1', 'Letters:')
			+ s.map(s => divText(`${tagText('i', `letter: "${s}"`)}${tagText('button', 'delete')}`)).join('')
			+ endAnchor
			+ someInput('append')
	}
	expect(body.innerHTML).equal(loop('a', 'b', 'c'))

	l.splice(1, 1)
	list.s(l)
	expect(body.innerHTML).equal(loop('a', 'c'))

	l.push('d')
	list.s(l)
	expect(body.innerHTML).equal(loop('a', 'c', 'd'))
}))


// input(type="checkbox", !sync=condition)
// @if (condition.r())
//   @each ((item, index) of items.r()): div
// 		| {{ item }}
// 		button(@click={ delete(index) }) delete
// input(type="text", @click.enter=append)
export function IfThenEach(realParent: Node, parent: DocumentFragment) {
	const condition = primitive(true)
	switcher(parent, condition)

	const items = channel(['a', 'b', 'c'])
	rangeEffect((realParent, parent) => {
		if (condition.r()) {
			for (const [index, item] of items.r().entries()) {
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

	const i = items.r()
	const loop = (...s: string[]) => {
		return inputCheck
			+ s.map(s => divText(`${s}${tagText('button', 'delete')}`)).join('')
			+ endAnchor
			+ someInput('append')
	}
	expect(body.innerHTML).equal(loop('a', 'b', 'c'))

	condition.s(false)
	expect(body.innerHTML).equal(inputCheck + endAnchor + someInput('append'))

	i.push('d')
	items.s(i)
	expect(body.innerHTML).equal(inputCheck + endAnchor + someInput('append'))

	condition.s(true)
	expect(body.innerHTML).equal(loop('a', 'b', 'c', 'd'))
}))


// appender
// @each (item of items.r())
// 	@if (item.condition.r()): div
// 		| {{ item.name }}
// 		button(@click=delete)
// @each (item of items.r())
// 	input(type="checkbox", !sync={ item.condition })
export function EachThenIf(realParent: Node, parent: DocumentFragment) {
	const items = channel([
		{ name: 'a', condition: primitive(true) },
		{ name: 'b', condition: primitive(false) },
		{ name: 'c', condition: primitive(false) },
		{ name: 'd', condition: primitive(true) },
	])

	appender(parent, items, name => ({ name, condition: primitive(Math.random() > 0.5) }))
	rangeEffect((realParent, parent) => {
		for (const item of items.r()) {
			switcher(parent, item.condition)
		}
	}, realParent, parent)

	rangeEffect((realParent, parent) => {
		for (const [index, item] of items.r().entries()) {
			rangeEffect((realParent, parent) => {
				if (item.condition.r()) {
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

	const i = items.r()
	const loop = (...s: { name: string, condition: boolean }[]) => {
		return someInput('append')
			+ s.map(() => inputCheck).join('')
			+ endAnchor
			+ s.map(item => (item.condition ? divText(`${item.name}${tagText('button', 'delete')}`) : '') + endAnchor).join('')
			+ endAnchor
	}
	expect(body.innerHTML).equal(loop(
		{ name: 'a', condition: true },
		{ name: 'b', condition: false },
		{ name: 'c', condition: false },
		{ name: 'd', condition: true },
	))

	const item = { name: 'e', condition: primitive(true) }
	i.push(item)
	items.s(i)
	expect(body.innerHTML).equal(loop(
		{ name: 'a', condition: true },
		{ name: 'b', condition: false },
		{ name: 'c', condition: false },
		{ name: 'd', condition: true },
		{ name: 'e', condition: true },
	))

	item.condition.s(false)
	expect(body.innerHTML).equal(loop(
		{ name: 'a', condition: true },
		{ name: 'b', condition: false },
		{ name: 'c', condition: false },
		{ name: 'd', condition: true },
		{ name: 'e', condition: false },
	))

	i.pop()
	items.s(i)
	expect(body.innerHTML).equal(loop(
		{ name: 'a', condition: true },
		{ name: 'b', condition: false },
		{ name: 'c', condition: false },
		{ name: 'd', condition: true },
	))

	i.splice(2, 1)
	items.s(i)
	expect(body.innerHTML).equal(loop(
		{ name: 'a', condition: true },
		{ name: 'b', condition: false },
		{ name: 'd', condition: true },
	))
}))





// @each (post of posts.r())
// 	@if (post.important): h1 {{ post.title }}
// 	@else
// 		p not important: {{ post.title }}
// 	small {{ post.subscript }}
// 	@each (tag of post.tags.r()): .tag
// 		@if (tag.project.r()): .project-star
// 		| {{ tag.name }}
// 		@each (n of [1, 2, 3, 4, 5])
// 			.star: @if (tag.stars.r() >= n) filled
// b Have a good day!
export function ComplexIfEachNesting(realParent: Node, parent: DocumentFragment) {
	const posts = channel([
		{ important: false, title: 'A', subscript: 'a', tags: channel([
			{ project: primitive(true), name: 't1', stars: primitive(3) },
		]) },
		{ important: true, title: 'B', subscript: 'b', tags: channel([
			{ project: primitive(false), name: 't2', stars: primitive(5) },
			{ project: primitive(true), name: 't3', stars: primitive(0) },
		]) },
		{ important: false, title: 'C', subscript: 'c', tags: channel([]) },
	])

	rangeEffect((realParent, parent) => {
		for (const post of posts.r()) {
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
				for (const tag of post.tags.r()) {
					const tagDiv = createElement(parent, 'div')
					tagDiv.className = 'tag'
					const tagDivFragment = document.createDocumentFragment()

					// project-star if block
					rangeEffect((tagDiv, tagDivFragment) => {
						if (tag.project.r()) {
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
								starDiv.textContent = tag.stars.r() >= n ? 'filled' : ''
							})
						}
					}, tagDiv, tagDivFragment)

					// append the fragment
					tagDiv.appendChild(tagDivFragment)
				}
			}, realParent, parent)
		}

	}, realParent, parent)

	const b = createElement(parent, 'b')
	b.textContent = 'Have a good day!'

	return posts
}
describe('ComplexIfEachNesting', () => it('works', () => {
	const postsChannel = ComplexIfEachNesting(body, body as unknown as DocumentFragment)
	const posts = postsChannel.r()

	type Post = { important: boolean, title: string, subscript: string, tags: { project: boolean, name: string, stars: number }[] }
	const loop = (...posts: Post[]) => {
		return eachText(posts, post => {
			return (post.important ? tagText('h1', post.title) : tagText('p', `not important: ${post.title}`)) + endAnchor
				+ tagText('small', post.subscript)
				+ eachText(post.tags, tag => {
					return divText(
						(tag.project ? divText('', 'project-star') : '') + endAnchor
							+ tag.name
							+ eachText([1, 2, 3, 4, 5], n => {
								return divText(tag.stars >= n ? 'filled' : '', 'star')
							}),
						'tag',
					)
				})
		})
		+ tagText('b', 'Have a good day!')
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

	let tags = posts[1]!.tags.r()
	tags.splice(1, 1)
	posts[1]!.tags.s(tags)
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
	posts[1]!.tags.s(tags)
	expect(body.innerHTML).equal(loop(
		{ important: false, title: 'A', subscript: 'a', tags: [
			{ project: true, name: 't1', stars: 3 },
		] },
		{ important: true, title: 'B', subscript: 'b', tags: [
			{ project: false, name: 'yoyo', stars: 5 },
		] },
		{ important: false, title: 'C', subscript: 'c', tags: [] },
	))

	tags[0]!.project.s(true)
	expect(body.innerHTML).equal(loop(
		{ important: false, title: 'A', subscript: 'a', tags: [
			{ project: true, name: 't1', stars: 3 },
		] },
		{ important: true, title: 'B', subscript: 'b', tags: [
			{ project: true, name: 'yoyo', stars: 5 },
		] },
		{ important: false, title: 'C', subscript: 'c', tags: [] },
	))

	tags[0]!.stars.s(0)
	expect(body.innerHTML).equal(loop(
		{ important: false, title: 'A', subscript: 'a', tags: [
			{ project: true, name: 't1', stars: 3 },
		] },
		{ important: true, title: 'B', subscript: 'b', tags: [
			{ project: true, name: 'yoyo', stars: 0 },
		] },
		{ important: false, title: 'C', subscript: 'c', tags: [] },
	))

	tags[0]!.stars.s(1)
	expect(body.innerHTML).equal(loop(
		{ important: false, title: 'A', subscript: 'a', tags: [
			{ project: true, name: 't1', stars: 3 },
		] },
		{ important: true, title: 'B', subscript: 'b', tags: [
			{ project: true, name: 'yoyo', stars: 1 },
		] },
		{ important: false, title: 'C', subscript: 'c', tags: [] },
	))

	tags.unshift({ project: primitive(false), name: 'yello', stars: primitive(-1) })
	posts[1]!.tags.s(tags)
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
		{ project: primitive(true), name: 'blah blah', stars: primitive(9) },
		{ project: primitive(false), name: 'blah once', stars: primitive(0) },
	]) })
	postsChannel.s(posts)
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
	postsChannel.s(posts)
	expect(body.innerHTML).equal(endAnchor + tagText('b', 'Have a good day!'))
}))



// @template (excitedGreeting)
//   strong Wow how are you doing!!!!
// @template (hello, name: Immutable<string>)
//   div How are you doing {{ name() }}?
//   div Are you having a nice day?
// @include (excitedGreeting)
// @include (hello, 'Everybody')
// @if (condition.r())
// 	@include (hello, 'Dudes')
export function Templates(realParent: Node, parent: DocumentFragment) {
	function excitedGreeting(realParent: Node, parent: DocumentFragment) {
		const strong = createElement(parent, 'strong')
		strong.textContent = 'Wow how are you doing!!!!'
	}

	function hello(realParent: Node, parent: DocumentFragment, name: Immutable<string>) {
		const div1 = createElement(parent, 'div')
		effect(() => {
			div1.textContent = `How are you doing ${ name.r() }?`
		})
		const div2 = createElement(parent, 'div')
		div2.textContent = 'Are you having a nice day?'
	}

	const everybody = primitive('Everybody')
	excitedGreeting(realParent, parent)
	hello(realParent, parent, everybody)

	const condition = primitive(false)

	const dudes = primitive('Dudes')
	rangeEffect((realParent, parent) => {
		if (condition.r()) {
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
		+ endAnchor
	)

	condition.s(true)
	expect(body.innerHTML).equal(
		strong
		+ hello('Everybody')
		+ hello('Dudes') + endAnchor
	)

	everybody.s('not everybody')
	expect(body.innerHTML).equal(
		strong
		+ hello('not everybody')
		+ hello('Dudes') + endAnchor
	)

	dudes.s('not dudes')
	expect(body.innerHTML).equal(
		strong
		+ hello('not everybody')
		+ hello('not dudes') + endAnchor
	)

	condition.s(false)
	expect(body.innerHTML).equal(
		strong
		+ hello('not everybody')
		+ endAnchor
	)

	dudes.s('invisible')
	expect(body.innerHTML).equal(
		strong
		+ hello('not everybody')
		+ endAnchor
	)

	condition.s(true)
	expect(body.innerHTML).equal(
		strong
		+ hello('not everybody')
		+ hello('invisible') + endAnchor
	)
}))


// h1 Weapon stats
// @match (:weapon = weaponChannel; weapon.type)
// 	@when ('blade')
// 		h2 Watch out! It's sharp!
// 	@when ('projectile')
// 		p This is a projectile weapon.
// 		p It shoots {{: weapon.projectile }}.
// 	@when ('blunt')
// 	@default: span unknown weapon type
export function MatchStatement(realParent: Node, parent: DocumentFragment) {
	const h1 = createElement(parent, 'h1')
	h1.textContent = 'Weapon stats'

	type Weapon =
		| { type: 'blade' }
		| { type: 'projectile', projectile: Immutable<string> }
		| { type: 'blunt' }
		| { type: 'energy', voltage: number }

	const weaponChannel = channel({ type: 'blade' } as Weapon)
	rangeEffect((realParent, parent) => {
		const weapon = weaponChannel.r()
		switch (weapon.type) {
			case 'blade':
				const h2 = createElement(parent, 'h2')
				h2.textContent = "Watch out! It's sharp!"
				break
			case 'projectile':
				const p1 = createElement(parent, 'p')
				p1.textContent = 'This is a projectile weapon.'
				const p2 = createElement(parent, 'p')
				effect(() => {
					p2.textContent = `It shoots ${ weapon.projectile.r() }.`
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
	const h1 = tagText('h1', 'Weapon stats')

	expect(body.innerHTML).equal(h1 + tagText('h2', "Watch out! It's sharp!") + endAnchor)

	weaponChannel.s({ type: 'energy', voltage: 1 })
	expect(body.innerHTML).equal(h1 + tagText('span', 'unknown weapon type') + endAnchor)

	weaponChannel.s({ type: 'blunt' })
	expect(body.innerHTML).equal(h1 + endAnchor)

	weaponChannel.s({ type: 'blade' })
	expect(body.innerHTML).equal(h1 + tagText('h2', "Watch out! It's sharp!") + endAnchor)

	const projectile = primitive('bullets')
	weaponChannel.s({ type: 'projectile', projectile })
	expect(body.innerHTML).equal(
		h1
		+ tagText('p', 'This is a projectile weapon.')
		+ tagText('p', `It shoots bullets.`)
		+ endAnchor
	)

	projectile.s('arrows')
	expect(body.innerHTML).equal(
		h1
		+ tagText('p', 'This is a projectile weapon.')
		+ tagText('p', `It shoots arrows.`)
		+ endAnchor
	)
}))

// @switch (:fruit = fruitChannel)
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
	const fruitChannel = primitive('tomatoes')
	contentEffect((realParent, parent) => {
		const fruit = fruitChannel.r()
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
	}, realParent)

	return fruitChannel
}
describe('SwitchStatement', () => it('works', () => {
	const fruitChannel = SwitchStatement(body, body as unknown as DocumentFragment)

	expect(body.innerHTML).equal(`Sorry, we're out of tomatoes.`)

	fruitChannel.s('papayas')
	expect(body.innerHTML).equal('Mangoes, guavas, and papayas are $2.79 a pound.')

	fruitChannel.s('oranges')
	expect(body.innerHTML).equal('Oranges are $0.59 a pound.')

	fruitChannel.s('guavas')
	expect(body.innerHTML).equal('Mangoes, guavas, and papayas are $2.79 a pound.')

	fruitChannel.s('mangoes')
	expect(body.innerHTML).equal(
		tagText('h1', 'Oh I like mangoes too!')
		+ 'Mangoes, guavas, and papayas are $2.79 a pound.'
	)
}))


// p((fn)=makeRed)
// p((fn)={ p => { p.style.color = 'red' } })
export function NodeReceiver(realParent: Node, parent: DocumentFragment) {
	const p1Color = primitive('red')
	function makeRed(node: HTMLParagraphElement) {
		effect(() => {
			node.style.color = p1Color.r()
		})
	}

	const p1 = createElement(parent, 'p')
	;(makeRed)(p1)

	const p2 = createElement(parent, 'p')
	;(p => { p.style.color = p1Color.r() })(p2)

	return p1Color
}
describe('NodeReceiver', () => it('works', () => {
	const p1Color = NodeReceiver(body, body as unknown as DocumentFragment)

	expect(body.innerHTML).equal('<p style="color: red;"></p><p style="color: red;"></p>')

	p1Color.s('blue')
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
