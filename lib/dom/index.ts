import { effect, statefulEffect, Mutable, Immutable } from '../reactivity'
import { NonEmpty, NonLone, Overwrite, KeysOfType, Falsey } from '../utils'


export function createElement<K extends keyof HTMLElementTagNameMap>(
	parent: Node,
	tagName: K,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tagName)
  parent.appendChild(el)
  return el
}
export function createElementClass<K extends keyof HTMLElementTagNameMap>(
	parent: Node,
	tagName: K,
	className: string
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tagName)
  el.className = className
  parent.appendChild(el)
  return el
}
export function createElementClasses<K extends keyof HTMLElementTagNameMap>(
	parent: Node,
	tagName: K,
	...classes: (string | Falsey)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tagName)
  el.className = classes.filter(c => !!c).join(' ')
  parent.appendChild(el)
  return el
}
export function createElementReactiveClasses(
	parent: Node,
	tagName: K,
	...classes: (Immutable<string | Falsey> | string | Falsey)[]
) {
  const el = document.createElement(tagName)
  parent.appendChild(el)

	const immutables = [] as Immutable<string | Falsey>
	const strings = [] as string[]
	const classesLength = classes.length
	for (let index = 0; index < classesLength; index++) {
		const item = classes[index]
		if (!item) continue
		if (typeof item === 'string') strings.push(item)
		else immutables.push(item)
	}
	const staticClassName = strings.join(' ')
	watchArray(immutables, values => {
		el.className = staticClassName + ' ' + values.filter(c => !!c).join(' ')
	})

  return el
}

export function createTextNode(
	parent: Node,
	content: string,
): Text {
	const el = document.createTextNode(content)
	parent.appendChild(el)
	return el
}


const svgNS = 'http://www.w3.org/2000/svg' as const
export function createSvg<K extends keyof SVGElementTagNameMap>(
	parent: Node,
	svgName: K,
): SVGElementTagNameMap[K] {
	const el = document.createElementNS(svgNS, svgName)
	parent.appendChild(el)
  return el
}

export function syncTextElement(
	textElement: HTMLInputElement | HTMLTextAreaElement,
	text: Mutable<string>,
) {
	textElement.oninput = $event => {
		text(($event.target as typeof textElement).value)
	}
	effect(() => {
		textElement.value = text()
	})
}

export function syncCheckboxElement(
	checkbox: HTMLInputElement,
	checked: Mutable<boolean>,
) {
	checkbox.onchange = $event => {
		checked(($event.target as typeof checkbox).checked)
	}
	effect(() => {
		checkbox.checked = checked()
	})
}
// export function syncCheckboxElementOnOff<T>(
// 	checkbox: HTMLInputElement,
// 	value: Mutable<T>,
// 	on: T, off: T,
// ) {
// 	checkbox.onchange = $event => {
// 		value(($event.target as typeof checkbox).checked ? on : off)
// 	}
// 	effect(() => {
// 		checkbox.checked = value() === on
// 	})
// }
// export function syncGroupCheckboxElement(checkbox: HTMLInputElement, group: Mutable<string[]>) {
// 	checkbox.onchange = $event => {
// 		const value = ($event.target as typeof checkbox).value
// 		const current = group()
// 		const index = current.indexOf(value)
// 		if (index >= 0) {
// 			current.splice(index, 1)
// 			group(current)
// 		}
// 		else {
// 			current.push(value)
// 			group(current)
// 		}
// 	}
// 	effect(() => {
// 		checkbox.checked = group().includes(checkbox.value)
// 	})
// }

export function syncRadioElement(radio: HTMLInputElement, mutable: Mutable<string>, initial: string) {
	radio.value = initial
	radio.onchange = $event => {
		const { checked, value } = $event.target as typeof radio
		if (checked)
			mutable(value)
	}
	effect(() => {
		radio.checked = mutable() === radio.value
	})
}
export function syncRadioElementReactive(radio: HTMLInputElement, mutable: Mutable<string>, value: Immutable<string>) {
	radio.onchange = $event => {
		const target = $event.target as typeof radio
		if (target.checked)
			mutable(target.value)
	}
	effect(() => {
		radio.value = value()
		radio.checked = mutable() === radio.value
		// if (radio.checked)
		// 	link(mutable, value)
		// else
		// 	unlink(mutable, value)
	})
}

