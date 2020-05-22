// https://mattallan.me/posts/modern-javascript-without-a-bundler/
// file:///home/blaine/lab/project-f/lib/dom/main.html

import {
	Displayable, DisplayType, Range, ContentState,
	nodeReceiver, createElement, createTextNode, contentEffect, rangeEffect,
	syncTextElement, syncCheckboxElement, syncElementAttribute,
	syncRadioElement, syncRadioElementReactive, syncSelectElement, syncSelectMultipleElement
 } from './index'
import { Immutable, Mutable, effect, statefulEffect, data, value, channel, computed, thunk, sample } from '../reactivity'

export function SelectInput(realParent: Node, parent: DocumentFragment) {
	const selected = value("")
	const changingC = value("C")

	const select = createElement(parent, 'select')
	select.multiple = true
	syncSelectElement(select, selected)

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

	const display = createTextNode(parent, '')
	effect(() => {
		display.data = '' + selected()
	})

	return { selected, changingC, def, A, B, C }
}

const parent = document.body
const container = document.createDocumentFragment()
SelectInput(parent, container)
parent.appendChild(container)

