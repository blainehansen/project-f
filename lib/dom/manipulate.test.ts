import 'mocha'
import fc from 'fast-check'
import { expect } from 'chai'
import { Command } from '../utils.test'

import { NonLone, tuple as t } from '../utils'
import { makeDocumentFragment, createElement, createTextNode } from './nodes'
import {
	clearContent, DisplayType,
	replaceContent, ContentState, Content,
	replaceRange, RangeState, Range,
} from './manipulate'

const body = document.body
beforeEach(() => {
	body.textContent = ''
})

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

// function intoContentState(content: undefined | string | Node | NonLone<Node>): ContentState {
// 	return content === undefined ? { type: DisplayType.empty, content }
// 		: Array.isArray(content) ? { type: DisplayType.many, content }
// 		: typeof content === 'string' ? { type: DisplayType.text, content: makeText(content) }
// 		: content.nodeType === Node.TEXT_NODE ? { type: DisplayType.text, content: content as Text }
// 		: { type: DisplayType.node, content }
// }
// function intoNodeArray(state: ContentState) {
// 	switch (state.type) {
// 	case DisplayType.empty: return []
// 	case DisplayType.many: return state.content
// 	default: return [state.content]
// 	}
// }
// function setupState(state: ContentState) {
// 	for (const item of intoNodeArray(state))
// 		body.appendChild(item)
// }

// const cases: [Displayable, string][] = [
// 	[null, ''],
// 	[undefined, ''],
// 	[[], ''],
// 	['', ''],
// 	['yoyo', 'yoyo'],

// 	[makeDiv(), divText()],
// 	[[makeDiv()], divText()],
// 	[makeDiv('stuff'), divText('stuff')],
// 	[[makeDiv('stuff')], divText('stuff')],

// 	[[makeDiv(), makeDiv()], `${divText()}${divText()}`],
// 	[[makeDiv('something'), makeDiv(), makeDiv()], `${divText('something')}${divText()}${divText()}`],
// 	[[makeDiv('something'), makeDiv(), makeText('a'), makeText('b'), makeDiv()], `${divText('something')}${divText()}ab${divText()}`],
// ]


const DomTree: fc.Memo<DocumentFragment> = fc.memo(n => {
	return fc.array(fc.oneof(DomNode(n), DomLeaf())).map(makeDocumentFragment)
})
const DomNode: fc.Memo<Node> = fc.memo(n => {
	if (n <= 1) return DomLeaf()
	return DomTree().map(f => {
		const tag: Node = document.createElement('div')
		tag.appendChild(f)
		return tag
	})
})
const DomLeaf: fc.Memo<Text> = fc.memo(() => {
	return fc.string().filter(s => s !== '').map(s => makeText(s))
})


describe('theorems', () => {
	it('for any tree, `replaceContent` is correct', function() {
		this.timeout(0)

		const ContentContext = () => {
			body.textContent = ''
			const content = new Content(body, DisplayType.empty)
			return { content, original: content }
		}
		type ContentContext = ReturnType<typeof ContentContext>
		const ContentModel = () => ({ html: '', current: DisplayType.empty as ContentState })
		type ContentModel = ReturnType<typeof ContentModel>

		function escapeHtml(text: string) {
			const p = document.createElement('p')
			p.textContent = text
			return p.innerHTML
		}

		function htmlOfFragment(fragment: DocumentFragment) {
			return ([...fragment.childNodes] as (HTMLElement | Text)[])
				.map(n => n instanceof Text ? escapeHtml(n.data) : n.outerHTML).join('')
		}
		function updateContentModel(model: ContentModel, fragment: DocumentFragment) {
			model.html = htmlOfFragment(fragment)
			switch (fragment.childNodes.length) {
				case 0: model.current = DisplayType.empty; break
				case 1: model.current = fragment.childNodes[0]; break
				default: model.current = DisplayType.many; break
			}
		}

		const replaceContentCommands = [
			DomTree(5).map(f => Command<ContentModel, ContentContext>(() => 'ReplaceContentCommand', () => true, (model, ctx) => {
				const previous = ctx.content.current
				const previousWasText = previous instanceof Text

				updateContentModel(model, f)
				ctx.content = replaceContent(ctx.content, f)

				expect(ctx.content).equal(ctx.original)
				expect(body.innerHTML).equal(model.html)
				const currentIsText = model.current instanceof Text
				if (previousWasText && currentIsText)
					expect(ctx.content.current).equal(previous)
				else if (currentIsText)
					expect(ctx.content.current).instanceof(Text)
				else
					expect(ctx.content.current).equal(model.current)
			})),
		]

		fc.assert(fc.property(fc.commands(replaceContentCommands, { maxCommands: 6, /*replayPath: "BAB:F"*/ }), cmds => {
			fc.modelRun(() => ({ model: ContentModel(), real: ContentContext() }), cmds)
		})/*, { seed: 1339403506, path: "34:1:1", endOnFailure: true }*/)
	})
})

