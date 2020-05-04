import 'mocha'
import { expect } from 'chai'

import { NonEmpty } from '../utils'
import { boilString } from '../utils.spec'
import {
	Entity, Directive,
	ComponentDefinition, Tag, Meta, Attribute, AttributeCode, TextSection, TextItem,
	ComponentInclusion, IfBlock, EachBlock, MatchBlock, MatchPattern, SwitchBlock, SwitchCase, SwitchDefault,
	SlotDefinition, SlotInsertion, TemplateDefinition, TemplateInclusion,
} from './ast.spec'
import {
	BindingType, LivenessType,
	printNodes, printNodesArray, CodegenContext, parentIdents,
	generateComponentRenderFunction, generateTag, generateText,
} from './codegen'

// function b(node: Parameters<typeof printNode>[0]) {
// 	return expect(boilString(printNode(node)))
// }
function boilEqual(actual: string, expected: string) {
	expect(boilString(actual)).equal(boilString(expected))
}
type ctx = CodegenContext
function ctx() {
	return new CodegenContext()
}
const [realParent, parent] = parentIdents()

describe('generateComponentRenderFunction', () => {
	// div hello
	it('no argument component, simple div with text', () => {
		const generatedCode = generateComponentRenderFunction([], [], [], [], [], [
			Tag('div', [], [], [
				TextSection(TextItem(false, 'hello')),
			]),
		])

		boilEqual(generatedCode, `
			import { createElement as ___createElement, ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"

			const ___Component: ___ComponentDefinition<Component> = (___real, ___parent, {}, {}, {}, {}) => {
				const ___div0 = ___createElement(___parent, "div")
				___div0.textContent = "hello"
			}
			export default ___Component
		`)
	})

	// div: span hello
	it('no argument component, div with single span with text', () => {
		const generatedCode = generateComponentRenderFunction([], [], [], [], [], [
			Tag('div', [], [], [
				Tag('span', [], [], [TextSection(TextItem(false, 'hello'))]),
			]),
		])

		boilEqual(generatedCode, `
			import { createElement as ___createElement, ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"

			const ___Component: ___ComponentDefinition<Component> = (___real, ___parent, {}, {}, {}, {}) => {
				const ___div0 = ___createElement(___parent, "div")

				const ___span0_0 = ___createElement(___div0, "span")
				___span0_0.textContent = "hello"
			}
			export default ___Component
		`)
	})

	// div
	// 	span hello
	// 	div
	it('no argument component, div with two children', () => {
		const generatedCode = generateComponentRenderFunction([], [], [], [], [], [
			Tag('div', [], [], [
				Tag('span', [], [], [TextSection(TextItem(false, 'hello'))]),
				Tag('div', [], [], []),
			]),
		])

		boilEqual(generatedCode, `
			import { createElement as ___createElement, ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"

			const ___Component: ___ComponentDefinition<Component> = (___real, ___parent, {}, {}, {}, {}) => {
				const ___div0 = ___createElement(___parent, "div")
				const ___div0fragment = document.createDocumentFragment()

				const ___span0_0 = ___createElement(___div0fragment, "span")
				___span0_0.textContent = "hello"

				___createElement(___div0fragment, "div")

				___div0.appendChild(___div0fragment)
			}
			export default ___Component
		`)
	})
})

