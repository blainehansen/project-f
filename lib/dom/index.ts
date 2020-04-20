import { Panic, NonEmpty, NonLone, Overwrite } from '../utils'

// export function createElement<K extends keyof HTMLElementTagNameMap>(
// 	parent: Node,
// 	tagName: K,
// ): HTMLElementTagNameMap[K] {
//   const el = document.createElement(tagName)
//   parent.appendChild(el)
//   return el
// }

// export function createTextNode(
// 	parent: Node,
// 	content: string,
// ): Text {
// 	const el = document.createTextNode(content)
// 	parent.appendChild(el)
// 	return el
// }

// const svgNS = 'http://www.w3.org/2000/svg' as const
// export function createSvg<K extends keyof SVGElementTagNameMap>(
// 	parent: Node,
// 	svgName: K,
// ): SVGElementTagNameMap[K] {
// 	const el = document.createElementNS(svgNS, svgName)
// 	parent.appendChild(el)
//   return el
// }

// cases for begin/end (therefore implied "from many"):
// # distinct
// - set to empty: parent.replaceChild(Comment, begin); range.deleteContents(Comment, end)
// - set to single: parent.replaceChild(node, begin); range.deleteContents(node, end)
// - set to many: complex array reconciliation

// # null begin or end, simply default their usage above with parent.firstChild and parent.lastChild

// # both null (dealing with entire parent contents)
// - set to empty: textContent = ''
// - set to single: parent.appendChild(node)
// - set to many: complex array reconciliation

export const enum DisplayType { empty, text, node, many }

// numbers and booleans are notably absent, pipe them through a string renderer first
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

export function replaceContent(
	parent: Node,
	current: ContentState,
	input: Displayable,
): ContentState {
	const value = normalizeDisplayable(input)
	switch (value.type) {
	case DisplayType.empty: {
		// do nothing
		if (current.type === DisplayType.empty) return current
		clearContent(parent)
		return { type: DisplayType.empty, content: undefined }
	}

	case DisplayType.text: {
		const text = value.value
		if (current.type === DisplayType.text) {
			current.content.data = text
			return current
		}

		parent.textContent = text
		// UNSAFE: we assume here that after setting textContent to a string,
		// that immediately afterwards the firstChild will be a Text
		return { type: DisplayType.text, content: parent.firstChild as Text }
	}

	case DisplayType.node: {
		const node = value.value
		switch (current.type) {
		case DisplayType.empty:
			parent.appendChild(node)
			return { type: DisplayType.node, content: node }
		case DisplayType.many:
			clearContent(parent)
			parent.appendChild(node)
			return { type: DisplayType.node, content: node }
		default:
			if (node === current.content)
				return current
			parent.replaceChild(node, current.content)
			return { type: DisplayType.node, content: node }
		}
	}

	case DisplayType.many:
		const nodes = value.value
		switch (current.type) {
		case DisplayType.empty:
			return { type: DisplayType.many, content: appendAll(parent, nodes) }
		case DisplayType.many:
			return { type: DisplayType.many, content: reconcileArrays(parent, current.content, nodes) }
		default:
			const fragment = makeDocumentFragment(nodes)
			parent.replaceChild(fragment, current.content)
			return { type: DisplayType.many, content: nodes }
		}
	}
}


export type Range =
	| { parent: Node | undefined, type: DisplayType.empty, item: Comment }
	| { parent: Node | undefined, type: DisplayType.text, item: Text }
	| { parent: Node | undefined, type: DisplayType.node, item: Node }
	| { parent: Node | undefined, type: DisplayType.many, item: NonLone<Node> }

export type ParentedRange =
	| { parent: Node, type: DisplayType.empty, item: Comment }
	| { parent: Node, type: DisplayType.text, item: Text }
	| { parent: Node, type: DisplayType.node, item: Node }
	| { parent: Node, type: DisplayType.many, item: NonLone<Node> }

// export type ParentedRange = Range extends Range ? Overwrite<Range, { parent: Node }> : never

class UnattachedNodePanic extends Panic {
 	constructor() { super("unattached node") }
}

function normalizeRange(range: Range): ParentedRange {
	const maybeParent = range.parent
	const parent = range.parent || (
		range.type === DisplayType.many
			? range.item[0].parentNode
			: range.item.parentNode
	)

	if (!parent) throw new UnattachedNodePanic()
	return { ...range, parent }
}

export function replaceRange(
	range: Range,
	input: Displayable,
): ParentedRange {
	const value = normalizeDisplayable(input)
	const current = normalizeRange(range)
	const parent = current.parent
	switch (value.type) {
	case DisplayType.empty:
		switch (current.type) {
		case DisplayType.empty:
			return current
		case DisplayType.many: {
			const placeholder = new Comment()
			replaceManyWithSingle(parent, current.item, placeholder)
			return { parent, type: DisplayType.empty, item: placeholder }
		}

		default:
			const placeholder = new Comment()
			parent.replaceChild(placeholder, current.item)
			return { parent, type: DisplayType.empty, item: placeholder }
		}

	case DisplayType.text:
		const str = value.value
		switch (current.type) {
		case DisplayType.text:
			current.item.data = str
			return current
		case DisplayType.many: {
			const text = document.createTextNode(str)
			replaceManyWithSingle(parent, current.item, text)
			return { parent, type: DisplayType.text, item: text }
		}

		default:
			const text = document.createTextNode(str)
			parent.replaceChild(text, current.item)
			return { parent, type: DisplayType.text, item: text }
		}

	case DisplayType.node: {
		const node = value.value
		const content = { parent, type: DisplayType.node, item: node } as ParentedRange
		if (current.type === DisplayType.many) {
			replaceManyWithSingle(parent, current.item, node)
			return content
		}

		parent.replaceChild(node, current.item)
		return content
	}

	case DisplayType.many:
		const nodes = value.value
		const content = { parent, type: DisplayType.many, item: nodes } as ParentedRange
		if (current.type === DisplayType.many) {
			reconcileArrays(parent, current.item, nodes)
			return content
		}

		const fragment = makeDocumentFragment(nodes)
		parent.replaceChild(fragment, current.item)
		return content
	}
}


function replaceManyWithSingle(parent: Node, current: NonLone<Node>, node: Node) {
	const first = current[0]
	const last = current[current.length - 1]
	removeAllAfter(first, last)
	parent.replaceChild(node, first)
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
