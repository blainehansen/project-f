import 'mocha'
import { expect } from 'chai'
import { boilString } from '../utils.spec'

import { ContentState, Displayable, replaceContent, appendAll, clearContent } from './index'

beforeEach(() => {
	document.body.textContent = ''
})

const body = document.body
function makeDiv(text?: string) {
	const d = document.createElement('div')
	if (text !== undefined)
		d.textContent = text
	return d
}

function makeText(text: string) {
	return document.createTextNode(text)
}
function divText(text = '') {
	return `<div>${text}</div>`
}
function toArray<T>(thing: null | undefined | T | T[]): T[] {
	if (thing === null || thing === undefined) return []
	return Array.isArray(thing) ? thing : [thing]
}
function setupState(state: ContentState) {
	for (const item of toArray(state))
		body.appendChild(item)
}


describe('replaceContent', () => {
	it('replacing nothing with nothing', () => {
		let s
		s = replaceContent(body, null, undefined)
		expect(s).undefined
		s = replaceContent(body, undefined, undefined)
		expect(s).undefined
		s = replaceContent(body, '', undefined)
		expect(s).undefined
	})

	it('replacing text with text', () => {
		const t = makeText('initial')
		body.appendChild(t)
		let s
		s = replaceContent(body, 'a', t)
		expect(body.innerHTML).equal('a')
		expect(s).equal(t)

		s = replaceContent(body, 'b', t)
		expect(body.innerHTML).equal('b')
		expect(s).equal(t)
	})

	it('replacing nontext with text', () => {
		const d = makeDiv()
		body.appendChild(d)
		const s = replaceContent(body, 'a', d)
		expect(body.innerHTML).equal('a')
		expect(s instanceof Text).true
	})

	const states: ContentState[] = [
		undefined, makeText(''), makeText('initial'),
		makeDiv(), makeDiv(''), makeDiv('initial'),
		[makeDiv('initial'), makeDiv()],
		[makeDiv('initial'), makeText('yo'), makeDiv()],
	]

	for (const state of states)
		it(`replacing ${displayState(state)} with element`, () => {
			setupState(state)

			const d = makeDiv('hello')
			const s = replaceContent(body, d, state)
			expect(s).equal(d)
			expect(body.innerHTML).equal(divText('hello'))
		})

	for (const state of states)
		it(`replacing ${displayState(state)} with array`, () => {
			setupState(state)

			const s = replaceContent(body, [makeDiv('hello'), makeDiv('dude')], state)
			if (!Array.isArray(s)) throw new Error("bad outcoming state: " + displayState(s))
			expect(s.length).equal(2)
			expect(s.every(n => n instanceof HTMLDivElement)).true
			expect(body.innerHTML).equal(`${divText('hello')}${divText('dude')}`)
		})


	const cases: [Displayable, string][] = [
		[null, ''],
		[undefined, ''],
		['', ''],
		['yoyo', 'yoyo'],
		[makeDiv(), divText()],
		[makeDiv('stuff'), divText('stuff')],
		[[makeDiv(), makeDiv()], `${divText()}${divText()}`],
		[[makeDiv('something'), makeDiv(), makeDiv()], `${divText('something')}${divText()}${divText()}`],
		[[makeDiv('something'), makeDiv(), makeText('a'), makeText('b'), makeDiv()], `${divText('something')}${divText()}ab${divText()}`],
	]

	function displayState(state: ContentState): string {
		if (state === undefined) return 'empty'
		if (state instanceof Text) return `text ${state.data}`
		if (Array.isArray(state)) return `array ${state.map(n => displayState(n as unknown as ContentState)).join(', ')}`
		return `node ${state.outerHTML}`
	}

	for (const [displayable, html] of cases)
		for (const state of states)
			it(`replacing: ${displayState(state)} with: ${html}`, () => {
				setupState(state)

				replaceContent(body, displayable, state)
				expect(body.innerHTML).equal(html)
			})
})

describe('appendAll', () => {
	it('all text nodes', () => {
		const d = makeDiv()
		const r = appendAll(d, ['a', 'b'])
		expect(r.length).equal(2)
		expect(r.every(n => n instanceof Text)).true
		expect(d.childNodes.length).equal(2)
		expect(d.innerHTML).equal('ab')
	})

	it('all normal nodes', () => {
		const d = makeDiv()
		const r = appendAll(d, [makeDiv('yo'), makeDiv('dude')])
		expect(r.length).equal(2)
		expect(r.every(n => n instanceof HTMLDivElement)).true
		expect(d.childNodes.length).equal(2)
		expect(d.innerHTML).equal(`${divText('yo')}${divText('dude')}`)
	})

	it('mixed', () => {
		const d = makeDiv()
		const r = appendAll(d, [makeDiv('yo'), 'stuff', makeDiv('dude')])
		expect(r.length).equal(3)
		expect(r.every(n => n instanceof Node)).true
		expect(d.childNodes.length).equal(3)
		expect(d.innerHTML).equal(`${divText('yo')}stuff${divText('dude')}`)
	})
})

describe('clearContent', () => it('works', () => {
	body.appendChild(makeText('a'))
	body.appendChild(makeText('b'))
	expect(body.childNodes.length).equal(2)
	expect(body.innerHTML).equal('ab')

	clearContent(body)
	expect(body.childNodes.length).equal(0)
	expect(body.innerHTML).equal('')

	const d = makeDiv()
	d.appendChild(makeDiv())
	d.appendChild(makeDiv())
	d.appendChild(makeText('stuff'))
	expect(d.childNodes.length).equal(3)
	expect(d.innerHTML).equal('<div></div><div></div>stuff')

	clearContent(d)
	expect(d.childNodes.length).equal(0)
	expect(d.innerHTML).equal('')
}))
