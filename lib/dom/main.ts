// https://mattallan.me/posts/modern-javascript-without-a-bundler/
// file:///home/blaine/lab/project-f/lib/dom/main.html

import {
	DisplayType, Content, ContentState, Range, RangeState,
	createElement, createTextNode, contentEffect, rangeEffect,
	syncTextElement, syncCheckboxElement, syncElementAttribute,
	syncRadioElement, syncRadioElementReactive, syncSelectElement, syncSelectMultipleElement
 } from './index'
import { Immutable, Mutable, effect, statefulEffect, primitive, channel, computed } from '../reactivity'

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

	const button = createElement(parent, 'button')
	button.textContent = 'press'
	button.onclick = () => {
		selected.s('some string')
	}

	return { selected, select, changingC, def, A, B, C }
}

const parent = document.body
const container = document.createDocumentFragment()
const { selected } = SelectInput(parent, container)
parent.appendChild(container)

