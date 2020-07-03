// it('sync of incorrect binding on input tag', () => {
	// 	for (const attribute of ['!anything', '!incorrect', '!notsync'])
	// 		expect(() => generateTag(Tag(
	// 			'input', [],
	// 			[Attribute(attribute, AttributeCode(true, 'doit'))], [],
	// 		), '0', ctx(), realParent, parent)).throw()
	// })

	// it('sync on non-input tag', () => {
	// 	for (const attribute of ['!anything', '!sync', '!sync|fake'])
	// 		expect(() => generateTag(Tag(
	// 			'div', [],
	// 			[Attribute(attribute, AttributeCode(true, 'doit'))], [],
	// 		), '0', ctx(), realParent, parent)).throw()
	// })

	// const throwCases: [string, Attribute][] = [
	// 	['handler event modifier with bare code', Attribute('@click|handler', AttributeCode(true, 'doit'))],
	// 	['duplicate modifier', Attribute('@click|handler|handler', AttributeCode(true, 'doit'))],
	// 	['any modifiers on empty attribute', Attribute('anything|whatever', undefined)],
	// 	['any modifiers on static attribute', Attribute('anything|whatever', "doesn't matter")],
	// 	['any modifiers on reactive attribute', Attribute(':anything|whatever', AttributeCode(true, 'doit'))],
	// 	['any modifiers on node receiver', Attribute('(fn)|whatever', AttributeCode(true, 'doit'))],
	// 	['parentheses used as anything other than (fn)', Attribute('(notfn)', AttributeCode(true, 'doit'))],
	// ]

	// for (const [description, attribute] of throwCases)
	// 	it(description, () => {
	// 		expect(() => generateTag(Tag('div', [], [attribute], []), '0', ctx(), realParent, parent)).throw()
	// 	})

	// for (const [type, attribute] of [['reactive', ':a'], ['sync', '!a'], ['event', '@a'], ['receiver', '(fn)']]) {
	// 	it(`empty for ${type}`, () => {
	// 		expect(() => generateTag(Tag(
	// 			'div', [],
	// 			[Attribute(attribute, undefined)], [],
	// 		), '0', ctx(), realParent, parent)).throw()
	// 	})

	// 	it(`static for ${type}`, () => {
	// 		expect(() => generateTag(Tag(
	// 			'div', [],
	// 			[Attribute(attribute, "something static")], [],
	// 		), '0', ctx(), realParent, parent)).throw()
	// 	})
	// }

	// for (const [type, attribute] of [['dynamic', 'a'], ['sync', '!a'], ['event', '@a']])
	// 	it(`invalid modifier for ${type}`, () => {
	// 		expect(() => generateTag(Tag(
	// 			'div', [],
	// 			[Attribute(attribute + '|invalidmodifier', AttributeCode(true, 'code'))], [],
	// 		), '0', ctx(), realParent, parent)).throw()
	// 	})

	// for (const [type, attribute] of [['static', 'a'], ['reactive', ':a'], ['sync', '!a']])
	// 	it(`duplicate binding against ${type}`, () => {
	// 		expect(() => generateTag(Tag(
	// 			'div', [],
	// 			[Attribute('a', AttributeCode(true, 'code')), Attribute(attribute, AttributeCode(true, 'w'))], [],
	// 		), '0', ctx(), realParent, parent)).throw()
	// 	})


// const throwCases: [string, ComponentInclusion][] = [
	// 	['node receivers on components', ComponentInclusion('Comp', [
	// 		Attribute('(fn)', AttributeCode(true, 'doit')),
	// 	], [])],
	// 	['sync, fake and setter together', ComponentInclusion('Comp', [
	// 		Attribute('!y|fake|setter', AttributeCode(true, 'doit')),
	// 	], [])],
	// 	['duplicate event handlers on components', ComponentInclusion('Comp', [
	// 		Attribute('@msg', AttributeCode(true, 'first')),
	// 		Attribute('@msg', AttributeCode(true, 'second')),
	// 	], [])],
	// 	['mixing orphaned entities with an explicit default slot insert', ComponentInclusion('Comp', [], [
	// 		emptyDiv(),
	// 		SlotInsertion(undefined, undefined, [emptyH1()]),
	// 	])],
	// 	['duplicate slot insert', ComponentInclusion('Comp', [], [
	// 		emptyDiv(),
	// 		SlotInsertion('a', undefined, [emptyH1()]),
	// 		SlotInsertion('a', undefined, [emptySpan()]),
	// 	])],
	// ]

	// for (const [description, inclusion] of throwCases)
	// 	it(description, () => {
	// 		expect(() => generateComponentInclusion(inclusion, ctx(), realParent, parent)).throw()
	// 	})




// const throwCases: [string, SwitchBlock][] = [
	// 	['reactive assign, no default, empty case', SwitchBlock(AssignedLiveCode('ty', 'type'), [
	// 		SwitchCase(true, LiveCode(false, '"a"'), [emptyDiv()]),
	// 		SwitchDefault(true, [emptyDiv()]),
	// 		SwitchCase(false, LiveCode(false, 'Something.whatever'), []),
	// 		SwitchDefault(false, []),
	// 	])],
	// ]

	// for (const [description, block] of throwCases)
	// 	it(description, () => {
	// 		expect(() => generateSwitchBlock(block, '0', false, ctx(), ...namedParentIdents('r', 'p'))).throw()
	// 	})



// const throwCases: [string, ComponentDefinition][] = [
	// 	['required slot, has fallback', ComponentDefinition([], [], [], { s: false }, [], [
	// 		emptyDiv(),
	// 		SlotUsage('s', undefined, [emptyDiv()]),
	// 	])],
	// 	['usage of an undefined slot', ComponentDefinition([], [], [], { s: false }, [], [
	// 		SlotUsage('a', undefined, undefined),
	// 	])],
	// ]

	// for (const [description, definition] of throwCases)
	// 	it(description, () => {
	// 		expect(() => generateComponentDefinition(definition)).throw()
	// 	})
