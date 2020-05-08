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
	printNodes, printNodesArray, CodegenContext, resetParentIdents, generateComponentRenderFunction,
	generateTag, generateText, generateComponentInclusion, /*generateIfBlock,*/ generateTemplateDefinition, generateTemplateInclusion,
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
const [realParent, parent] = resetParentIdents()
const emptyDiv = () => Tag('div', [], [], [])

describe('generateComponentRenderFunction', () => {
	it('no argument component', () => {
		const generatedCode = generateComponentRenderFunction([], [], [], [], [], [emptyDiv()])
		boilEqual(generatedCode, `
			import { createElement as ___createElement, ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"

			const ___Component: ___ComponentDefinition<Component> = (___real, ___parent, {}, {}, {}, {}) => {
				___createElement(___parent, "div")
			}
			export default ___Component
		`)
	})

	it('all component args but no createFn', () => {
		const generatedCode = generateComponentRenderFunction(['p'], ['y'], ['e'], ['s'], [], [emptyDiv()])
		boilEqual(generatedCode, `
			import { createElement as ___createElement, ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"

			const ___Component: ___ComponentDefinition<Component> = (
				___real, ___parent,
				{ p }, { y }, { e }, { s }
			) => {
				___createElement(___parent, "div")
			}
			export default ___Component
		`)
	})

	it('only createFn', () => {
		const generatedCode = generateComponentRenderFunction([], [], [], [], ['a', 'b'], [emptyDiv()])
		boilEqual(generatedCode, `
			import { createElement as ___createElement, Args as ___Args, ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"

			const ___Component: ___ComponentDefinition<Component> = (___real, ___parent, {}, {}, {}, {}) => {
				const { a, b } = create(({} as ___Args<Component>))
				___createElement(___parent, "div")
			}
			export default ___Component
		`)
	})

	it('both component args and createFn', () => {
		const generatedCode = generateComponentRenderFunction(['p1', 'p2'], ['y1', 'y2'], ['e1', 'e2'], ['s1', 's2'], ['a', 'b'], [emptyDiv()])
		boilEqual(generatedCode, `
			import { createElement as ___createElement, Args as ___Args, ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"

			const ___Component: ___ComponentDefinition<Component> = (
				___real, ___parent,
				{ p1, p2 }, { y1, y2 }, { e1, e2 }, { s1, s2 }
			) => {
				const { a, b } = create(({ p1, p2, y1, y2, e1, e2 } as ___Args<Component>))
				___createElement(___parent, "div")
			}
			export default ___Component
		`)
	})
})