describe('generateTag', () => {
	it('#i.one.two(disabled=true, thing="whatever", :visible={ env.immutable })', () => {
		const context = ctx()
		const nodes = generateTag(Tag(
			'div',
			[Meta(false, false, 'i'), Meta(true, false, 'one'), Meta(true, false, 'two')],
			[
				Attribute('disabled', AttributeCode(true, 'true')),
				Attribute('thing.children().stuff[0]', "whatever"),
				Attribute(':visible', AttributeCode(false, 'env.immutable')),
			], [],
		), '0', context, realParent, parent)
		const generatedCode = context.finalize(nodes)

		boilEqual(generatedCode, `
			import { createElement as ___createElement, effect as ___effect } from "project-f/runtime"

			const ___div0 = ___createElement(___parent, "div")
			___div0.id = "i"
			___div0.className = "one two"
			___div0.disabled = true
			___div0.thing.children().stuff[0] = "whatever"
			___effect(() => {
			    ___div0.visible = env.immutable()
			})
		`)
	})

	it('div(@click=doit, @keyup={ mutable(1) }, @keydown|handler={ e => handle(e) })', () => {
		const context = ctx()
		const nodes = generateTag(Tag(
			'div', [],
			[
				Attribute('@click', AttributeCode(true, 'doit')),
				Attribute('@keyup', AttributeCode(false, ' mutable(1) ')),
				Attribute('@keydown|handler', AttributeCode(false, ' e => handle(e) ')),
			], [],
		), '0', context, realParent, parent)
		const generatedCode = context.finalize(nodes)

		boilEqual(generatedCode, `
			import { createElement as ___createElement } from "project-f/runtime"

			const ___div0 = ___createElement(___parent, "div")
			___div0.onclick = doit
			___div0.onkeyup = $event => mutable(1)
			___div0.onkeydown = e => handle(e)
		`)
	})

	it('two handlers for the same event', () => {
		const context = ctx()
		const nodes = generateTag(Tag(
			'div', [],
			[
				Attribute('@click', AttributeCode(true, 'doit')),
				Attribute('@click', AttributeCode(false, ' mutable(1) ')),
			], [],
		), '0', context, realParent, parent)
		const generatedCode = context.finalize(nodes)

		boilEqual(generatedCode, `
			import { createElement as ___createElement } from "project-f/runtime"

			const ___div0 = ___createElement(___parent, "div")
			___div0.onclick = $event => {
				(doit)($event)
				($event => mutable(1))($event)
			}
		`)
	})

	it('three handlers for the same event', () => {
		const context = ctx()
		const nodes = generateTag(Tag(
			'div', [],
			[
				Attribute('@click', AttributeCode(true, 'doit')),
				Attribute('@click', AttributeCode(false, ' mutable(1) ')),
				Attribute('@click|handler', AttributeCode(false, ' e => handle(e) ')),
			], [],
		), '0', context, realParent, parent)
		const generatedCode = context.finalize(nodes)

		boilEqual(generatedCode, `
			import { createElement as ___createElement } from "project-f/runtime"

			const ___div0 = ___createElement(___parent, "div")
			___div0.onclick = $event => {
				(doit)($event)
				($event => mutable(1))($event)
				(e => handle(e))($event)
			}
		`)
	})

	it('node receivers', () => {
		const context = ctx()
		const nodes = generateTag(Tag(
			'div', [],
			[
				Attribute('&fn', AttributeCode(true, 'doit')),
				Attribute('&fn', AttributeCode(false, ' d => handle(d) ')),
			], [],
		), '0', context, realParent, parent)
		const generatedCode = context.finalize(nodes)

		boilEqual(generatedCode, `
			import { createElement as ___createElement, nodeReceiver as ___nodeReceiver } from "project-f/runtime"

			const ___div0 = ___createElement(___parent, "div")
			___nodeReceiver(___div0, doit)
			___nodeReceiver(___div0,  d => handle(d) )
		`)
	})

	it('sync on non-input tag', () => {
		for (const attribute of ['!anything', '!sync', '!sync|fake'])
			expect(() => generateTag(Tag(
				'div', [],
				[Attribute(attribute, AttributeCode(true, 'doit'))], [],
			), '0', ctx(), realParent, parent)).throw()
	})

	it('handler event modifier with bare code', () => {
		expect(() => generateTag(Tag(
			'div', [],
			[Attribute('@click|handler', AttributeCode(true, 'doit'))], [],
		), '0', ctx(), realParent, parent)).throw()
	})

	it('any modifiers on normal attribute', () => {
		expect(() => generateTag(Tag(
			'div', [],
			[Attribute('anything|whatever', "doesn't matter")], [],
		), '0', ctx(), realParent, parent)).throw()
	})

	it('& used as anything other than &fn', () => {
		expect(() => generateTag(Tag(
			'div', [],
			[Attribute('&notfn', AttributeCode(true, 'doit'))], [],
		), '0', ctx(), realParent, parent)).throw()
	})

	for (const [type, attribute] of [['reactive', ':a'], ['sync', '!a'], ['event', '@a'], ['receiver', '&fn']]) {
		it(`empty for ${type}`, () => {
			expect(() => generateTag(Tag(
				'div', [],
				[Attribute(attribute, undefined)], [],
			), '0', ctx(), realParent, parent)).throw()
		})

		it(`static for ${type}`, () => {
			expect(() => generateTag(Tag(
				'div', [],
				[Attribute(attribute, "something static")], [],
			), '0', ctx(), realParent, parent)).throw()
		})

		it(`invalid modifier for ${type}`, () => {
			expect(() => generateTag(Tag(
				'div', [],
				[Attribute(attribute + '|invalidmodifier', AttributeCode(true, 'code'))], [],
			), '0', ctx(), realParent, parent)).throw()
		})
	}
})


