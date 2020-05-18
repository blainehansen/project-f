// https://mattallan.me/posts/modern-javascript-without-a-bundler/
// file:///home/blaine/lab/project-f/lib/dom/main.html

// import { CheckboxIfElseBlock, TextInput, BasicEach, IfThenEach, EachThenIf } from './main.spec'
import {
	Displayable, DisplayType, Range, ContentState,
	nodeReceiver, createElement, createTextNode, contentEffect, rangeEffect,
	syncTextElement, syncElementAttribute, syncRadioElement, syncRadioElementReactive,
 } from './index'
import { Immutable, Mutable, effect, statefulEffect, data, value, channel, computed, thunk, sample } from '../reactivity'

export function RadioInput(realParent: Node, parent: DocumentFragment) {
	const thing = channel(null as null | string | number[])
	const stringValue = value("changes")

	const one = createElement(parent, 'input')
	one.type = 'radio'
	syncRadioElement(one, thing, "some string")
	const two = createElement(parent, 'input')
	two.type = 'radio'
	const arr = [1, 2, 3]
	syncRadioElement(two, thing, arr)
	const three = createElement(parent, 'input')
	three.type = 'radio'
	syncRadioElementReactive(three, thing, stringValue)

	const input = createElement(parent, 'input')
	syncTextElement(input, stringValue)

	const display = createTextNode(parent, '')
	effect(() => {
		display.data = '' + thing()
	})

	return { thing, arr, stringValue, one, two, three }
}


const parent = document.body
const container = document.createDocumentFragment()
RadioInput(parent, container)
parent.appendChild(container)