export function syncSelectElement(select: HTMLSelectElement, mutable: Mutable<string>) {
	select.onchange = $event => {
		mutable(($event.target as typeof select).value)
	}
	effect(() => {
		const value = mutable()
		for (const child of select.children)
			if (child instanceof HTMLOptionElement)
				child.selected = value === child.value
			else if (child instanceof HTMLOptGroupElement)
				for (const groupChild of child.children)
					if (groupChild instanceof HTMLOptionElement)
						groupChild.selected = value === groupChild.value
	})
}
export function syncSelectMultipleElement(select: HTMLSelectElement, mutable: Mutable<string[]>) {
	select.onchange = $event => {
		const values = []
		const target = $event.target as typeof select
		for (const child of target.children)
			if (child instanceof HTMLOptionElement && child.selected)
				values.push(child.value)
			else if (child instanceof HTMLOptGroupElement)
				for (const groupChild of child.children)
					if (groupChild instanceof HTMLOptionElement && groupChild.selected)
						values.push(groupChild.value)
		mutable(values)
	}
	effect(() => {
		const values = mutable()
		for (const child of select.children)
			if (child instanceof HTMLOptionElement)
				child.selected = values.includes(child.value)
			else if (child instanceof HTMLOptGroupElement)
				for (const groupChild of child.children)
					if (groupChild instanceof HTMLOptionElement)
						groupChild.selected = values.includes(groupChild.value)
	})
}

export function bindProperty<T, K extends keyof T>(obj: T, key: K, value: Immutable<T[K]>) {
	watch(value, (value, obj, key) => {
		obj[key] = value
	}, obj, key)
}

export function syncElementAttribute<E extends HTMLElement, KA extends keyof E>(
	element: E, event: KeysOfType<E, ((this: GlobalEventHandlers, ev: Event) => unknown) | null>,
	attribute: KA, mutable: Mutable<E[KA]>,
) {
	element[event as keyof E] = (($event: Event) => {
		mutable(($event.target as typeof element)[attribute])
	}) as any
	effect(() => {
		element[attribute] = mutable()
	})
}


export const enum DisplayType { empty, text, node, many }

// numbers and booleans are notably absent, pipe them through a string renderer first
// we might want to allow the array variant to contain null | undefined | string as well
// either that or we simply control for emptiness at the level of the @each directive?
export type Displayable = null | undefined | string | Node | Node[]

export type Value =
	| { type: DisplayType.empty, value: undefined }
	| { type: DisplayType.text, value: string }
	| { type: DisplayType.node, value: Node }
	| { type: DisplayType.many, value: NonLone<Node> }

function normalizeDisplayable(value: Displayable): Value {
	// this includes the empty string, which is fine
	if (!value) return { type: DisplayType.empty, value: undefined }
	if (Array.isArray(value)) switch (value.length) {
		case 0: return { type: DisplayType.empty, value: undefined }
		case 1: return { type: DisplayType.node, value: value[0] }
		default: return { type: DisplayType.many, value: value as NonLone<Node> }
	}

	if (typeof value === 'string') return { type: DisplayType.text, value }
	return { type: DisplayType.node, value }
}


export type ContentState =
	| { type: DisplayType.empty, content: undefined }
	| { type: DisplayType.text, content: Text }
	| { type: DisplayType.node, content: Node }
	| { type: DisplayType.many, content: NonLone<Node> }

export class Content {
	constructor(
		public parent: Node,
		public current: ContentState,
	) {}

	swap(replacement: ContentState): this {
		this.current = replacement
		return this
	}
}

