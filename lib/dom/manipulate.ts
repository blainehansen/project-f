import { statefulEffect } from '../reactivity'

export function isText(node: Node): node is Text {
	return node.nodeType === Node.TEXT_NODE
}

export function clearContent(node: Node) {
	node.textContent = ''
}

export function removeAllUntil(start: Node, end: Node) {
	const range = document.createRange()
	range.setStartBefore(start)
	range.setEndBefore(end)
	range.deleteContents()
}

export function replaceManyWithSingle(parent: Node, begin: Node, end: Node, node: Node) {
	removeAllUntil(begin, end)
	parent.insertBefore(node, end)
}

// TODO this is a dumb version for now
export function reconcileNodes(parent: Node, fragment: DocumentFragment) {
	const begin = parent.childNodes[0]
	const end = parent.childNodes[parent.childNodes.length - 1]
	removeAllUntil(begin, end)
	parent.replaceChild(fragment, end)
	// let parentCurrent = parent.firstChild
	// let fragmentCurrent = fragment.firstChild
	// while (parentCurrent && fragmentCurrent) {
	// 	// ...
	// }
}

// TODO this is a dumb version for now
export function reconcileRanges(
	parent: Node,
	fragment: DocumentFragment,
	begin: Node, end: Node,
) {
	removeAllUntil(begin, end)
	parent.insertBefore(fragment, end)
}


export const enum DisplayType { empty, text, node, many }

export type ContentState =
	| DisplayType.empty
	| Text
	| Node
	| DisplayType.many

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

export function isContentText(content: ContentState): content is Text {
	return typeof content === 'object' && content.nodeType === Node.TEXT_NODE
}

export function contentEffect(fn: (realParent: Node, fragment: DocumentFragment) => void, realParent: Node) {
	const content = new Content(realParent, DisplayType.empty)

	const destructor = statefulEffect((content, destroy) => {
		const fragment = document.createDocumentFragment()
		fn(content.parent, fragment)

		return replaceContent(content, fragment)
	}, content)

	return destructor
}

export function replaceContent(
	content: Content,
	fragment: DocumentFragment,
): Content {
	const { parent, current } = content
	const nodes = fragment.childNodes
	switch (nodes.length) {
	case 0: {
		if (current === DisplayType.empty)
			// do nothing
			return content
		clearContent(parent)
		return content.swap(DisplayType.empty)
	}

	case 1: {
		const inputNode = nodes[0]
		if (isContentText(inputNode)) {
			const text = inputNode.data
			if (isContentText(current)) {
				current.data = text
				return content
			}

			parent.textContent = text
			// UNSAFE: we assume here that after setting textContent to a string,
			// that immediately afterwards the firstChild will be a Text
			// note: this assumption is only valid if the above `text` is nonempty
			return content.swap(parent.firstChild as Text)
		}

		switch (current) {
		case DisplayType.empty:
			parent.appendChild(inputNode)
			return content.swap(inputNode)
		case DisplayType.many:
			clearContent(parent)
			parent.appendChild(inputNode)
			return content.swap(inputNode)
		default:
			if (inputNode === current) {
				parent.appendChild(inputNode)
				return content
			}
			parent.replaceChild(inputNode, current)
			return content.swap(inputNode)
		}
	}

	default:
		content.swap(DisplayType.many)
		switch (current) {
		case DisplayType.empty:
			parent.appendChild(fragment)
			return content
		case DisplayType.many:
			reconcileNodes(parent, fragment)
			return content
		default:
			parent.replaceChild(fragment, parent.firstChild!)
			return content
		}
	}
}


export type RangeState =
	| { type: DisplayType.empty }
	| { type: DisplayType.text, item: Text }
	| { type: DisplayType.node, item: Node }
	| { type: DisplayType.many, item: Node }

export class Range {
	constructor(
		readonly endAnchor: Comment,
		readonly realParent: Node,
		public parent: Node,
		public current: RangeState,
	) {}

	swap(replacement: RangeState): this {
		this.current = replacement
		return this
	}
}

export function rangeEffect(
	fn: (realParent: Node, fragment: DocumentFragment) => void,
	realParent: Node,
	fragment: DocumentFragment,
) {
	const endAnchor = new Comment()
	fragment.appendChild(endAnchor)
	const range = new Range(endAnchor, realParent, fragment, { type: DisplayType.empty })

	const destructor = statefulEffect((range, destroy) => {
		const fragment = document.createDocumentFragment()
		fn(range.realParent, fragment)
		return replaceRange(range, fragment)
	}, range)

	// after initializing the effect, from this point on it will be safe to give it real access to the parent
	// since this whole render cycle is synchronous, the reactive updates can't happen until we've finished the tree
	// and performed the final append to put the tree into the real parent
	// this nicely prevents wasteful operations, since we only have to perform this "flattening" once
	// and don't have to maintain some allocated collection to do so
	range.parent = realParent

	return destructor
}

export function replaceRange(
	range: Range,
	fragment: DocumentFragment,
): Range {
	const { endAnchor, parent, current } = range
	const nodes = fragment.childNodes
	switch (nodes.length) {
	case 0:
		switch (current.type) {
		case DisplayType.empty:
			return range
		case DisplayType.many:
			removeAllUntil(current.item, endAnchor)
			break
		default:
			parent.removeChild(current.item)
		}
		return range.swap({ type: DisplayType.empty })

	case 1: {
		const node = nodes[0]
		if (isText(node)) {
			const str = node.data
			switch (current.type) {
			case DisplayType.empty: {
				const text = document.createTextNode(str)
				parent.insertBefore(text, endAnchor)
				return range.swap({ type: DisplayType.text, item: text })
			}

			case DisplayType.text:
				current.item.data = str
				return range

			case DisplayType.many: {
				const text = document.createTextNode(str)
				replaceManyWithSingle(parent, current.item, endAnchor, text)
				return range.swap({ type: DisplayType.text, item: text })
			}

			case DisplayType.node:
				const text = document.createTextNode(str)
				parent.replaceChild(text, current.item)
				return range.swap({ type: DisplayType.text, item: text })
			}
		}

		range.swap({ type: DisplayType.node, item: node })
		switch (current.type) {
		case DisplayType.empty:
			parent.insertBefore(node, endAnchor)
			break
		case DisplayType.many:
			replaceManyWithSingle(parent, current.item, endAnchor, node)
			break
		case DisplayType.node:
			if (node === current.item) {
				parent.insertBefore(node, endAnchor)
				break
			}
		case DisplayType.text:
			parent.replaceChild(node, current.item)
		}
		return range
	}

	default:
		range.swap({ type: DisplayType.many, item: nodes[0] })
		if (current.type === DisplayType.many) {
			reconcileRanges(parent, fragment, current.item, endAnchor)
			return range
		}
		if (current.type === DisplayType.empty) {
			parent.insertBefore(fragment, endAnchor)
			return range
		}

		// either a Text or a Node
		parent.replaceChild(fragment, current.item)
		return range
	}
}