describe('just replaceContent', () => {
	it('replacing nothing with nothing', () => {
		const original = new Content(body, DisplayType.empty)
		let s = original
		s = replaceContent(s, document.createDocumentFragment())
		expect(s).equal(original)
		expect(s.current).equal(DisplayType.empty)
	})

	it('replacing text with text', () => {
		const t = makeText('initial')
		body.appendChild(t)
		const original = new Content(body, t)
		let s = original
		s = replaceContent(s, makeDocumentFragment([makeText('a')]))
		expect(body.innerHTML).equal('a')
		expect(s.current).equal(t)

		s = replaceContent(s, makeDocumentFragment([makeText('b')]))
		expect(body.innerHTML).equal('b')
		expect(s.current).equal(t)
	})

	it('replacing node with itself', () => {
		const n = makeDiv('a')
		body.appendChild(n)
		expect(body.innerHTML).equal(divText('a'))
		const original = new Content(body, n)
		let s = original
		s = replaceContent(s, makeDocumentFragment([n]))
		expect(body.innerHTML).equal(divText('a'))
		expect(s.current).equal(n)
	})
})

describe('just replaceRange', () => {
	function emptyRange() {
		createElement(body, 'div')
		const placeholder = new Comment()
		body.appendChild(placeholder)
		createElement(body, 'div')
		expect(body.innerHTML).equal(`${divText()}<!---->${divText()}`)
		return t(placeholder, new Range(body, body, { type: DisplayType.empty, item: placeholder }))
	}

	it('replacing empty with nothing', () => {
		const [placeholder, original] = emptyRange()
		const s = replaceRange(original, makeDocumentFragment([]))
		expect(s).equal(original)
		expect(body.innerHTML).equal(`${divText()}<!---->${divText()}`)
		expect(body.childNodes.length).equal(3)
		expect(body.childNodes[1]).equal(placeholder)
	})

	it('replacing empty with single', () => {
		const [placeholder, original] = emptyRange()
		const s = replaceRange(original, makeDocumentFragment([makeText('yoyo')]))
		expect(s).equal(original)
		expect(body.innerHTML).equal(`${divText()}yoyo${divText()}`)
		expect(body.childNodes.length).equal(3)
	})

	it('replacing text with text', () => {
		createElement(body, 'div')
		const node = makeText('wassup')
		body.appendChild(node)
		createElement(body, 'div')

		const original = new Range(body, body, { type: DisplayType.node, item: node })
		const s = replaceRange(original, makeDocumentFragment([makeText('wassup dudes')]))
		expect(s).equal(original)
		expect(original.current.item).equal(node)
		expect(body.innerHTML).equal(`${divText()}wassup dudes${divText()}`)
		expect(body.childNodes[1]).equal(node)
		expect(node.data).equal('wassup dudes')
	})

	it('replacing single with itself', () => {
		createElement(body, 'div')
		const d = makeDiv('stuff')
		body.appendChild(d)
		createElement(body, 'div')

		const original = new Range(body, body, { type: DisplayType.node, item: d })
		const s = replaceRange(original, makeDocumentFragment([d]))
		expect(body.innerHTML).equal(divText() + divText('stuff') + divText())
		expect(body.childNodes[1]).equal(d)
	})

	// const ranges: Range[] = [
	// 	{ parent: undefined, type: DisplayType.empty, item: new Comment() },
	// 	{ parent: undefined, type: DisplayType.node, item: makeText('') },
	// 	{ parent: undefined, type: DisplayType.node, item: makeText('some text') },
	// 	{ parent: undefined, type: DisplayType.node, item: makeDiv() },
	// 	{ parent: undefined, type: DisplayType.node, item: makeDiv('') },
	// 	{ parent: undefined, type: DisplayType.node, item: makeDiv('single node div') },
	// 	{ parent: undefined, type: DisplayType.many, item: [makeText(''), makeText('other')] },
	// 	{ parent: undefined, type: DisplayType.many, item: [makeText(''), makeDiv(), makeText('other')] },
	// 	{ parent: undefined, type: DisplayType.many, item: [makeText('dudes'), makeDiv('something'), makeText('other')] },
	// ]

	// function displayRange(range: Range) {
	// 	const d = (n: Text | Element) => n instanceof Text ? n.data : n.outerHTML
	// 	switch (range.type) {
	// 	case DisplayType.empty: return 'empty'
	// 	case DisplayType.text: return `text ${d(range.item)}`
	// 	case DisplayType.node: return `single ${d(range.item as Element)}`
	// 	case DisplayType.many: return `array ${range.item.map(n => d(n as Element)).join('')}`
	// 	}
	// }

	// for (const [displayable, html] of cases)
	// 	for (const range of ranges)
	// 		it(`replacing ${displayRange(range)} with ${html}`, () => {
	// 			body.appendChild(makeText('begin'))
	// 			switch (range.type) {
	// 				case DisplayType.many: appendAll(body, range.item); break
	// 				default: body.appendChild(range.item); break
	// 			}
	// 			body.appendChild(makeText('end'))

	// 			replaceRange(range, displayable)
	// 			const baseHtml = html === '' ? '<!---->' : html
	// 			expect(body.innerHTML).equal(`begin${baseHtml}end`)
	// 		})
})

// describe('reconcileContent', () => {
// 	//
// })

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