export function replaceContent(
	content: Content,
	input: Displayable,
): Content {
	const { parent, current } = content
	const value = normalizeDisplayable(input)
	switch (value.type) {
	case DisplayType.empty: {
		// do nothing
		if (current.type === DisplayType.empty) return content
		clearContent(parent)
		return content.swap({ type: DisplayType.empty, content: undefined })
	}

	case DisplayType.text: {
		const text = value.value
		if (current.type === DisplayType.text) {
			current.content.data = text
			return content
		}

		parent.textContent = text
		// UNSAFE: we assume here that after setting textContent to a string,
		// that immediately afterwards the firstChild will be a Text
		return content.swap({ type: DisplayType.text, content: parent.firstChild as Text })
	}

	case DisplayType.node: {
		const node = value.value
		switch (current.type) {
		case DisplayType.empty:
			parent.appendChild(node)
			return content.swap({ type: DisplayType.node, content: node })
		case DisplayType.many:
			clearContent(parent)
			parent.appendChild(node)
			return content.swap({ type: DisplayType.node, content: node })
		default:
			if (node === current.content)
				return content
			parent.replaceChild(node, current.content)
			return content.swap({ type: DisplayType.node, content: node })
		}
	}

	case DisplayType.many:
		const nodes = value.value
		switch (current.type) {
		case DisplayType.empty:
			return content.swap({ type: DisplayType.many, content: appendAll(parent, nodes) })
		case DisplayType.many:
			return content.swap({ type: DisplayType.many, content: reconcileArrays(parent, current.content, nodes) })
		default:
			const fragment = makeDocumentFragment(nodes)
			parent.replaceChild(fragment, current.content)
			return content.swap({ type: DisplayType.many, content: nodes })
		}
	}
}

export function contentEffect(fn: () => Displayable, parent: Node) {
	const content = new Content(parent, { type: DisplayType.empty, content: undefined })
	const destructor = statefulEffect(current => {
		return replaceContent(current, fn())
	}, content)

	return destructor
}



export type RangeState =
	| { type: DisplayType.empty, item: Comment }
	| { type: DisplayType.text, item: Text }
	| { type: DisplayType.node, item: Node }
	| { type: DisplayType.many, item: RangeMarker }

type RangeMarker = { begin: Comment, end: Comment }

export class Range {
	constructor(
		public realParent: Node,
		public parent: Node,
		public current: RangeState,
	) {}

	swap(replacement: RangeState): this {
		this.current = replacement
		return this
	}
}

export function replaceRange(
	range: Range,
	input: Displayable,
): Range {
	const value = normalizeDisplayable(input)
	const { parent, current } = range
	switch (value.type) {
	case DisplayType.empty:
		switch (current.type) {
		case DisplayType.empty:
			return range

		case DisplayType.many: {
			const placeholder = new Comment()
			replaceManyWithSingle(parent, current.item, placeholder)
			return range.swap({ type: DisplayType.empty, item: placeholder })
		}

		default:
			const placeholder = new Comment()
			parent.replaceChild(placeholder, current.item)
			return range.swap({ type: DisplayType.empty, item: placeholder })
		}

	case DisplayType.text:
		const str = value.value
		switch (current.type) {
		case DisplayType.text:
			current.item.data = str
			return range

		case DisplayType.many: {
			const text = document.createTextNode(str)
			replaceManyWithSingle(parent, current.item, text)
			return range.swap({ type: DisplayType.text, item: text })
		}

		default:
			const text = document.createTextNode(str)
			parent.replaceChild(text, current.item)
			return range.swap({ type: DisplayType.text, item: text })
		}

	case DisplayType.node: {
		const node = value.value
		range.swap({ type: DisplayType.node, item: node })
		if (current.type === DisplayType.many) {
			replaceManyWithSingle(parent, current.item, node)
			return range
		}

		parent.replaceChild(node, current.item)
		return range
	}

	case DisplayType.many:
		const begin = new Comment('begin')
		const end = new Comment('end')
		const nodes = [begin, ...value.value, end] as NonLone<Node>
		range.swap({ type: DisplayType.many, item: { begin, end } })
		if (current.type === DisplayType.many) {
			// reconcileArrays(parent, current.item, nodes)
			// TODO this needs to properly reconcile the arrays to reuse nodes
			const { begin, end } = current.item
			removeAllAfter(begin, end)
			parent.replaceChild(makeDocumentFragment(nodes), begin)
			return range
		}

		const fragment = makeDocumentFragment(nodes)
		parent.replaceChild(fragment, current.item)
		return range
	}
}


