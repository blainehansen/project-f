import 'mocha'
import { expect } from 'chai'
import { boilString } from '../utils.spec'

import { NonLone } from '../utils'
import { replaceContent, replaceRange, appendAll, clearContent, Displayable, DisplayType, ContentState, Range } from './index'

beforeEach(() => {
	document.body.textContent = ''
})

const body = document.body
export function makeDiv(text?: string) {
	const d = document.createElement('div')
	if (text !== undefined)
		d.textContent = text
	return d
}

export function makeText(text: string) {
	return document.createTextNode(text)
}
export function divText(text = '', className?: string) {
	const classSection = className === undefined ? '' : ` class="${className}"`
	return `<div${classSection}>${text}</div>`
}
export function tagText(tag: string, text = '', className?: string) {
	const classSection = className === undefined ? '' : ` class="${className}"`
	return `<${tag}${classSection}>${text}</${tag}>`
}
export function inputText(type: string) {
	return `<input type="${type}">`
}
function toArray<T>(thing: null | undefined | T | T[]): T[] {
	if (thing === null || thing === undefined) return []
	return Array.isArray(thing) ? thing : [thing]
}

function intoContentState(content: undefined | string | Node | NonLone<Node>): ContentState {
	return content === undefined ? { type: DisplayType.empty, content }
		: Array.isArray(content) ? { type: DisplayType.many, content }
		: typeof content === 'string' ? { type: DisplayType.text, content: makeText(content) }
		: content.nodeType === Node.TEXT_NODE ? { type: DisplayType.text, content: content as Text }
		: { type: DisplayType.node, content }
}
function intoNodeArray(state: ContentState) {
	switch (state.type) {
	case DisplayType.empty: return []
	case DisplayType.many: return state.content
	default: return [state.content]
	}
}
function setupState(state: ContentState) {
	for (const item of intoNodeArray(state))
		body.appendChild(item)
}

const cases: [Displayable, string][] = [
	[null, ''],
	[undefined, ''],
	[[], ''],
	['', ''],
	['yoyo', 'yoyo'],

	[makeDiv(), divText()],
	[[makeDiv()], divText()],
	[makeDiv('stuff'), divText('stuff')],
	[[makeDiv('stuff')], divText('stuff')],

	[[makeDiv(), makeDiv()], `${divText()}${divText()}`],
	[[makeDiv('something'), makeDiv(), makeDiv()], `${divText('something')}${divText()}${divText()}`],
	[[makeDiv('something'), makeDiv(), makeText('a'), makeText('b'), makeDiv()], `${divText('something')}${divText()}ab${divText()}`],
]


describe('replaceContent', () => {
	it('replacing nothing with nothing', () => {
		let s
		s = replaceContent(body, { type: DisplayType.empty, content: undefined }, null)
		expect(s.content).undefined
		s = replaceContent(body, { type: DisplayType.empty, content: undefined }, undefined)
		expect(s.content).undefined
		s = replaceContent(body, { type: DisplayType.empty, content: undefined }, '')
		expect(s.content).undefined
	})

	it('replacing text with text', () => {
		const t = makeText('initial')
		body.appendChild(t)
		let s
		s = replaceContent(body, { type: DisplayType.text, content: t }, 'a')
		expect(body.innerHTML).equal('a')
		expect(s.content).equal(t)

		s = replaceContent(body, { type: DisplayType.text, content: t }, 'b')
		expect(body.innerHTML).equal('b')
		expect(s.content).equal(t)
	})

	it('replacing nontext with text', () => {
		const d = makeDiv()
		body.appendChild(d)
		const s = replaceContent(body, { type: DisplayType.node, content: d }, 'a')
		expect(body.innerHTML).equal('a')
		expect(s.content instanceof Text).true
	})

	const states = ([
		undefined, makeText(''),
		makeText('initial'),
		makeDiv(), makeDiv(''), makeDiv('initial'),
		[makeDiv('initial'), makeDiv()],
		[makeDiv('initial'), makeText('yo'), makeDiv()],
	] as (undefined | Node | NonLone<Node>)[])
		.map(intoContentState)

	for (const state of states)
		it(`replacing ${displayState(state)} with element`, () => {
			setupState(state)

			const d = makeDiv('hello')
			const s = replaceContent(body, state, d)
			expect(s.content).equal(d)
			expect(body.innerHTML).equal(divText('hello'))
		})

	for (const state of states)
		it(`replacing ${displayState(state)} with array`, () => {
			setupState(state)

			const s = replaceContent(body, state, [makeDiv('hello'), makeDiv('dude')])
			if (!Array.isArray(s.content)) throw new Error("bad outcoming state: " + displayState(s))
			expect(s.content.length).equal(2)
			expect(s.content.every(n => n instanceof HTMLDivElement)).true
			expect(body.innerHTML).equal(`${divText('hello')}${divText('dude')}`)
		})


	function displayState(state: ContentState): string {
		switch (state.type) {
		case DisplayType.empty: return 'empty'
		case DisplayType.text: return `text ${state.content.data}`
		case DisplayType.node: return `node ${(state.content as HTMLElement).outerHTML}`
		case DisplayType.many: return `array ${state.content.map(n => displayState(n as unknown as ContentState)).join(', ')}`
		}
	}

	for (const [displayable, html] of cases)
		for (const state of states)
			it(`replacing: ${displayState(state)} with: ${html}`, () => {
				setupState(state)

				replaceContent(body, state, displayable)
				expect(body.innerHTML).equal(html)
			})
})

