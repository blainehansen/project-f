import 'mocha'
import { expect } from 'chai'
import ts = require('typescript')

import { boilEqual } from '../utils.test'
import { Dict, tuple as t, NonEmpty, NonLone } from '../utils'
import {
	ComponentDefinition, ComponentTypes, CTXFN, Entity, Html, Tag, TagAttributes, LivenessType, LiveCode, AssignedLiveCode,
	IdMeta, ClassMeta, AttributeCode, TextSection, TextItem,
	BindingAttribute, BindingValue, ExistentBindingValue, InertBindingValue, EventAttribute, ReceiverAttribute, /*RefAttribute,*/ Attribute,
	SyncedTextInput, SyncedCheckboxInput, SyncedRadioInput, SyncedSelect, SyncModifier, SyncAttribute,
	Directive, ComponentInclusion, IfBlock, /*ForBlock,*/ EachBlock, MatchBlock, SwitchBlock, SwitchCase, SwitchDefault,
	SlotUsage, SlotInsertion, TemplateDefinition, TemplateInclusion,
} from './ast.test'
import {
	CodegenContext,
	generateComponentDefinition, generateEntities, generateEntity, generateTagFromAttributes, generateTag,
	generateSyncedTextInput, generateSyncedCheckboxInput, generateSyncedRadioInput, generateSyncedSelect,
	generateText, generateSlotUsage, generateComponentInclusion,
	generateIfBlock, generateEachBlock, generateMatchBlock, generateSwitchBlock, generateTemplateDefinition, generateTemplateInclusion,
	printNodes, printNodesArray,
} from './codegen'


type ctx = CodegenContext
function ctx() {
	return new CodegenContext({})
}

export const realParent = ts.createIdentifier('___real')
export const parent = ts.createIdentifier('___parent')
const namedParentIdents = (real: string, parent: string) => t(ts.createIdentifier(`___${real}`), ts.createIdentifier(`___${parent}`))

const empty = (tagName: string) => Tag(tagName, TagAttributes(undefined, [], {}, {}, []), [])
const emptyDiv = () => empty('div')
const emptyH1 = () => empty('h1')
const emptyEm = () => empty('em')
const emptySpan = () => empty('span')
const emptyStrong = () => empty('strong')

describe('generateComponentDefinition', () => {
	const cases: [string, ComponentDefinition, string][] = [
	['nonexistent component', ComponentDefinition(undefined, undefined, [emptyDiv()]), `
			import { createElement as ___createElement, ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"

			const ___Component: ___ComponentDefinition<{}> = (___real, ___parent, {}, {}, {}, {}) => {
				___createElement(___parent, "div")
			}
			export default ___Component
		`],

		['no argument component', ComponentDefinition(ComponentTypes([], [], [], {}), undefined, [emptyDiv()]), `
			import { createElement as ___createElement, ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"

			const ___Component: ___ComponentDefinition<Component> = (___real, ___parent, {}, {}, {}, {}) => {
				___createElement(___parent, "div")
			}
			export default ___Component
		`],

		['all component args but no createFn', ComponentDefinition(ComponentTypes(['p'], ['y'], ['e'], { s: false }), undefined, [emptyDiv()]), `
			import { createElement as ___createElement, ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"

			const ___Component: ___ComponentDefinition<Component> = (
				___real, ___parent,
				{ p }, { y }, { e }, { s }
			) => {
				___createElement(___parent, "div")
			}
			export default ___Component
		`],

		['only createFn', ComponentDefinition(ComponentTypes([], [], [], {}), ['a', 'b'], [emptyDiv()]), `
			import { createElement as ___createElement, Args as ___Args, ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"

			const ___Component: ___ComponentDefinition<Component> = (___real, ___parent, {}, {}, {}, {}) => {
				const { a, b } = create(({} as ___Args<Component>))
				___createElement(___parent, "div")
			}
			export default ___Component
		`],

		['createFn signaling to use ctx instead', ComponentDefinition(ComponentTypes([], [], [], {}), CTXFN, [emptyDiv()]), `
			import { createElement as ___createElement, Args as ___Args, ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"

			const ___Component: ___ComponentDefinition<Component> = (___real, ___parent, {}, {}, {}, {}) => {
				const ctx = createCtx(({} as ___Args<Component>))
				___createElement(___parent, "div")
			}
			export default ___Component
		`],


		['both component args and createFn', ComponentDefinition(
			ComponentTypes(['p1', 'p2'], ['y1', 'y2'], ['e1', 'e2'], { s1: false, s2: false }), ['a', 'b'], [emptyDiv()],
		), `
			import { createElement as ___createElement, Args as ___Args, ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"
			const ___Component: ___ComponentDefinition<Component> = (
				___real, ___parent,
				{ p1, p2 }, { y1, y2 }, { e1, e2 }, { s1, s2 }
			) => {
				const { a, b } = create(({ p1, p2, y1, y2, e1, e2 } as ___Args<Component>))
				___createElement(___parent, "div")
			}
			export default ___Component
		`],

		['usage of a required slot without args (default)', ComponentDefinition(ComponentTypes([], [], [], { def: false }), undefined, [
			SlotUsage(undefined, undefined, undefined),
		]), `
			import { ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"
			const ___Component: ___ComponentDefinition<Component> = (
				___real, ___parent, {}, {}, {}, { def }
			) => {
				def(___real, ___parent)
			}
			export default ___Component
		`],

		['usage of a required slot without args (non-default)', ComponentDefinition(ComponentTypes([], [], [], { s: false }), undefined, [
			SlotUsage('s', undefined, undefined),
		]), `
			import { ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"
			const ___Component: ___ComponentDefinition<Component> = (
				___real, ___parent, {}, {}, {}, { s }
			) => {
				s(___real, ___parent)
			}
			export default ___Component
		`],

		['usage of a required slot with args (default)', ComponentDefinition(ComponentTypes([], [], [], { def: false }), undefined, [
			SlotUsage(undefined, 'complex.a(), hmm && something().e, ...rest', undefined),
		]), `
			import { ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"
			const ___Component: ___ComponentDefinition<Component> = (
				___real, ___parent, {}, {}, {}, { def }
			) => {
				def(___real, ___parent, complex.a(), hmm && something().e, ...rest)
			}
			export default ___Component
		`],

		['usage of a required slot with args (non-default)', ComponentDefinition(ComponentTypes([], [], [], { s: false }), undefined, [
			SlotUsage('s', 'complex.a(), hmm && something().e, ...rest', undefined),
		]), `
			import { ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"
			const ___Component: ___ComponentDefinition<Component> = (
				___real, ___parent, {}, {}, {}, { s }
			) => {
				s(___real, ___parent, complex.a(), hmm && something().e, ...rest)
			}
			export default ___Component
		`],

		['mixed default and non-default required slot usages', ComponentDefinition(ComponentTypes([], [], [], { s: false, def: false }), undefined, [
			SlotUsage(undefined, 'complex.a(), hmm && something().e, ...rest', undefined),
			emptyDiv(),
			SlotUsage('s', undefined, undefined),
		]), `
			import { createElement as ___createElement, ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"
			const ___Component: ___ComponentDefinition<Component> = (
				___real, ___parent, {}, {}, {}, { s, def }
			) => {
				def(___real, ___parent, complex.a(), hmm && something().e, ...rest)
				___createElement(___parent, "div")
				s(___real, ___parent)
			}
			export default ___Component
		`],

		['usage of the same required slot in multiple places, different args', ComponentDefinition(ComponentTypes([], [], [], { s: false }), undefined, [
			SlotUsage('s', 'complex.a(), hmm && something().e, ...rest', undefined),
			emptyDiv(),
			SlotUsage('s', 'a, b, c', undefined),
			SlotUsage('s', '1, 2, 3', undefined),
			emptyDiv(),
		]), `
			import { createElement as ___createElement, ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"
			const ___Component: ___ComponentDefinition<Component> = (
				___real, ___parent, {}, {}, {}, { s }
			) => {
				s(___real, ___parent, complex.a(), hmm && something().e, ...rest)
				___createElement(___parent, "div")
				s(___real, ___parent, a, b, c)
				s(___real, ___parent, 1, 2, 3)
				___createElement(___parent, "div")
			}
			export default ___Component
		`],

		['optional slot, no fallback', ComponentDefinition(ComponentTypes([], [], [], { s: true }), undefined, [
			SlotUsage('s', undefined, undefined),
		]), `
			import { noop as ___noop, ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"
			const ___Component: ___ComponentDefinition<Component> = (
				___real, ___parent, {}, {}, {}, { s }
			) => {
				(s || ___noop)(___real, ___parent)
			}
			export default ___Component
		`],

		['optional slot, has fallback', ComponentDefinition(ComponentTypes([], [], [], { s: true }), undefined, [
			SlotUsage('s', undefined, [emptyDiv()]),
		]), `
			import { createElement as ___createElement, ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"
			const ___Component: ___ComponentDefinition<Component> = (
				___real, ___parent, {}, {}, {}, { s }
			) => {
				(s || ((___real, ___parent) => {
					___createElement(___parent, "div")
				}))(___real, ___parent)
			}
			export default ___Component
		`],

		['optional slot, one without fallback and another with', ComponentDefinition(ComponentTypes([], [], [], { s: true }), undefined, [
			SlotUsage('s', undefined, undefined),
			emptyDiv(),
			SlotUsage('s', undefined, [emptyDiv()]),
		]), `
			import { noop as ___noop, createElement as ___createElement, ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"
			const ___Component: ___ComponentDefinition<Component> = (
				___real, ___parent, {}, {}, {}, { s }
			) => {
				(s || ___noop)(___real, ___parent)

				___createElement(___parent, "div")

				(s || ((___real, ___parent) => {
					___createElement(___parent, "div")
				}))(___real, ___parent)
			}
			export default ___Component
		`],
	]

	for (const [description, definition, generated] of cases)
		it(description, () => {
			const generatedCode = generateComponentDefinition(definition)
			boilEqual(generatedCode, generated)
		})
})