export function rangeEffect(
	fn: (realParent: Node, container: DocumentFragment) => void,
	realParent: Node,
	container?: DocumentFragment,
) {
	const placeholder = new Comment()
	const range = new Range(realParent, container, { type: DisplayType.empty, item: placeholder })
	container.appendChild(placeholder)

	// TODO it might be worth inlining the creation of the actual StatefulComputation here
	const destructor = statefulEffect((range, destroy) => {
		const container = document.createDocumentFragment()
		fn(range.realParent, container)

		// normalizing contents of the fragment that the sub function appended, and performing the actual replaceRange
		// in the future, we'll instead simply reconcile the fragment against current directly?
		// or rather, replaceRange will take a fragment and normalize based on its length rather than a union
		switch (container.childNodes.length) {
		case 0:
			return replaceRange(range, undefined)
		case 1:
			return replaceRange(range, container.childNodes[0])
		default:
			const nodes = []
			for (const node of container.childNodes)
				nodes.push(node)
			return replaceRange(range, nodes as unknown as NonLone<Node>)
		}
	}, range)

	// after initializing the effect, from this point on it will be safe to give it real access to the parent
	// since this whole render cycle is synchronous, the reactive updates can't happen until we've finished the tree
	// and performed the final append to put the tree into the real parent
	// this nicely prevents wasteful operations, since we only have to perform this "flattening" once
	// and don't have to maintain some allocated collection to do so
	range.parent = realParent

	return destructor
}


// export function contentEffect(fn: (realParent: Node, container: DocumentFragment) => void, realParent: Node) {
// 	const content = new Content(realParent, { type: DisplayType.empty, content: undefined })

// 	const destructor = statefulEffect((content, destroy) => {
// 		const container = document.createDocumentFragment()
// 		fn(content.parent, container)

// 		// don't normalize here, eventually this will be moved
// 		switch (container.childNodes.length) {
// 		case 0:
// 			return replaceContent(content, undefined)
// 		case 1:
// 			return replaceContent(content, container.childNodes[0])
// 		default:
// 			const nodes = []
// 			for (const node of container.childNodes)
// 				nodes.push(node)
// 			return replaceContent(content, nodes as unknown as NonLone<Node>)
// 		}
// 		// return replaceContent(content, container)
// 	}, content)

// 	return destructor
// }


function replaceManyWithSingle(parent: Node, { begin, end }: RangeMarker, node: Node) {
	removeAllAfter(begin, end)
	parent.replaceChild(node, begin)
}


// TODO this is a dumb version for now
export function reconcileArrays(
	parent: Node,
	existing: NonLone<Node>,
	values: NonLone<Node>,
) {
	const first = existing[0]
	const last = existing[existing.length - 1]
	removeAllAfter(first, last)
	parent.replaceChild(makeDocumentFragment(values), first)
	return values
}


export function removeAllAfter(start: Node, end: Node) {
	const range = document.createRange()
	range.setStartAfter(start)
	range.setEndAfter(end)
	range.deleteContents()
}

export function makeDocumentFragment(nodes: NonLone<Node>) {
	const fragment = document.createDocumentFragment()
	for (const node of nodes)
		fragment.appendChild(node)
	return fragment
}

export function appendAll(parent: Node, nodes: NonLone<Node>): NonLone<Node> {
	const fragment = document.createDocumentFragment()
	for (const node of nodes)
		fragment.appendChild(node)

	parent.appendChild(fragment)
	return nodes
}

export function clearContent(node: Node) {
	node.textContent = ''
}