describe('replaceRange', () => {
	it('replacing empty with nothing', () => {
		const placeholder = new Comment()
		body.appendChild(placeholder)

		replaceRange({ parent: undefined, type: DisplayType.empty, item: placeholder }, undefined)
		expect(body.innerHTML).equal('<!---->')
		expect(body.childNodes.length).equal(1)
		expect(body.firstChild).equal(placeholder)
	})

	it('replacing empty with single', () => {
		const placeholder = new Comment()
		body.appendChild(placeholder)

		replaceRange({ parent: undefined, type: DisplayType.empty, item: placeholder }, 'yoyo')
		expect(body.innerHTML).equal('yoyo')
		expect(body.childNodes.length).equal(1)
	})

	it('replacing empty with multiple', () => {
		const placeholder = new Comment()
		body.appendChild(placeholder)

		replaceRange({ parent: undefined, type: DisplayType.empty, item: placeholder }, [makeDiv('stuff'), makeText('dudes')])
		expect(body.innerHTML).equal(`${divText('stuff')}dudes`)
		expect(body.childNodes.length).equal(2)
	})

	it('replacing text with text', () => {
		const node = makeText('wassup')
		body.appendChild(node)

		replaceRange({ parent: undefined, type: DisplayType.text, item: node }, 'wassup dudes')
		expect(body.innerHTML).equal('wassup dudes')
		expect(body.firstChild).equal(node)
		expect(node.data).equal('wassup dudes')
	})

	it('replacing single with itself', () => {
		const d = makeDiv('stuff')
		body.appendChild(d)

		const r = d
		replaceRange({ parent: undefined, type: DisplayType.node, item: d }, r)
		expect(body.innerHTML).equal(divText('stuff'))
		expect(body.firstChild).equal(d)
	})

	const ranges: Range[] = [
		{ parent: undefined, type: DisplayType.empty, item: new Comment() },
		{ parent: undefined, type: DisplayType.node, item: makeText('') },
		{ parent: undefined, type: DisplayType.node, item: makeText('some text') },
		{ parent: undefined, type: DisplayType.node, item: makeDiv() },
		{ parent: undefined, type: DisplayType.node, item: makeDiv('') },
		{ parent: undefined, type: DisplayType.node, item: makeDiv('single node div') },
		{ parent: undefined, type: DisplayType.many, item: [makeText(''), makeText('other')] },
		{ parent: undefined, type: DisplayType.many, item: [makeText(''), makeDiv(), makeText('other')] },
		{ parent: undefined, type: DisplayType.many, item: [makeText('dudes'), makeDiv('something'), makeText('other')] },
	]

	function displayRange(range: Range) {
		const d = (n: Text | Element) => n instanceof Text ? n.data : n.outerHTML
		switch (range.type) {
		case DisplayType.empty: return 'empty'
		case DisplayType.text: return `text ${d(range.item)}`
		case DisplayType.node: return `single ${d(range.item as Element)}`
		case DisplayType.many: return `array ${range.item.map(n => d(n as Element)).join('')}`
		}
	}

	for (const [displayable, html] of cases)
		for (const range of ranges)
			it(`replacing ${displayRange(range)} with ${html}`, () => {
				body.appendChild(makeText('begin'))
				switch (range.type) {
					case DisplayType.many: appendAll(body, range.item); break
					default: body.appendChild(range.item); break
				}
				body.appendChild(makeText('end'))

				replaceRange(range, displayable)
				const baseHtml = html === '' ? '<!---->' : html
				expect(body.innerHTML).equal(`begin${baseHtml}end`)
			})
})

// describe('reconcileContent', () => {
// 	//
// })

describe('appendAll', () => {
	it('all text nodes', () => {
		const d = makeDiv()
		const r = appendAll(d, [makeText('a'), makeText('b')])
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
		const r = appendAll(d, [makeDiv('yo'), makeText('stuff'), makeDiv('dude')])
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
