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

function escapeHtml(text: string) {
	const p = document.createElement('p')
	p.textContent = text
	return p.innerHTML
}

function htmlOfFragment(fragment: DocumentFragment) {
	return ([...fragment.childNodes] as (HTMLElement | Text)[])
		.map(n => n instanceof Text ? escapeHtml(n.data) : n.outerHTML).join('')
}


// const DomTree: fc.Memo<DocumentFragment> = fc.memo(n => {
// 	return fc.array(fc.oneof(DomNode(n), DomLeaf())).map(makeDocumentFragment)
// })
// const DomNode: fc.Memo<Node> = fc.memo(n => {
// 	if (n <= 1) return DomLeaf()
// 	return DomTree().map(f => {
// 		const tag: Node = document.createElement('div')
// 		tag.appendChild(f)
// 		return tag
// 	})
// })
// const DomLeaf: fc.Memo<Text> = fc.memo(() => {
// 	return fc.string().filter(s => s !== '').map(s => makeText(s))
// })

function RandText() {
	return fc.string().filter(s => s !== '').map(s => makeText(s))
}
function RandDiv() {
	return fc.constant(undefined).map(() => document.createElement('div'))
}

function RandFragment() {
	return fc.oneof(
		fc.constant([]).map(makeDocumentFragment),
		RandText().map(n => makeDocumentFragment([n])),
		RandDiv().map(n => makeDocumentFragment([n])),
		fc.array(fc.oneof(RandText(), RandDiv()), 2, 6).map(makeDocumentFragment),
	)
}

// for (const fragment of fc.sample(RandFragment(), 20)) {
// 	console.log('fragment:')
// 	for (const node of (fragment.childNodes as any as (HTMLElement | Text)[]))
// 		console.log(node instanceof Text ? node.data : node.outerHTML)
// 	console.log()
// }


describe('theorems', () => {
	it('for any RandFragment, replaceContent is correct', function() {
		this.timeout(0)

		const ContentContext = () => {
			body.textContent = ''
			const content = new Content(body, DisplayType.empty)
			return { content, original: content }
		}
		type ContentContext = ReturnType<typeof ContentContext>
		const ContentModel = () => ({ html: '', current: DisplayType.empty as ContentState })
		type ContentModel = ReturnType<typeof ContentModel>
		function updateContentModel(model: ContentModel, fragment: DocumentFragment) {
			model.html = htmlOfFragment(fragment)
			switch (fragment.childNodes.length) {
				case 0: model.current = DisplayType.empty; break
				case 1: model.current = fragment.childNodes[0]; break
				default: model.current = DisplayType.many; break
			}
		}

		const replaceContentCommands = [
			RandFragment().map(f => Command<ContentModel, ContentContext>(() => 'ReplaceContentCommand', () => true, (model, ctx) => {
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

		fc.assert(fc.property(fc.commands(replaceContentCommands, { maxCommands: 1000, /*replayPath: "BAB:F"*/ }), cmds => {
			fc.modelRun(() => ({ model: ContentModel(), real: ContentContext() }), cmds)
		})/*, { seed: 1339403506, path: "34:1:1", endOnFailure: true }*/)
	})

	it('for any RandFragment, replaceRange is correct', function() {
		this.timeout(0)

		const RangeContext = () => {
			body.textContent = ''
			const endAnchor = basicRange()
			const range = new Range(endAnchor, body, body, { type: DisplayType.empty })
			return { range, original: range }
		}
		type RangeContext = ReturnType<typeof RangeContext>
		const RangeModel = () => ({ html: '', type: DisplayType.empty })
		type RangeModel = ReturnType<typeof RangeModel>
		function updateRangeModel(model: RangeModel, fragment: DocumentFragment) {
			model.html = htmlOfFragment(fragment)
			switch (fragment.childNodes.length) {
				case 0: model.type = DisplayType.empty; break
				case 1: model.type = fragment.childNodes[0] instanceof Text ? DisplayType.text : DisplayType.node; break
				default: model.type = DisplayType.many; break
			}
			return fragment.childNodes.length
		}

		const replaceRangeCommands = [
			RandFragment().map(f => Command<RangeModel, RangeContext>(() => 'ReplaceRangeCommand', () => true, (model, ctx) => {
				const nodesLength = updateRangeModel(model, f)
				ctx.range = replaceRange(ctx.range, f)

				expect(ctx.range).equal(ctx.original)
				expectRange(model.html)
				expect(ctx.range.current.type).equal(model.type)
				switch (model.type) {
					case DisplayType.empty:
						expect((ctx.range.current as any).item).undefined
						break
					case DisplayType.text:
						expect((ctx.range.current as any).item).equal(body.childNodes[1])
						expect(body.childNodes[1]).instanceof(Text)
						break
					case DisplayType.node:
						expect((ctx.range.current as any).item).equal(body.childNodes[1])
						expect(body.childNodes[1]).not.instanceof(Text)
						break
					case DisplayType.many:
						expect((ctx.range.current as any).item).equal(body.childNodes[1])
						break
				}
			})),
		]

		fc.assert(fc.property(fc.commands(replaceRangeCommands, { maxCommands: 1000, /*replayPath: "BAB:F"*/ }), cmds => {
			fc.modelRun(() => ({ model: RangeModel(), real: RangeContext() }), cmds)
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

function basicRange(...nodes: Node[]) {
	createElement(body, 'div')
	for (const node of nodes)
		body.appendChild(node)
	const endAnchor = new Comment()
	body.appendChild(endAnchor)
	createElement(body, 'div')
	return endAnchor
}
function expectRange(...nodes: string[]) {
	expect(body.innerHTML).equal(`${divText()}${nodes.join('')}<!---->${divText()}`)
}

describe('just replaceRange', () => {
	it('replacing empty with nothing', () => {
		const endAnchor = basicRange()
		const original = new Range(endAnchor, body, body, { type: DisplayType.empty })
		const s = replaceRange(original, makeDocumentFragment([]))
		expect(s).equal(original)
		expectRange()
		expect(body.childNodes.length).equal(3)
		expect(body.childNodes[1]).equal(endAnchor)
	})

	it('replacing empty with single', () => {
		const endAnchor = basicRange()
		const original = new Range(endAnchor, body, body, { type: DisplayType.empty })
		const s = replaceRange(original, makeDocumentFragment([makeText('yoyo')]))
		expect(s).equal(original)
		expectRange('yoyo')
		expect(body.childNodes.length).equal(4)
	})

	it('replacing text with text', () => {
		const text = makeText('wassup')
		const endAnchor = basicRange(text)
		const original = new Range(endAnchor, body, body, { type: DisplayType.text, item: text })
		const s = replaceRange(original, makeDocumentFragment([makeText('wassup dudes')]))
		expect(s).equal(original)
		expect((original.current as any).item).equal(text)
		expectRange('wassup dudes')
		expect(body.childNodes[1]).equal(text)
		expect(text.data).equal('wassup dudes')
	})

	it('replacing single with itself', () => {
		const d = makeDiv('stuff')
		const endAnchor = basicRange(d)
		const original = new Range(endAnchor, body, body, { type: DisplayType.node, item: d })
		const s = replaceRange(original, makeDocumentFragment([d]))
		expectRange(divText('stuff'))
		expect(body.childNodes[1]).equal(d)
	})
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
