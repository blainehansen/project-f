import { Panic, NonEmpty, NonLone, Overwrite } from '../utils'

import { statefulEffect } from '../reactivity'

export function createElement<K extends keyof HTMLElementTagNameMap>(
	parent: Node,
	tagName: K,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tagName)
  parent.appendChild(el)
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


export function rangeEffect(fn: (realParent: Node, container: DocumentFragment) => void, realParent: Node, container: DocumentFragment) {
	const placeholder = new Comment()
	const range = new Range(realParent, container, { type: DisplayType.empty, item: placeholder })
	container.appendChild(placeholder)

	// TODO it might be worth inlining the creation of the actual StatefulComputation here
	const destructor = statefulEffect((range, destroy) => {
		const fragment = document.createDocumentFragment()
		fn(range.realParent, fragment)

		// normalizing contents of the fragment that the sub function appended, and performing the actual replaceRange
		// in the future, we'll instead simply reconcile the fragment against current directly?
		// or rather, replaceRange will take a fragment and normalize based on its length rather than a union
		switch (fragment.childNodes.length) {
		case 0:
			return replaceRange(range, undefined)
		case 1:
			return replaceRange(range, fragment.childNodes[0])
		default:
			const nodes = []
			for (const node of fragment.childNodes)
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