describe('generateComponentInclusion', () => {
	const cases: [string, ComponentInclusion, string][] = [
		['basic', ComponentInclusion('Comp', {}, {}, {}, {}), `
			import { EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],

		// props
		['prop empty', ComponentInclusion('Comp', { 'on': BindingAttribute('on', { type: 'empty' }) }, {}, {}, {}), `
			import { fakeImmutable as ___fakeImmutable, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, { on: ___fakeImmutable(true) }, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],
		['prop static', ComponentInclusion('Comp', { 'name': BindingAttribute('name', { type: 'static', value: "dudes" }) }, {}, {}, {}), `
			import { fakeImmutable as ___fakeImmutable, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, { name: ___fakeImmutable("dudes") }, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],

		['prop dynamic bare', ComponentInclusion('Comp', {
			'p': BindingAttribute('p', { type: 'dynamic', code: AttributeCode(true, 'yo'), initialModifier: false }),
		}, {}, {}, {}), `
			import { EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, { p: yo }, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],
		['prop dynamic complex', ComponentInclusion('Comp', {
			'p': BindingAttribute('p', { type: 'dynamic', code: AttributeCode(false, 'something.complex().s'), initialModifier: false }),
		}, {}, {}, {}), `
			import { EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, { p: something.complex().s }, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],

		['prop dynamic initial bare', ComponentInclusion('Comp', {
			'p': BindingAttribute('p', { type: 'dynamic', code: AttributeCode(true, 'yo'), initialModifier: true }),
		}, {}, {}, {}), `
			import { fakeInitial as ___fakeInitial, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, { p: ___fakeInitial(yo) }, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],
		['prop dynamic initial complex', ComponentInclusion('Comp', {
			'p': BindingAttribute('p', { type: 'dynamic', code: AttributeCode(false, 'something.complex().s'), initialModifier: true }),
		}, {}, {}, {}), `
			import { fakeInitial as ___fakeInitial, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, { p: ___fakeInitial(something.complex().s) }, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],

		['prop reactive bare', ComponentInclusion('Comp', {
			'p': BindingAttribute('p', { type: 'reactive', reactiveCode: AttributeCode(true, 'yo') }),
		}, {}, {}, {}), `
			import { EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, { p: yo }, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],
		['prop reactive complex', ComponentInclusion('Comp', {
			'p': BindingAttribute('p', { type: 'reactive', reactiveCode: AttributeCode(false, 'something.complex().s') }),
		}, {}, {}, {}), `
			import { EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, { p: something.complex().s }, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],

		// syncs
		['sync bare', ComponentInclusion('Comp', {}, {
			'y': SyncAttribute('y', undefined, AttributeCode(true, "yo")),
		}, {}, {}), `
			import { EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, { y: yo }, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],
		['sync complex', ComponentInclusion('Comp', {}, {
			'y': SyncAttribute('y', undefined, AttributeCode(false, "something.complex().s")),
		}, {}, {}), `
			import { EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, { y: something.complex().s }, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],

		['sync fake bare', ComponentInclusion('Comp', {}, {
			'y': SyncAttribute('y', SyncModifier.fake, AttributeCode(true, "yo")),
		}, {}, {}), `
			import { fakeMutable as ___fakeMutable, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, { y: ___fakeMutable(yo) }, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],
		['sync fake complex', ComponentInclusion('Comp', {}, {
			'y': SyncAttribute('y', SyncModifier.fake, AttributeCode(false, "something.complex().s")),
		}, {}, {}), `
			import { fakeMutable as ___fakeMutable, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, { y: ___fakeMutable(something.complex().s) }, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],

		['sync setter bare', ComponentInclusion('Comp', {}, {
			'y': SyncAttribute('y', SyncModifier.setter, AttributeCode(true, "yo")),
		}, {}, {}), `
			import { fakeSetter as ___fakeSetter, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, { y: ___fakeSetter(yo) }, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],
		['sync setter complex', ComponentInclusion('Comp', {}, {
			'y': SyncAttribute('y', SyncModifier.setter, AttributeCode(false, "something.complex().s")),
		}, {}, {}), `
			import { fakeSetter as ___fakeSetter, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, { y: ___fakeSetter(something.complex().s) }, ___EMPTYOBJECT, ___EMPTYOBJECT)
		`],

		// events
		['event bare', ComponentInclusion('Comp', {}, {}, {
			'e': [EventAttribute('e', 'bare', 'yo')],
		}, {}), `
			import { EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, ___EMPTYOBJECT, { e: yo }, ___EMPTYOBJECT)
		`],
		['event complex', ComponentInclusion('Comp', {}, {}, {
			'e': [EventAttribute('e', 'inline', 'something.complex().s')],
		}, {}), `
			import { EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, ___EMPTYOBJECT, { e: () => something.complex().s }, ___EMPTYOBJECT)
		`],
		['event handler', ComponentInclusion('Comp', {}, {}, {
			'e': [EventAttribute('e', 'handler', " (a, b) => something(a).s += b ")]
		}, {}), `
			import { EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, ___EMPTYOBJECT, { e: (a, b) => something(a).s += b }, ___EMPTYOBJECT)
		`],
		['event multiple', ComponentInclusion('Comp', {}, {}, { 'e': [
			EventAttribute('e', 'bare', 'yo'),
			EventAttribute('e', 'inline', 'something.complex().s'),
			EventAttribute('e', 'handler', " (a, b) => something(a).s += b "),
		] }, {}), `
			import { EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, ___EMPTYOBJECT, { e: (...$args) => {
				(yo)(...$args)
				(() => something.complex().s)(...$args)
				((a, b) => something(a).s += b)(...$args)
			} }, ___EMPTYOBJECT)
		`],

		// slots
		['only orphaned entities (single)', ComponentInclusion('Comp', {}, {}, {}, {
			'def': SlotInsertion(undefined, undefined, [emptyDiv()]),
		}), `
			import { createElement as ___createElement, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT, {
				def: (___real, ___parent) => {
					___createElement(___parent, "div")
				}
			})
		`],

		['only orphaned entities (multiple)', ComponentInclusion('Comp', {}, {}, {}, {
			'def': SlotInsertion(undefined, undefined, [emptyH1(), emptyDiv()]),
		}), `
			import { createElement as ___createElement, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT, {
				def: (___real, ___parent) => {
					___createElement(___parent, "h1")
					___createElement(___parent, "div")
				}
			})
		`],

		['only explicit default (single)', ComponentInclusion('Comp', {}, {}, {}, {
			'def': SlotInsertion(undefined, 'a: string', [emptyDiv()]),
		}), `
			import { createElement as ___createElement, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT, {
				def: (___real, ___parent, a: string) => {
					___createElement(___parent, "div")
				}
			})
		`],

		['only explicit default (multiple)', ComponentInclusion('Comp', {}, {}, {}, {
			'def': SlotInsertion(undefined, 'a: string', [
				emptyH1(),
				emptyDiv(),
			]),
		}), `
			import { createElement as ___createElement, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT, {
				def: (___real, ___parent, a: string) => {
					___createElement(___parent, "h1")
					___createElement(___parent, "div")
				}
			})
		`],

		['only explicit inserts', ComponentInclusion('Comp', {}, {}, {}, {
			'first': SlotInsertion('first', 'name?: string', [
				emptyH1(),
				emptyDiv(),
			]),
			'second': SlotInsertion('second', 'a: string, b: boolean', [
				emptySpan(),
			]),
		}), `
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

		['mixed explicit inserts with orphaned', ComponentInclusion('Comp', {}, {}, {}, {
			'second': SlotInsertion('second', 'a: string, b: boolean', [
				emptySpan(),
			]),
			'def': SlotInsertion(undefined, undefined, [
				emptyH1(),
				emptyDiv(),
			]),
		}), `
			import { createElement as ___createElement, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT, {
				second: (___real, ___parent, a: string, b: boolean) => {
					___createElement(___parent, "span")
				},
				def: (___real, ___parent) => {
					___createElement(___parent, "h1")
					___createElement(___parent, "div")
				}
			})
		`],

		['mixed explicit inserts with explicit default', ComponentInclusion('Comp', {}, {}, {}, {
			'first': SlotInsertion('first', 'name?: string', [
				emptyH1(),
			]),
			'def': SlotInsertion(undefined, 'a: string', [
				emptyH1(),
				emptyDiv(),
			]),
			'second': SlotInsertion('second', undefined, [
				emptySpan(),
			]),
		}), `
			import { createElement as ___createElement, EMPTYOBJECT as ___EMPTYOBJECT } from "project-f/runtime"
			Comp(___real, ___parent, ___EMPTYOBJECT, ___EMPTYOBJECT, ___EMPTYOBJECT, {
				first: (___real, ___parent, name?: string) => {
					___createElement(___parent, "h1")
				},
				def: (___real, ___parent, a: string) => {
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
})


describe('generateTag', () => {
	const emptyAttrs = () => TagAttributes(undefined, [], {}, {}, [])

	const cases: [string, Tag, string][] = [
		['div hello', Tag('div', emptyAttrs(), [TextSection(TextItem(LivenessType.static, 'hello'))]), `
			import { createElement as ___createElement } from "project-f/runtime"

			const ___div0 = ___createElement(___parent, "div")
			___div0.textContent = "hello"
		`],

		['div: span hello', Tag('div', emptyAttrs(), [Tag('span', emptyAttrs(), [TextSection(TextItem(LivenessType.static, 'hello'))])]), `
			import { createElement as ___createElement } from "project-f/runtime"

			const ___div0 = ___createElement(___parent, "div")

			const ___span0_0 = ___createElement(___div0, "span")
			___span0_0.textContent = "hello"
		`],

		[`div: [span hello, div]`, Tag('div', emptyAttrs(), [
			Tag('span', emptyAttrs(), [TextSection(TextItem(LivenessType.static, 'hello'))]),
			emptyDiv(),
		]), `
			import { createElement as ___createElement } from "project-f/runtime"

			const ___div0 = ___createElement(___parent, "div")
			const ___div0fragment = document.createDocumentFragment()

			const ___span0_0 = ___createElement(___div0fragment, "span")
			___span0_0.textContent = "hello"

			___createElement(___div0fragment, "div")

			___div0.appendChild(___div0fragment)
		`],

		['#i.one.two(disabled=false, thing.children().stuff[0]="whatever", checked, :visible={ env.immutable })', Tag(
			'div',
			TagAttributes(
				IdMeta(LivenessType.static, 'i'),
				[ClassMeta(LivenessType.static, 'one'), ClassMeta(LivenessType.static, 'two')],
				{
					'disabled': BindingAttribute('disabled', { type: 'dynamic', code: AttributeCode(true, 'false'), initialModifier: false }),
					'thing.children().stuff[0]': BindingAttribute('thing.children().stuff[0]', { type: 'static', value: "whatever" }),
					'checked': BindingAttribute('checked', { type: 'empty' }),
					'visible': BindingAttribute('visible', { type: 'reactive', reactiveCode: AttributeCode(false, 'env.immutable') }),
				},
				{}, [],
			),
			[],
		), `
			import { createElementClass as ___createElementClass, bindProperty as ___bindProperty } from "project-f/runtime"
			const ___div0 = ___createElementClass(___parent, "div", "one two")
			___div0.id = "i"
			___div0.disabled = false
			___div0.thing.children().stuff[0] = "whatever"
			___div0.checked = true
			___bindProperty(___div0, "visible", env.immutable)
		`],

		['div(@click=doit, @keyup={ mutable(1) }, @keydown|handler={ e => handle(e) })', Tag(
			'div',
			TagAttributes(
				undefined, [], {},
				{
					'click': [EventAttribute('click', 'bare', 'doit')],
					'keyup': [EventAttribute('keyup', 'inline', ' mutable(1) ')],
					'keydown': [EventAttribute('keydown', 'handler', ' e => handle(e) ')],
				},
				[],
			),
			[],
		), `
			import { createElement as ___createElement } from "project-f/runtime"

			const ___div0 = ___createElement(___parent, "div")
			___div0.onclick = doit
			___div0.onkeyup = $event => mutable(1)
			___div0.onkeydown = e => handle(e)
		`],

		['two handlers for the same event', Tag(
			'div',
			TagAttributes(
				undefined, [], {},
				{
					'click': [EventAttribute('click', 'bare', 'doit'), EventAttribute('click', 'inline', ' mutable(1) ')],
				},
				[],
			),
			[],
		), `
			import { createElement as ___createElement } from "project-f/runtime"

			const ___div0 = ___createElement(___parent, "div")
			___div0.onclick = $event => {
				(doit)($event)
				($event => mutable(1))($event)
			}
		`],

		['three handlers for the same event', Tag(
			'div',
			TagAttributes(
				undefined, [], {}, { 'click': [
					EventAttribute('click', 'bare', 'doit'),
					EventAttribute('click', 'inline', ' mutable(1) '),
					EventAttribute('click', 'handler', ' e => handle(e) '),
				] },
				[],
			),
			[],
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
			'div',
			TagAttributes(
				undefined, [], {}, {},
				[ReceiverAttribute(AttributeCode(true, 'doit')), ReceiverAttribute(AttributeCode(false, ' d => handle(d) '))],
			),
			[],
		), `
			import {createElement as ___createElement} from "project-f/runtime"
			const ___div0 = ___createElement(___parent, "div")
			(doit)(___div0)
			(d => handle(d))(___div0)
		`],

		['input text without sync', Tag(
			'input',
			TagAttributes(undefined, [], {
				'disabled': BindingAttribute('disabled', { type: 'empty' }),
			}, {}, []),
			[],
		), `
			import { createElement as ___createElement } from "project-f/runtime"
			const ___input0 = ___createElement(___parent, "input")
			___input0.disabled = true
		`],
		['textarea without sync', Tag(
			'textarea',
			TagAttributes(undefined, [], {
				'disabled': BindingAttribute('disabled', { type: 'empty' }),
			}, {}, []),
			[],
		), `
			import { createElement as ___createElement } from "project-f/runtime"
			const ___textarea0 = ___createElement(___parent, "textarea")
			___textarea0.disabled = true
		`],
		['select without sync', Tag(
			'select',
			TagAttributes(undefined, [], {
				'disabled': BindingAttribute('disabled', { type: 'empty' }),
			}, {}, []),
			[],
		), `
			import { createElement as ___createElement } from "project-f/runtime"
			const ___select0 = ___createElement(___parent, "select")
			___select0.disabled = true
		`],
	]

	for (const [description, tag, generated] of cases)
		it(description, () => {
			const context = ctx()
			const nodes = generateTag(tag, '0', context, realParent, parent)
			boilEqual(context.finalize(nodes), generated)
		})
})

describe('generateHtml', () => {
	const cases: [string, Html, string][] = [
		['input(type="radio", !sync=textValue, value="a")', SyncedRadioInput(
			AttributeCode(true, 'textValue'),
			{ type: 'static', value: "a" },
			TagAttributes(undefined, [], {
				'type': BindingAttribute('type', { type: 'static', value: "radio" }),
				'value': BindingAttribute('value', { type: 'static', value: "a" }),
			}, {}, []),
		), `
			import { createElement as ___createElement, syncRadioElement as ___syncRadioElement } from "project-f/runtime"

			const ___input0 = ___createElement(___parent, "input")
			___input0.type = "radio"
			___input0.value = "a"
			___syncRadioElement(___input0, textValue)
		`],
		['input(type="radio", !sync=textValue, value=changing)', SyncedRadioInput(
			AttributeCode(true, 'textValue'),
			{ type: 'static', value: "a" },
			TagAttributes(undefined, [], {
				'type': BindingAttribute('type', { type: 'static', value: "radio" }),
				'value': BindingAttribute('value', { type: 'dynamic', code: AttributeCode(true, 'changing'), initialModifier: false }),
			}, {}, []),
		), `
			import { createElement as ___createElement, syncRadioElement as ___syncRadioElement } from "project-f/runtime"

			const ___input0 = ___createElement(___parent, "input")
			___input0.type = "radio"
			___input0.value = changing
			___syncRadioElement(___input0, textValue)
		`],

		// TODO select

		['input(!sync=textValue, placeholder="hello")', SyncedTextInput(
			false,
			AttributeCode(true, 'textValue'),
			TagAttributes(undefined, [], {
				'placeholder': BindingAttribute('placeholder', { type: 'static', value: "hello" }),
			}, {}, []),
		), `
			import { createElement as ___createElement, syncTextElement as ___syncTextElement } from "project-f/runtime"

			const ___input0 = ___createElement(___parent, "input")
			___input0.placeholder = "hello"
			___syncTextElement(___input0, textValue)
		`],
		['textarea(!sync=textValue, placeholder="hello")', SyncedTextInput(
			true,
			AttributeCode(true, 'textValue'),
			TagAttributes(undefined, [], {
				'placeholder': BindingAttribute('placeholder', { type: 'static', value: "hello" }),
			}, {}, []),
		), `
			import { createElement as ___createElement, syncTextElement as ___syncTextElement } from "project-f/runtime"

			const ___textarea0 = ___createElement(___parent, "textarea")
			___textarea0.placeholder = "hello"
			___syncTextElement(___textarea0, textValue)
		`],
	]

	for (const [description, html, generated] of cases)
		it(description, () => {
			const context = ctx()
			const nodes = generateEntity(html, '0', false, context, realParent, parent)
			boilEqual(context.finalize(nodes), generated)
		})
})

describe('generateText', () => {
	const cases: [boolean, NonEmpty<TextItem>, string][] = [
		// static
		[true, [TextItem(LivenessType.static, 'hello')], `
			___real.textContent = "hello"
		`],
		[false, [TextItem(LivenessType.static, 'hello')], `
			import { createTextNode as ___createTextNode } from "project-f/runtime"
			___createTextNode(___parent, "hello")
		`],

		[true, [TextItem(LivenessType.static, 'hello "every ')], `
			___real.textContent = "hello \\"every "
		`],
		[false, [TextItem(LivenessType.static, 'hello "every ')], `
			import { createTextNode as ___createTextNode } from "project-f/runtime"
			___createTextNode(___parent, "hello \\"every ")
		`],

		[true, [TextItem(LivenessType.static, 'hello'), TextItem(LivenessType.static, '\n'), TextItem(LivenessType.static, 'world')], `
			___real.textContent = \`hello\nworld\`
		`],
		[false, [TextItem(LivenessType.static, 'hello'), TextItem(LivenessType.static, '\n'), TextItem(LivenessType.static, 'world')], `
			import { createTextNode as ___createTextNode } from "project-f/runtime"
			___createTextNode(___parent, \`hello\nworld\`)
		`],

		// dynamic simple
		[true, [TextItem(LivenessType.dynamic, ' hello ')], `
			___real.textContent = hello
		`],
		[false, [TextItem(LivenessType.dynamic, ' hello ')], `
			import { createTextNode as ___createTextNode } from "project-f/runtime"
			___createTextNode(___parent, hello)
		`],

		// dynamic complex
		[true, [TextItem(LivenessType.dynamic, ' hello.world().display ')], `
			___real.textContent = hello.world().display
		`],
		[false, [TextItem(LivenessType.dynamic, ' hello.world().display ')], `
			import { createTextNode as ___createTextNode } from "project-f/runtime"
			___createTextNode(___parent, hello.world().display)
		`],

		// reactive simple
		[true, [TextItem(LivenessType.reactive, ' hello ')], `
			import { bindProperty as ___bindProperty } from "project-f/runtime"
			___bindProperty(___real, "textContent", hello)
		`],
		[false, [TextItem(LivenessType.reactive, ' hello ')], `
			import { createTextNode as ___createTextNode, bindProperty as ___bindProperty } from "project-f/runtime"
			const ___text0 = ___createTextNode(___parent, "")
			___bindProperty(___text0, "data", hello)
		`],

		// mixed, strongest dynamic
		[true, [TextItem(LivenessType.static, 'hello '), TextItem(LivenessType.dynamic, 'world'), TextItem(LivenessType.static, '!')], `
			___real.textContent = \`hello \${ world }!\`
		`],
		[false, [TextItem(LivenessType.static, 'hello '), TextItem(LivenessType.dynamic, ' world '), TextItem(LivenessType.static, '!')], `
			import { createTextNode as ___createTextNode } from "project-f/runtime"
			___createTextNode(___parent, \`hello \${world}!\`)
		`],

		// mixed, strongest reactive
		[true, [TextItem(LivenessType.static, 'hello '), TextItem(LivenessType.dynamic, ' count '), TextItem(LivenessType.reactive, ' world '), TextItem(LivenessType.static, '!')], `
			import { derived as ___derived, bindProperty as ___bindProperty } from "project-f/runtime"

			___bindProperty(___real, "textContent", ___derived(___0 => \`hello \${count}\${___0}!\`, world))
		`],
		[false, [TextItem(LivenessType.static, 'hello '), TextItem(LivenessType.dynamic, 'count'), TextItem(LivenessType.reactive, ' world '), TextItem(LivenessType.static, '!')], `
			import { derived as ___derived, createTextNode as ___createTextNode, bindProperty as ___bindProperty } from "project-f/runtime"

			const ___text0 = ___createTextNode(___parent, "")
			___bindProperty(___text0, "data", ___derived(___0 => \`hello \${count}\${___0}!\`, world))
		`],
	]

	for (const [lone, items, generated] of cases) {
		const context = ctx()
		const nodes = generateText(TextSection(...items), '0', lone, context, realParent, parent)
		const generatedCode = context.finalize(nodes)

		const itemsString = items.map(({ liveness, content }) => `(liveness: ${liveness}, ${content.replace(/\n/g, ' ')})`).join(', ')
		it(`lone: ${lone}, ${itemsString}`, () => boilEqual(generatedCode, generated))
	}
})


describe('generateIfBlock', () => {
	const cases: [string, boolean, IfBlock, string][] = [
		['nonreactive single if', false, IfBlock(LiveCode(false, 'checked'), [emptyDiv()], [], undefined), `
			import { createElement as ___createElement } from "project-f/runtime"

			if (checked) {
				___createElement(___p, "div")
			}
		`],

		['nonreactive if, else', false, IfBlock(LiveCode(false, 'checked'), [emptyDiv()], [], [emptySpan()]), `
			import { createElement as ___createElement } from "project-f/runtime"

			if (checked) {
				___createElement(___p, "div")
			}
			else {
				___createElement(___p, "span")
			}
		`],

		['nonreactive if, else if', false, IfBlock(LiveCode(false, 'checked'), [emptyDiv()], [[LiveCode(false, 'other'), [emptySpan()]]], undefined), `
			import { createElement as ___createElement } from "project-f/runtime"

			if (checked) {
				___createElement(___p, "div")
			}
			else if (other) {
				___createElement(___p, "span")
			}
		`],

		['nonreactive if, else if else if', false, IfBlock(
			LiveCode(false, 'checked'), [emptyDiv()],
			[[LiveCode(false, 'other'), [emptySpan()]], [LiveCode(false, 'dude'), [emptyH1()]]],
			undefined,
		), `
			import { createElement as ___createElement } from "project-f/runtime"

			if (checked) {
				___createElement(___p, "div")
			}
			else if (other) {
				___createElement(___p, "span")
			}
			else if (dude) {
				___createElement(___p, "h1")
			}
		`],

		['nonreactive if, else if else', false, IfBlock(
			LiveCode(false, 'checked'), [emptyDiv()],
			[[LiveCode(false, 'other'), [emptySpan()]]],
			[emptyStrong()],
		), `
			import { createElement as ___createElement } from "project-f/runtime"

			if (checked) {
				___createElement(___p, "div")
			}
			else if (other) {
				___createElement(___p, "span")
			}
			else {
				___createElement(___p, "strong")
			}
		`],

		['nonreactive if, else if else if else', false, IfBlock(
			LiveCode(false, 'checked'), [emptyDiv()],
			[[LiveCode(false, 'other'), [emptySpan()]], [LiveCode(false, 'dude'), [emptyH1()]]],
			[emptyStrong()],
		), `
			import { createElement as ___createElement } from "project-f/runtime"

			if (checked) {
				___createElement(___p, "div")
			}
			else if (other) {
				___createElement(___p, "span")
			}
			else if (dude) {
				___createElement(___p, "h1")
			}
			else {
				___createElement(___p, "strong")
			}
		`],

		['nonreactive if, else if else if else: lone', true, IfBlock(
			LiveCode(false, 'checked'), [emptyDiv()],
			[[LiveCode(false, 'other'), [emptySpan()]], [LiveCode(false, 'dude'), [emptyH1()]]],
			[emptyStrong()],
		), `
			import { createElement as ___createElement } from "project-f/runtime"

			if (checked) {
				___createElement(___p, "div")
			}
			else if (other) {
				___createElement(___p, "span")
			}
			else if (dude) {
				___createElement(___p, "h1")
			}
			else {
				___createElement(___p, "strong")
			}
		`],


		['reactive single if', false, IfBlock(LiveCode(true, 'checked'), [emptyDiv()], [], undefined), `
			import { createElement as ___createElement, rangeEffect as ___rangeEffect } from "project-f/runtime"

			___rangeEffect((___real, ___parent) => {
				if (checked.r()) {
					___createElement(___parent, "div")
				}
			}, ___r, ___p)
		`],

		['reactive if, else', false, IfBlock(LiveCode(true, 'checked'), [emptyDiv()], [], [emptySpan()]), `
			import { createElement as ___createElement, rangeEffect as ___rangeEffect } from "project-f/runtime"

			___rangeEffect((___real, ___parent) => {
				if (checked.r()) {
					___createElement(___parent, "div")
				}
				else {
					___createElement(___parent, "span")
				}
			}, ___r, ___p)
		`],

		['reactive if, inert else if', false, IfBlock(LiveCode(true, 'checked'), [emptyDiv()], [[LiveCode(false, 'other'), [emptySpan()]]], undefined), `
			import { createElement as ___createElement, rangeEffect as ___rangeEffect } from "project-f/runtime"

			___rangeEffect((___real, ___parent) => {
				if (checked.r()) {
					___createElement(___parent, "div")
				}
				else if (other) {
					___createElement(___parent, "span")
				}
			}, ___r, ___p)
		`],

		['reactive inert if, non-inert else if', false, IfBlock(LiveCode(false, 'checked'), [emptyDiv()], [[LiveCode(true, 'other'), [emptySpan()]]], undefined), `
			import { createElement as ___createElement, rangeEffect as ___rangeEffect } from "project-f/runtime"

			___rangeEffect((___real, ___parent) => {
				if (checked) {
					___createElement(___parent, "div")
				}
				else if (other.r()) {
					___createElement(___parent, "span")
				}
			}, ___r, ___p)
		`],

		['reactive if, inert else if else if', false, IfBlock(
			LiveCode(true, 'checked'), [emptyDiv()],
			[[LiveCode(false, 'other'), [emptySpan()]], [LiveCode(true, 'dude'), [emptyH1()]]],
			undefined,
		), `
			import { createElement as ___createElement, rangeEffect as ___rangeEffect } from "project-f/runtime"

			___rangeEffect((___real, ___parent) => {
				if (checked.r()) {
					___createElement(___parent, "div")
				}
				else if (other) {
					___createElement(___parent, "span")
				}
				else if (dude.r()) {
					___createElement(___parent, "h1")
				}
			}, ___r, ___p)
		`],

		['reactive if, else if else', false, IfBlock(
			LiveCode(false, 'checked'), [emptyDiv()],
			[[LiveCode(true, 'other'), [emptySpan()]]],
			[emptyStrong()],
		), `
			import { createElement as ___createElement, rangeEffect as ___rangeEffect } from "project-f/runtime"

			___rangeEffect((___real, ___parent) => {
				if (checked) {
					___createElement(___parent, "div")
				}
				else if (other.r()) {
					___createElement(___parent, "span")
				}
				else {
					___createElement(___parent, "strong")
				}
			}, ___r, ___p)
		`],

		['reactive if, else if else if else', false, IfBlock(
			LiveCode(true, 'checked'), [emptyDiv()],
			[[LiveCode(true, 'other'), [emptySpan()]], [LiveCode(true, 'dude'), [emptyH1()]]],
			[emptyStrong()],
		), `
			import { createElement as ___createElement, rangeEffect as ___rangeEffect } from "project-f/runtime"

			___rangeEffect((___real, ___parent) => {
				if (checked.r()) {
					___createElement(___parent, "div")
				}
				else if (other.r()) {
					___createElement(___parent, "span")
				}
				else if (dude.r()) {
					___createElement(___parent, "h1")
				}
				else {
					___createElement(___parent, "strong")
				}
			}, ___r, ___p)
		`],

		['reactive if, else if else if else: lone', true, IfBlock(
			LiveCode(true, 'checked'), [emptyDiv()],
			[[LiveCode(true, 'other'), [emptySpan()]], [LiveCode(true, 'dude'), [emptyH1()]]],
			[emptyStrong()],
		), `
			import { createElement as ___createElement, contentEffect as ___contentEffect } from "project-f/runtime"

			___contentEffect((___real, ___parent) => {
				if (checked.r()) {
					___createElement(___parent, "div")
				}
				else if (other.r()) {
					___createElement(___parent, "span")
				}
				else if (dude.r()) {
					___createElement(___parent, "h1")
				}
				else {
					___createElement(___parent, "strong")
				}
			}, ___r)
		`],
	]

	for (const [description, lone, block, generated] of cases)
		it(description, () => {
			const context = ctx()
			const nodes = generateIfBlock(block, '0', lone, context, ...namedParentIdents('r', 'p'))
			boilEqual(context.finalize(nodes), generated)
		})
})


describe('generateEachBlock', () => {
	const cases: [string, boolean, EachBlock, string][] = [
		['nonreactive', false, EachBlock({ variableCode: 'item', indexCode: undefined }, LiveCode(false, 'list'), [TextSection(TextItem(LivenessType.dynamic, 'item'))]), `
			import { createTextNode as ___createTextNode } from "project-f/runtime"

			const ___eachBlockCollection0 = list
			const ___eachBlockCollectionLength0 = ___eachBlockCollection0.length
			for (let ___eachBlockIndex0 = 0; ___eachBlockIndex0 < ___eachBlockCollectionLength0; ___eachBlockIndex0++) {
				const item = ___eachBlockCollection0[___eachBlockIndex0]
				___createTextNode(___p, item)
			}
		`],
		// TODO this isn't a good way of handling each blocks
		// - it doesn't make it possible to use arbitrary iterables
		// - it adds a lot of code bloat
		// pursue something like this *maybe* for the actual @for directive
		// this should eventually be something more like this
		// `
		// 	// nonreactive
		// 	import { createTextNode as ___createTextNode } from "project-f/runtime"
		// 	for (const item of list) {
		// 		___createTextNode(___p, item)
		// 	}
		// 	import { createTextNode as ___createTextNode } from "project-f/runtime"
		// 	for (const [index, item] of list.entries()) {
		// 		___createTextNode(___p, item)
		// 	}

		// 	// reactive
		// 	import { createTextNode as ___createTextNode, bindEach as ___bindEach } from "project-f/runtime"
		// 	___bindEach(list, item => {
		// 		___createTextNode(___p, item)
		// 	})
		// 	___bindEach(list, (item, index) => {
		// 		___createTextNode(___p, item)
		// 	})
		// `

		['nonreactive, requests index', false, EachBlock({ variableCode: 'item', indexCode: 'index' }, LiveCode(false, 'list'), [TextSection(TextItem(LivenessType.dynamic, 'item'))]), `
			import { createTextNode as ___createTextNode } from "project-f/runtime"

			const ___eachBlockCollection0 = list
			const ___eachBlockCollectionLength0 = ___eachBlockCollection0.length
			for (let index = 0; index < ___eachBlockCollectionLength0; index++) {
				const item = ___eachBlockCollection0[index]
				___createTextNode(___p, item)
			}
		`],

		['nonreactive, requests index: lone', false, EachBlock({ variableCode: 'item', indexCode: 'index' }, LiveCode(false, 'list'), [TextSection(TextItem(LivenessType.dynamic, 'item'))]), `
			import { createTextNode as ___createTextNode } from "project-f/runtime"

			const ___eachBlockCollection0 = list
			const ___eachBlockCollectionLength0 = ___eachBlockCollection0.length
			for (let index = 0; index < ___eachBlockCollectionLength0; index++) {
				const item = ___eachBlockCollection0[index]
				___createTextNode(___p, item)
			}
		`],

		['reactive', false, EachBlock({ variableCode: 'item', indexCode: undefined }, LiveCode(true, 'list'), [TextSection(TextItem(LivenessType.dynamic, 'item'))]), `
			import { createTextNode as ___createTextNode, rangeEffect as ___rangeEffect } from "project-f/runtime"

			___rangeEffect((___real, ___parent) => {
				const ___eachBlockCollection0 = list.r()
				const ___eachBlockCollectionLength0 = ___eachBlockCollection0.length
				for (let ___eachBlockIndex0 = 0; ___eachBlockIndex0 < ___eachBlockCollectionLength0; ___eachBlockIndex0++) {
					const item = ___eachBlockCollection0[___eachBlockIndex0]
					___createTextNode(___parent, item)
				}
			}, ___r, ___p)
		`],

		['reactive, requests index', false, EachBlock({ variableCode: 'item', indexCode: 'index' }, LiveCode(true, 'list'), [TextSection(TextItem(LivenessType.dynamic, 'item'))]), `
			import { createTextNode as ___createTextNode, rangeEffect as ___rangeEffect } from "project-f/runtime"

			___rangeEffect((___real, ___parent) => {
				const ___eachBlockCollection0 = list.r()
				const ___eachBlockCollectionLength0 = ___eachBlockCollection0.length
				for (let index = 0; index < ___eachBlockCollectionLength0; index++) {
					const item = ___eachBlockCollection0[index]
					___createTextNode(___parent, item)
				}
			}, ___r, ___p)
		`],

		['reactive, requests index: lone', true, EachBlock({ variableCode: 'item', indexCode: 'index' }, LiveCode(true, 'list'), [TextSection(TextItem(LivenessType.dynamic, 'item'))]), `
			import { createTextNode as ___createTextNode, contentEffect as ___contentEffect } from "project-f/runtime"

			___contentEffect((___real, ___parent) => {
				const ___eachBlockCollection0 = list.r()
				const ___eachBlockCollectionLength0 = ___eachBlockCollection0.length
				for (let index = 0; index < ___eachBlockCollectionLength0; index++) {
					const item = ___eachBlockCollection0[index]
					___createTextNode(___parent, item)
				}
			}, ___r)
		`],
	]

	for (const [description, lone, block, generated] of cases)
		it(description, () => {
			const context = ctx()
			const nodes = generateEachBlock(block, '0', lone, context, ...namedParentIdents('r', 'p'))
			boilEqual(context.finalize(nodes), generated)
		})
})


describe('generateMatchBlock', () => {
	const cases: [string, boolean, MatchBlock, string][] = [
		['nonreactive, no default', false, MatchBlock(LiveCode(false, 'type'), [
			[LiveCode(false, '"a"'), [emptyDiv()]],
			[LiveCode(false, 'Something.whatever'), [emptySpan()]],
		], undefined), `
			import { createElement as ___createElement, exhaustive as ___exhaustive } from "project-f/runtime"

			switch (type) {
				case "a": {
					___createElement(___p, "div")
					break
				}
				case Something.whatever: {
					___createElement(___p, "span")
					break
				}
				default: ___exhaustive(type)
			}
		`],

		['nonreactive, no default, empty case', false, MatchBlock(LiveCode(false, 'type'), [
				[LiveCode(false, '"a"'), [emptyDiv()]],
				[LiveCode(false, 'Something.whatever'), []],
			], undefined), `
			import { createElement as ___createElement, exhaustive as ___exhaustive } from "project-f/runtime"

			switch (type) {
				case "a": {
					___createElement(___p, "div")
					break
				}
				case Something.whatever: { break }
				default: ___exhaustive(type)
			}
		`],

		['nonreactive, empty default', false, MatchBlock(LiveCode(false, 'type'), [
			[LiveCode(false, '"a"'), [emptyDiv()]],
			[LiveCode(false, 'Something.whatever'), [emptySpan()]],
		], []), `
			import { createElement as ___createElement } from "project-f/runtime"

			switch (type) {
				case "a": {
					___createElement(___p, "div")
					break
				}
				case Something.whatever: {
					___createElement(___p, "span")
					break
				}
				default: { break }
			}
		`],

		['nonreactive, nonempty default', false, MatchBlock(LiveCode(false, 'type'), [
			[LiveCode(false, '"a"'), [emptyDiv()]],
			[LiveCode(false, 'Something.whatever'), [emptySpan()]],
		], [emptyH1()]), `
			import { createElement as ___createElement } from "project-f/runtime"

			switch (type) {
				case "a": {
					___createElement(___p, "div")
					break
				}
				case Something.whatever: {
					___createElement(___p, "span")
					break
				}
				default: {
					___createElement(___p, "h1")
					break
				}
			}
		`],

		['nonreactive, nonempty default: lone', true, MatchBlock(LiveCode(false, 'type'), [
			[LiveCode(false, '"a"'), [emptyDiv()]],
			[LiveCode(false, 'Something.whatever'), [emptySpan()]],
		], [emptyH1()]), `
			import { createElement as ___createElement } from "project-f/runtime"

			switch (type) {
				case "a": {
					___createElement(___p, "div")
					break
				}
				case Something.whatever: {
					___createElement(___p, "span")
					break
				}
				default: {
					___createElement(___p, "h1")
					break
				}
			}
		`],


		['reactive, no default', false, MatchBlock(LiveCode(true, 'type'), [
			[LiveCode(false, '"a"'), [emptyDiv()]],
			[LiveCode(false, 'Something.whatever'), [emptySpan()]],
		], undefined), `
			import { createElement as ___createElement, exhaustive as ___exhaustive, rangeEffect as ___rangeEffect } from "project-f/runtime"

			___rangeEffect((___real, ___parent) => {
				switch (type.r()) {
					case "a": {
						___createElement(___parent, "div")
						break
					}
					case Something.whatever: {
						___createElement(___parent, "span")
						break
					}
					default: ___exhaustive(type.r())
				}
			}, ___r, ___p)
		`],

		// in both these reactive cases with no default
		// in real usage these wouldn't type check, but that's fine since this isn't correct
		// they need to assign their switch expression to something first
		['reactive, no default, empty case', false, MatchBlock(LiveCode(true, 'type'), [
			[LiveCode(false, '"a"'), [emptyDiv()]],
			[LiveCode(false, 'Something.whatever'), []],
		], undefined), `
			import { createElement as ___createElement, exhaustive as ___exhaustive, rangeEffect as ___rangeEffect } from "project-f/runtime"

			___rangeEffect((___real, ___parent) => {
				switch (type.r()) {
					case "a": {
						___createElement(___parent, "div")
						break
					}
					case Something.whatever: { break }
					default: ___exhaustive(type.r())
				}
			}, ___r, ___p)
		`],

		['reactive, empty default', false, MatchBlock(LiveCode(true, 'type'), [
			[LiveCode(false, '"a"'), [emptyDiv()]],
			[LiveCode(false, 'Something.whatever'), [emptySpan()]],
		], []), `
			import { createElement as ___createElement, rangeEffect as ___rangeEffect } from "project-f/runtime"

			___rangeEffect((___real, ___parent) => {
				switch (type.r()) {
					case "a": {
						___createElement(___parent, "div")
						break
					}
					case Something.whatever: {
						___createElement(___parent, "span")
						break
					}
					default: { break }
				}
			}, ___r, ___p)
		`],

		['reactive, nonempty default', false, MatchBlock(LiveCode(true, 'type'), [
			[LiveCode(false, '"a"'), [emptyDiv()]],
			[LiveCode(false, 'Something.whatever'), [emptySpan()]],
		], [emptyH1()]), `
			import { createElement as ___createElement, rangeEffect as ___rangeEffect } from "project-f/runtime"

			___rangeEffect((___real, ___parent) => {
				switch (type.r()) {
					case "a": {
						___createElement(___parent, "div")
						break
					}
					case Something.whatever: {
						___createElement(___parent, "span")
						break
					}
					default: {
						___createElement(___parent, "h1")
						break
					}
				}
			}, ___r, ___p)
		`],

		['reactive assign, no default, empty case', false, MatchBlock(AssignedLiveCode('ty', 'type'), [
			[LiveCode(false, '"a"'), [emptyDiv()]],
			[LiveCode(false, 'Something.whatever'), []],
		], undefined), `
			import { createElement as ___createElement, exhaustive as ___exhaustive, rangeEffect as ___rangeEffect } from "project-f/runtime"

			___rangeEffect((___real, ___parent) => {
				const ty = type.r()
				switch (ty) {
					case "a": {
						___createElement(___parent, "div")
						break
					}
					case Something.whatever: { break }
					default: ___exhaustive(ty)
				}
			}, ___r, ___p)
		`],

		['reactive assign, no default, empty case: lone', true, MatchBlock(AssignedLiveCode('ty', 'type'), [
			[LiveCode(false, '"a"'), [emptyDiv()]],
			[LiveCode(false, 'Something.whatever'), []],
		], undefined), `
			import { createElement as ___createElement, exhaustive as ___exhaustive, contentEffect as ___contentEffect } from "project-f/runtime"

			___contentEffect((___real, ___parent) => {
				const ty = type.r()
				switch (ty) {
					case "a": {
						___createElement(___parent, "div")
						break
					}
					case Something.whatever: { break }
					default: ___exhaustive(ty)
				}
			}, ___r)
		`],
	]

	for (const [description, lone, block, generated] of cases)
		it(description, () => {
			const context = ctx()
			const nodes = generateMatchBlock(block, '0', lone, context, ...namedParentIdents('r', 'p'))
			boilEqual(context.finalize(nodes), generated)
		})
})


describe('generateSwitchBlock', () => {
	const cases: [string, boolean, SwitchBlock, string][] = [
		['nonreactive, one fallthrough, no default', false, SwitchBlock(LiveCode(false, 'type'), [
			SwitchCase(true, LiveCode(false, '"a"'), [emptyDiv()]),
			SwitchCase(false, LiveCode(false, 'Something.whatever'), [emptySpan()]),
		]), `
			import { createElement as ___createElement, exhaustive as ___exhaustive } from "project-f/runtime"

			switch (type) {
				case "a": {
					___createElement(___p, "div")
				}
				case Something.whatever: {
					___createElement(___p, "span")
					break
				}
				default: ___exhaustive(type)
			}
		`],

		['nonreactive, no default, empty case', false, SwitchBlock(LiveCode(false, 'type'), [
			SwitchCase(false, LiveCode(false, '"a"'), [emptyDiv()]),
			SwitchCase(true, LiveCode(false, 'Something.whatever'), []),
		]), `
			import { createElement as ___createElement, exhaustive as ___exhaustive } from "project-f/runtime"

			switch (type) {
				case "a": {
					___createElement(___p, "div")
					break
				}
				case Something.whatever: {}
				default: ___exhaustive(type)
			}
		`],

		['nonreactive, empty default', false, SwitchBlock(LiveCode(false, 'type'), [
			SwitchCase(true, LiveCode(false, '"a"'), [emptyDiv()]),
			SwitchCase(false, LiveCode(false, 'Something.whatever'), [emptySpan()]),
			SwitchDefault(true, []),
		]), `
			import { createElement as ___createElement } from "project-f/runtime"

			switch (type) {
				case "a": {
					___createElement(___p, "div")
				}
				case Something.whatever: {
					___createElement(___p, "span")
					break
				}
				default: {}
			}
		`],

		['nonreactive, nonempty default', false, SwitchBlock(LiveCode(false, 'type'), [
			SwitchCase(false, LiveCode(false, '"a"'), [emptyDiv()]),
			SwitchCase(true, LiveCode(false, 'Something.whatever'), [emptySpan()]),
			SwitchDefault(false, [emptyH1()]),
		]), `
			import { createElement as ___createElement } from "project-f/runtime"

			switch (type) {
				case "a": {
					___createElement(___p, "div")
					break
				}
				case Something.whatever: {
					___createElement(___p, "span")
				}
				default: {
					___createElement(___p, "h1")
					break
				}
			}
		`],

		['nonreactive, nonempty default: lone', true, SwitchBlock(LiveCode(false, 'type'), [
			SwitchCase(false, LiveCode(false, '"a"'), [emptyDiv()]),
			SwitchCase(true, LiveCode(false, 'Something.whatever'), [emptySpan()]),
			SwitchDefault(false, [emptyH1()]),
		]), `
			import { createElement as ___createElement } from "project-f/runtime"

			switch (type) {
				case "a": {
					___createElement(___p, "div")
					break
				}
				case Something.whatever: {
					___createElement(___p, "span")
				}
				default: {
					___createElement(___p, "h1")
					break
				}
			}
		`],


		['reactive, no default', false, SwitchBlock(LiveCode(true, 'type'), [
			SwitchCase(false, LiveCode(false, '"a"'), [emptyDiv()]),
			SwitchCase(true, LiveCode(false, 'Something.whatever'), [emptySpan()]),
		]), `
			import { createElement as ___createElement, exhaustive as ___exhaustive, rangeEffect as ___rangeEffect } from "project-f/runtime"

			___rangeEffect((___real, ___parent) => {
				switch (type.r()) {
					case "a": {
						___createElement(___parent, "div")
						break
					}
					case Something.whatever: {
						___createElement(___parent, "span")
					}
					default: ___exhaustive(type.r())
				}
			}, ___r, ___p)
		`],

		// in both these reactive cases with no default
		// in real usage these wouldn't type check, but that's fine since this isn't correct
		// they need to assign their switch expression to something first
		['reactive, no default, empty case', false, SwitchBlock(LiveCode(true, 'type'), [
			SwitchCase(true, LiveCode(false, '"a"'), [emptyDiv()]),
			SwitchCase(false, LiveCode(false, 'Something.whatever'), []),
		]), `
			import { createElement as ___createElement, exhaustive as ___exhaustive, rangeEffect as ___rangeEffect } from "project-f/runtime"

			___rangeEffect((___real, ___parent) => {
				switch (type.r()) {
					case "a": {
						___createElement(___parent, "div")
					}
					case Something.whatever: { break }
					default: ___exhaustive(type.r())
				}
			}, ___r, ___p)
		`],

		['reactive, empty default', false, SwitchBlock(LiveCode(true, 'type'), [
			SwitchCase(true, LiveCode(false, '"a"'), [emptyDiv()]),
			SwitchCase(false, LiveCode(false, 'Something.whatever'), [emptySpan()]),
			SwitchDefault(false, []),
		]), `
			import { createElement as ___createElement, rangeEffect as ___rangeEffect } from "project-f/runtime"

			___rangeEffect((___real, ___parent) => {
				switch (type.r()) {
					case "a": {
						___createElement(___parent, "div")
					}
					case Something.whatever: {
						___createElement(___parent, "span")
						break
					}
					default: { break }
				}
			}, ___r, ___p)
		`],

		['reactive, nonempty default', false, SwitchBlock(LiveCode(true, 'type'), [
			SwitchCase(true, LiveCode(false, '"a"'), [emptyDiv()]),
			SwitchCase(true, LiveCode(false, 'Something.whatever'), [emptySpan()]),
			SwitchDefault(true, [emptyH1()]),
		]), `
			import { createElement as ___createElement, rangeEffect as ___rangeEffect } from "project-f/runtime"

			___rangeEffect((___real, ___parent) => {
				switch (type.r()) {
					case "a": {
						___createElement(___parent, "div")
					}
					case Something.whatever: {
						___createElement(___parent, "span")
					}
					default: {
						___createElement(___parent, "h1")
					}
				}
			}, ___r, ___p)
		`],

		['reactive assign, no default, empty case', false, SwitchBlock(AssignedLiveCode('ty', 'type'), [
			SwitchCase(true, LiveCode(false, '"a"'), [emptyDiv()]),
			SwitchCase(false, LiveCode(false, 'Something.whatever'), []),
		]), `
			import { createElement as ___createElement, exhaustive as ___exhaustive, rangeEffect as ___rangeEffect } from "project-f/runtime"

			___rangeEffect((___real, ___parent) => {
				const ty = type.r()
				switch (ty) {
					case "a": {
						___createElement(___parent, "div")
					}
					case Something.whatever: { break }
					default: ___exhaustive(ty)
				}
			}, ___r, ___p)
		`],

		['reactive assign, no default, empty case: lone', true, SwitchBlock(AssignedLiveCode('ty', 'type'), [
			SwitchCase(true, LiveCode(false, '"a"'), [emptyDiv()]),
			SwitchCase(false, LiveCode(false, 'Something.whatever'), []),
		]), `
			import { createElement as ___createElement, exhaustive as ___exhaustive, contentEffect as ___contentEffect } from "project-f/runtime"

			___contentEffect((___real, ___parent) => {
				const ty = type.r()
				switch (ty) {
					case "a": {
						___createElement(___parent, "div")
					}
					case Something.whatever: { break }
					default: ___exhaustive(ty)
				}
			}, ___r)
		`],
	]

	for (const [description, lone, block, generated] of cases)
		it(description, () => {
			const context = ctx()
			const nodes = generateSwitchBlock(block, '0', lone, context, ...namedParentIdents('r', 'p'))
			boilEqual(context.finalize(nodes), generated)
		})
})


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
				TemplateDefinition('greeting', expression, [TextSection(TextItem(LivenessType.static, 'hello'))]),
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