describe('generateText', () => {
	const cases: [boolean, NonEmpty<TextItem>, string][] = [
		// static
		[true, [TextItem(false, 'hello')], `
			___real.textContent = "hello"
		`],
		[false, [TextItem(false, 'hello')], `
			import { createTextNode as ___createTextNode } from "project-f/runtime"
			___createTextNode(___parent, "hello")
		`],

		[true, [TextItem(false, 'hello "every ')], `
			___real.textContent = "hello \\"every "
		`],
		[false, [TextItem(false, 'hello "every ')], `
			import { createTextNode as ___createTextNode } from "project-f/runtime"
			___createTextNode(___parent, "hello \\"every ")
		`],

		[true, [TextItem(false, 'hello'), TextItem(false, '\n'), TextItem(false, 'world')], `
			___real.textContent = "hello\\nworld"
		`],
		[false, [TextItem(false, 'hello'), TextItem(false, '\n'), TextItem(false, 'world')], `
			import { createTextNode as ___createTextNode } from "project-f/runtime"
			___createTextNode(___parent, "hello\\nworld")
		`],

		// dynamic simple
		[true, [TextItem(true, ' hello ')], `
			___real.textContent = hello
		`],
		[false, [TextItem(true, ' hello ')], `
			import { createTextNode as ___createTextNode } from "project-f/runtime"
			___createTextNode(___parent, hello)
		`],

		// dynamic complex
		[true, [TextItem(true, ' hello.world().display ')], `
			___real.textContent = hello.world().display
		`],
		[false, [TextItem(true, ' hello.world().display ')], `
			import { createTextNode as ___createTextNode } from "project-f/runtime"
			___createTextNode(___parent, hello.world().display)
		`],

		// reactive simple
		[true, [TextItem(true, ': hello ')], `
			import { effect as ___effect } from "project-f/runtime"
			___effect(() => {
				___real.textContent = hello()
			})
		`],
		[false, [TextItem(true, ': hello ')], `
			import { createTextNode as ___createTextNode, effect as ___effect } from "project-f/runtime"

			const ___text0 = ___createTextNode(___parent, "")
			___effect(() => {
				___text0.data = hello()
			})
		`],

		// mixed, strongest dynamic
		[true, [TextItem(false, 'hello '), TextItem(true, 'world'), TextItem(false, '!')], `
			___real.textContent = \`hello \${ world }!\`
		`],
		[false, [TextItem(false, 'hello '), TextItem(true, ' world '), TextItem(false, '!')], `
			import { createTextNode as ___createTextNode } from "project-f/runtime"
			___createTextNode(___parent, \`hello \${world}!\`)
		`],

		// mixed, strongest reactive
		[true, [TextItem(false, 'hello '), TextItem(true, ' count '), TextItem(true, ': world '), TextItem(false, '!')], `
			import { effect as ___effect } from "project-f/runtime"

			___effect(() => {
				___real.textContent = \`hello \${count}\${ world() }!\`
			})
		`],
		[false, [TextItem(false, 'hello '), TextItem(true, 'count'), TextItem(true, ': world '), TextItem(false, '!')], `
			import { createTextNode as ___createTextNode, effect as ___effect } from "project-f/runtime"

			const ___text0 = ___createTextNode(___parent, "")
			___effect(() => {
				___text0.data = \`hello \${count}\${ world() }!\`
			})
		`],
	]

	for (const [isRealLone, items, generated] of cases) {
		const context = ctx()
		const nodes = generateText(TextSection(...items), '0', isRealLone, context, realParent, parent)
		const generatedCode = context.finalize(nodes)

		const itemsString = items.map(({ isCode, content }) => `(isCode: ${isCode}, ${content.replace(/\n/g, ' ')})`).join(', ')
		it(`lone: ${isRealLone}, ${itemsString}`, () => boilEqual(generatedCode, generated))
	}
})
