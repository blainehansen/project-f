import 'mocha'
import { expect } from 'chai'
import { boilString } from '../utils.spec'
import { divText, tagText } from './index.spec'

import { NonLone, exec } from '../utils'
import { createElement, createTextNode, contentEffect, rangeEffect, Displayable, DisplayType, Range, ContentState } from './index'
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

// div
// 	input(type="checkbox", !sync=checked)
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


// export function ChainedIfElse(realParent: Node, parent: DocumentFragment) {
// 	//
// }

// div
// 	input(type="text", placeholder="yo yo", !sync=text)
// 	| {{ text() }}
export function TextInput(realParent: Node, parent: DocumentFragment) {
	const component = document.createElement('div')
	parent.appendChild(component)

	const text = value('')
	const input = document.createElement('input')
	input.type = 'text'
	input.placeholder = 'yo yo'
	input.oninput = $event => {
		text(($event.target as typeof input).value)
	}
	effect(() => {
		input.value = text()
	})
	component.appendChild(input)

	const display = document.createTextNode('')
	effect(() => {
		display.data = text()
	})
	component.appendChild(display)

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


// h1 Letters:
// @each ((letter, index) of list()): div
// 	i letter: {{ letter }}
// 	button(@click={ deleteItem(index) }) delete this letter
// input(type="text", placeholder="add a new letter", @keyup.enter=pushNewLetter)
export function BasicEach(realParent: Node, parent: DocumentFragment) {
	const header = document.createElement('h1')
	header.textContent = "Letters:"
	parent.appendChild(header)

	const list = channel(['a', 'b', 'c'])
	rangeEffect((realParent, parent) => {
		for (const [index, letter] of list().entries()) {
			const div = document.createElement('div')
			parent.appendChild(div)
			const item = document.createElement('i')
			item.textContent = `letter: "${letter}"`
			div.appendChild(item)
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
				const div = document.createElement('div')
				parent.appendChild(div)
				const text = document.createTextNode(item)
				div.appendChild(text)
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
					const div = document.createElement('div')
					parent.appendChild(div)
					const text = document.createTextNode(item.name)
					div.appendChild(text)
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
	const button = document.createElement('button')
	button.textContent = "delete"
	button.onclick = $event => {
		const currentList = list()
		currentList.splice(index, 1)
		list(currentList)
	}
	parent.appendChild(button)
	return button
}
// describe('deleter', () => it('works', () => {
// 	const list = channel(['a', 'b', 'c'])
// 	const button = deleter(body, list, 1)

// 	expect(body.innerHTML).equal()
// }))