describe('generateComponentInclusion', () => {
	const cases: [string, ComponentInclusion, string][] = [
		['basic', ComponentInclusion('Comp', [], []), `
			import { EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],

		// props
		['prop empty', ComponentInclusion('Comp', [Attribute('on', undefined)], []), `
			import { fakeImmutable as ___fakeImmutable, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, { on: ___fakeImmutable(true) }, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],
		['prop static', ComponentInclusion('Comp', [Attribute('name', "dudes")], []), `
			import { fakeImmutable as ___fakeImmutable, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, { name: ___fakeImmutable("dudes") }, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],

		['prop dynamic bare', ComponentInclusion('Comp', [Attribute('p', AttributeCode(true, "yo"))], []), `
			import { fakeImmutable as ___fakeImmutable, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, { p: ___fakeImmutable(yo) }, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],
		['prop dynamic complex', ComponentInclusion('Comp', [Attribute('p', AttributeCode(false, " something.complex().s "))], []), `
			import { fakeImmutable as ___fakeImmutable, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, { p: ___fakeImmutable(something.complex().s) }, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],

		['prop dynamic initial bare', ComponentInclusion('Comp', [Attribute('p|initial', AttributeCode(true, "yo"))], []), `
			import { fakeInitial as ___fakeInitial, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, { p: ___fakeInitial(yo) }, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],
		['prop dynamic initial complex', ComponentInclusion('Comp', [Attribute('p|initial', AttributeCode(false, " something.complex().s "))], []), `
			import { fakeInitial as ___fakeInitial, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, { p: ___fakeInitial(something.complex().s) }, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],

		['prop reactive bare', ComponentInclusion('Comp', [Attribute(':p', AttributeCode(true, "yo"))], []), `
			import { EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, { p: yo }, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],
		['prop reactive complex', ComponentInclusion('Comp', [Attribute(':p', AttributeCode(false, " something.complex().s "))], []), `
			import { EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, { p: something.complex().s }, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],

		// syncs
		['sync bare', ComponentInclusion('Comp', [Attribute('!y', AttributeCode(true, "yo"))], []), `
			import { EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, { y: yo }, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],
		['sync complex', ComponentInclusion('Comp', [Attribute('!y', AttributeCode(false, " something.complex().s "))], []), `
			import { EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, { y: something.complex().s }, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],

		['sync fake bare', ComponentInclusion('Comp', [Attribute('!y|fake', AttributeCode(true, "yo"))], []), `
			import { fakeMutable as ___fakeMutable, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, { y: ___fakeMutable(yo) }, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],
		['sync fake complex', ComponentInclusion('Comp', [Attribute('!y|fake', AttributeCode(false, " something.complex().s "))], []), `
			import { fakeMutable as ___fakeMutable, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, { y: ___fakeMutable(something.complex().s) }, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],

		['sync setter bare', ComponentInclusion('Comp', [Attribute('!y|setter', AttributeCode(true, "yo"))], []), `
			import { setterMutable as ___setterMutable, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, { y: ___setterMutable(yo) }, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],
		['sync setter complex', ComponentInclusion('Comp', [Attribute('!y|setter', AttributeCode(false, " something.complex().s "))], []), `
			import { setterMutable as ___setterMutable, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, { y: ___setterMutable(something.complex().s) }, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],

		// events
		['event bare', ComponentInclusion('Comp', [Attribute('@e', AttributeCode(true, "yo"))], []), `
			import { EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, ___EMPTYOBJECT, { e: yo }, ___EMPTYOBJECT)
		`],
		['event complex', ComponentInclusion('Comp', [Attribute('@e', AttributeCode(false, " something.complex().s "))], []), `
			import { EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, ___EMPTYOBJECT, { e: () => something.complex().s }, ___EMPTYOBJECT)
		`],

		['event handler', ComponentInclusion('Comp', [Attribute('@e|handler', AttributeCode(false, " (a, b) => something(a).s += b "))], []), `
			import { EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, ___EMPTYOBJECT, { e: (a, b) => something(a).s += b }, ___EMPTYOBJECT)
		`],

		// slots
		['only orphaned entities (single)', ComponentInclusion('Comp', [], [
			Tag('div', [], [], []),
		]), `
			import { createElement as ___createElement, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT, {
				default: (___real, ___parent) => {
					___createElement(___parent, "div")
				}
			})
		`],

		['only orphaned entities (multiple)', ComponentInclusion('Comp', [], [
			Tag('h1', [], [], []),
			Tag('div', [], [], []),
		]), `
			import { createElement as ___createElement, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT, {
				default: (___real, ___parent) => {
					___createElement(___parent, "h1")
					___createElement(___parent, "div")
				}
			})
		`],

		['only explicit default (single)', ComponentInclusion('Comp', [], [
			SlotInsertion(undefined, 'a: string', [Tag('div', [], [], [])]),
		]), `
			import { createElement as ___createElement, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT, {
				default: (___real, ___parent, a: string) => {
					___createElement(___parent, "div")
				}
			})
		`],

		['only explicit default (multiple)', ComponentInclusion('Comp', [], [
			SlotInsertion(undefined, 'a: string', [
				Tag('h1', [], [], []),
				Tag('div', [], [], []),
			]),
		]), `
			import { createElement as ___createElement, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT, {
				default: (___real, ___parent, a: string) => {
					___createElement(___parent, "h1")
					___createElement(___parent, "div")
				}
			})
		`],

		['only explicit inserts', ComponentInclusion('Comp', [], [
			SlotInsertion('first', 'name?: string', [
				Tag('h1', [], [], []),
				Tag('div', [], [], []),
			]),
			SlotInsertion('second', 'a: string, b: boolean', [
				Tag('span', [], [], []),
			]),
		]), `
			import { createElement as ___createElement, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT, {
				first: (___real, ___parent, name?: string) => {
					___createElement(___parent, "h1")
					___createElement(___parent, "div")
				},
				second: (___real, ___parent, a: string, b: boolean) => {
					___createElement(___parent, "span")
				}
			})
		`],

		['mixed explicit inserts with orphaned', ComponentInclusion('Comp', [], [
			Tag('h1', [], [], []),
			SlotInsertion('second', 'a: string, b: boolean', [
				Tag('span', [], [], []),
			]),
			Tag('div', [], [], []),
		]), `
			import { createElement as ___createElement, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT, {
				second: (___real, ___parent, a: string, b: boolean) => {
					___createElement(___parent, "span")
				},
				default: (___real, ___parent) => {
					___createElement(___parent, "h1")
					___createElement(___parent, "div")
				}
			})
		`],

		['mixed explicit inserts with explicit default', ComponentInclusion('Comp', [], [
			SlotInsertion('first', 'name?: string', [
				Tag('h1', [], [], []),
			]),
			SlotInsertion(undefined, 'a: string', [
				Tag('h1', [], [], []),
				Tag('div', [], [], []),
			]),
			SlotInsertion('second', undefined, [
				Tag('span', [], [], []),
			]),
		]), `
			import { createElement as ___createElement, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT, {
				first: (___real, ___parent, name?: string) => {
					___createElement(___parent, "h1")
				},
				default: (___real, ___parent, a: string) => {
					___createElement(___parent, "h1")
					___createElement(___parent, "div")
				},
				second: (___real, ___parent) => {
					___createElement(___parent, "span")
				}
			})
		`],
	]

	for (const [description, inclusion, generated] of cases)
		it(description, () => {
			const context = ctx()
			const nodes = generateComponentInclusion(inclusion, context, realParent, parent)
			boilEqual(context.finalize(nodes), generated)
		})

	const throwCases: [string, ComponentInclusion][] = [
		['node receivers on components', ComponentInclusion('Comp', [
			Attribute('(fn)', AttributeCode(true, 'doit')),
		], [])],
		['sync, fake and setter together', ComponentInclusion('Comp', [
			Attribute('!y|fake|setter', AttributeCode(true, 'doit')),
		], [])],

		['duplicate event handlers on components', ComponentInclusion('Comp', [
			Attribute('@msg', AttributeCode(true, 'first')),
			Attribute('@msg', AttributeCode(true, 'second')),
		], [])],

		['mixing orphaned entities with an explicit default slot insert, throw', ComponentInclusion('Comp', [], [
			Tag('div', [], [], []),
			SlotInsertion(undefined, undefined, [Tag('h1', [], [], [])]),
		])],
	]

	for (const [description, inclusion] of throwCases)
		it(description, () => {
			expect(() => generateComponentInclusion(inclusion, ctx(), realParent, parent)).throw()
		})
})


describe('generateTag', () => {
	const cases: [string, Tag, string][] = [
		['div hello', Tag('div', [], [], [TextSection(TextItem(false, 'hello'))]), `
			import { createElement as ___createElement } from "project-f/runtime"

			const ___div0 = ___createElement(___parent, "div")
			___div0.textContent = "hello"
		`],

		['div: span hello', Tag('div', [], [], [Tag('span', [], [], [TextSection(TextItem(false, 'hello'))])]), `
			import { createElement as ___createElement } from "project-f/runtime"

			const ___div0 = ___createElement(___parent, "div")

			const ___span0_0 = ___createElement(___div0, "span")
			___span0_0.textContent = "hello"
		`],

		[`div: [span hello, div]`, Tag('div', [], [], [
			Tag('span', [], [], [TextSection(TextItem(false, 'hello'))]),
			Tag('div', [], [], []),
		]), `
			import { createElement as ___createElement } from "project-f/runtime"

			const ___div0 = ___createElement(___parent, "div")
			const ___div0fragment = document.createDocumentFragment()

			const ___span0_0 = ___createElement(___div0fragment, "span")
			___span0_0.textContent = "hello"

			___createElement(___div0fragment, "div")

			___div0.appendChild(___div0fragment)
		`],

		['#i.one.two(disabled=true, thing.children().stuff[0]="whatever", :visible={ env.immutable })', Tag(
			'div',
			[Meta(false, false, 'i'), Meta(true, false, 'one'), Meta(true, false, 'two')],
			[
				Attribute('disabled', AttributeCode(true, 'true')),
				Attribute('thing.children().stuff[0]', "whatever"),
				Attribute(':visible', AttributeCode(false, 'env.immutable')),
			], [],
		), `
			import { createElement as ___createElement, effect as ___effect } from "project-f/runtime"

			const ___div0 = ___createElement(___parent, "div")
			___div0.id = "i"
			___div0.className = "one two"
			___div0.disabled = true
			___div0.thing.children().stuff[0] = "whatever"
			___effect(() => {
			    ___div0.visible = env.immutable()
			})
		`],

		['div(@click=doit, @keyup={ mutable(1) }, @keydown|handler={ e => handle(e) })', Tag(
			'div', [],
			[
				Attribute('@click', AttributeCode(true, 'doit')),
				Attribute('@keyup', AttributeCode(false, ' mutable(1) ')),
				Attribute('@keydown|handler', AttributeCode(false, ' e => handle(e) ')),
			], [],
		), `
			import { createElement as ___createElement } from "project-f/runtime"

			const ___div0 = ___createElement(___parent, "div")
			___div0.onclick = doit
			___div0.onkeyup = $event => mutable(1)
			___div0.onkeydown = e => handle(e)
		`],

		['two handlers for the same event', Tag(
			'div', [],
			[
				Attribute('@click', AttributeCode(true, 'doit')),
				Attribute('@click', AttributeCode(false, ' mutable(1) ')),
			], [],
		), `
			import { createElement as ___createElement } from "project-f/runtime"

			const ___div0 = ___createElement(___parent, "div")
			___div0.onclick = $event => {
				(doit)($event)
				($event => mutable(1))($event)
			}
		`],

		['three handlers for the same event', Tag(
			'div', [],
			[
				Attribute('@click', AttributeCode(true, 'doit')),
				Attribute('@click', AttributeCode(false, ' mutable(1) ')),
				Attribute('@click|handler', AttributeCode(false, ' e => handle(e) ')),
			], [],
		), `
			import { createElement as ___createElement } from "project-f/runtime"

			const ___div0 = ___createElement(___parent, "div")
			___div0.onclick = $event => {
				(doit)($event)
				($event => mutable(1))($event)
				(e => handle(e))($event)
			}
		`],

		['node receivers', Tag(
			'div', [],
			[
				Attribute('(fn)', AttributeCode(true, 'doit')),
				Attribute('(fn)', AttributeCode(false, ' d => handle(d) ')),
			], [],
		), `
			import { createElement as ___createElement, nodeReceiver as ___nodeReceiver } from "project-f/runtime"

			const ___div0 = ___createElement(___parent, "div")
			___nodeReceiver(___div0, doit)
			___nodeReceiver(___div0,  d => handle(d) )
		`],
	]

	for (const [description, tag, generated] of cases)
		it(description, () => {
			const context = ctx()
			const nodes = generateTag(tag, '0', context, realParent, parent)
			boilEqual(context.finalize(nodes), generated)
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

	it('any modifiers on empty attribute', () => {
		expect(() => generateTag(Tag(
			'div', [],
			[Attribute('anything|whatever', undefined)], [],
		), '0', ctx(), realParent, parent)).throw()
	})

	it('any modifiers on static attribute', () => {
		expect(() => generateTag(Tag(
			'div', [],
			[Attribute('anything|whatever', "doesn't matter")], [],
		), '0', ctx(), realParent, parent)).throw()
	})

	it('any modifiers on reactive attribute', () => {
		expect(() => generateTag(Tag(
			'div', [],
			[Attribute(':anything|whatever', AttributeCode(true, 'doit'))], [],
		), '0', ctx(), realParent, parent)).throw()
	})

	it('any modifiers on node receiver', () => {
		expect(() => generateTag(Tag(
			'div', [],
			[Attribute('(fn)|whatever', AttributeCode(true, 'doit'))], [],
		), '0', ctx(), realParent, parent)).throw()
	})

	it('parentheses used as anything other than (fn)', () => {
		expect(() => generateTag(Tag(
			'div', [],
			[Attribute('(notfn)', AttributeCode(true, 'doit'))], [],
		), '0', ctx(), realParent, parent)).throw()
	})

	for (const [type, attribute] of [['reactive', ':a'], ['sync', '!a'], ['event', '@a'], ['receiver', '(fn)']]) {
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
	}

	for (const [type, attribute] of [['dynamic', 'a'], ['sync', '!a'], ['event', '@a']])
		it(`invalid modifier for ${type}`, () => {
			expect(() => generateTag(Tag(
				'div', [],
				[Attribute(attribute + '|invalidmodifier', AttributeCode(true, 'code'))], [],
			), '0', ctx(), realParent, parent)).throw()
		})
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

	for (const [lone, items, generated] of cases) {
		const context = ctx()
		const nodes = generateText(TextSection(...items), '0', lone, context, realParent, parent)
		const generatedCode = context.finalize(nodes)

		const itemsString = items.map(({ isCode, content }) => `(isCode: ${isCode}, ${content.replace(/\n/g, ' ')})`).join(', ')
		it(`lone: ${lone}, ${itemsString}`, () => boilEqual(generatedCode, generated))
	}
})


// describe('generateIfBlock', () => {
// 	const cases: [boolean, IfBlock, string][] = [
// 		// dynamic, one layer
// 		// @if (checked)
// 		[true, IfBlock('checked', [], undefined), `
// 			if (checked) {}
// 		`],
// 		[false, IfBlock(), `
// 			if (checked) {}
// 		`],
// 	]

// 	for (const [lone, block, generated] of cases) {
// 		const context = ctx()
// 		const nodes = generateIfBlock(block, '0', lone, context, realParent, parent)
// 		const generatedCode = context.finalize(nodes)

// 		const itemsString = items.map(({ isCode, content }) => `(isCode: ${isCode}, ${content.replace(/\n/g, ' ')})`).join(', ')
// 		it(`lone: ${lone}, ${itemsString}`, () => boilEqual(generatedCode, generated))
// 	}

// })



describe('generateTemplateDefinition', () => {
	const cases: [string | undefined, string][] = [
		[undefined, 'no arguments'],
		['a: string', 'one argument'],
		['a: string, b: number', 'two arguments'],
		['a?: string, b: number | stuff, ...args: NonEmpty<stuff<T>>', 'complex arguments'],
	]

	for (const [expression, description] of cases)
		it(description, () => {
			const context = ctx()
			const nodes = generateTemplateDefinition(
				TemplateDefinition('greeting', expression, [TextSection(TextItem(false, 'hello'))]),
				context,
			)
			boilEqual(context.finalize(nodes), `
				import { createTextNode as ___createTextNode } from "project-f/runtime"

				function greeting(___real: Node, ___parent: Node${expression !== undefined ? ', ' + expression : ''}) {
					___createTextNode(___parent, "hello")
				}
			`)
		})
})

describe('generateTemplateInclusion', () => {
	const cases: [string | undefined, string][] = [
		[undefined, 'no args'],
		['a', 'one arg'],
		['a, b', 'two args'],
		[`a | '', b.concat(things), ...rest`, 'complex args'],
	]

	for (const [expression, description] of cases)
		it(description, () => {
			const context = ctx()
			const nodes = generateTemplateInclusion(TemplateInclusion('greeting', expression), realParent, parent)
			boilEqual(context.finalize(nodes), `greeting(___real, ___parent${expression !== undefined ? ', ' + expression : ''})`)
		})
})
