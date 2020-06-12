// import { statefulEffect, Mutable, Immutable } from '../reactivity'

export function clearContent(node: Node) {
	node.textContent = ''
}

export function removeAllAfter(start: Node, end: Node) {
	const range = document.createRange()
	range.setStartAfter(start)
	range.setEndAfter(end)
	range.deleteContents()
}

export function replaceManyWithSingle(parent: Node, { begin, end }: RangeMarker, node: Node) {
	removeAllAfter(begin, end)
	parent.replaceChild(node, begin)
}

// TODO this is a dumb version for now
export function reconcileNodes(parent: Node, fragment: DocumentFragment) {
	const begin = parent.childNodes[0]
	const end = parent.childNodes[parent.childNodes.length - 1]
	removeAllAfter(begin, end)
	parent.replaceChild(fragment, begin)
	// let parentCurrent = parent.firstChild
	// let fragmentCurrent = fragment.firstChild
	// while (parentCurrent && fragmentCurrent) {
	// 	//
	// }
}

// TODO this is a dumb version for now
export function reconcileRanges(
	parent: Node,
	fragment: DocumentFragment,
	{ begin, end }: RangeMarker,
) {
	removeAllAfter(begin, end)
	parent.replaceChild(fragment, begin)
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

// export function contentEffect(fn: (realParent: Node, fragment: DocumentFragment) => void, realParent: Node) {
// 	const content = new Content(realParent, { type: DisplayType.empty, content: undefined })

// 	const destructor = statefulEffect((content, destroy) => {
// 		const fragment = document.createDocumentFragment()
// 		fn(content.parent, fragment)

// 		return replaceContent(content, fragment)
// 	}, content)

// 	return destructor
// }

export function replaceContent(
	content: Content,
	fragment: DocumentFragment,
): Content {
	const { parent, current } = content
	const nodes = fragment.childNodes
	switch (nodes.length) {
	case 0: {
		// do nothing
		if (current === DisplayType.empty) return content
		clearContent(parent)
		return content.swap(DisplayType.empty)
	}

	case 1: {
		const inputNode = nodes[0]
		// inputNode.nodeType = TEXT_NODE = 3
		if (inputNode instanceof Text) {
			const text = inputNode.data
			// if (current === DisplayType.text) {
			if (current instanceof Text) {
				current.data = text
				return content
			}

			parent.textContent = text
			// UNSAFE: we assume here that after setting textContent to a string,
			// that immediately afterwards the firstChild will be a Text
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
			if (inputNode === current)
				return content
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
	| { type: DisplayType.empty, item: Comment }
	| { type: DisplayType.text, item: Text }
	| { type: DisplayType.node, item: Node }
	| { type: DisplayType.many, item: RangeMarker }

export type RangeMarker = { begin: Node, end: Node }

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

// export function rangeEffect(
// 	fn: (realParent: Node, fragment: DocumentFragment) => void,
// 	realParent: Node,
// 	fragment: DocumentFragment,
// ) {
// 	const placeholder = new Comment()
// 	const range = new Range(realParent, fragment, { type: DisplayType.empty, item: placeholder })
// 	fragment.appendChild(placeholder)

// 	// TODO it might be worth inlining the creation of the actual StatefulComputation here
// 	const destructor = statefulEffect((range, destroy) => {
// 		const fragment = document.createDocumentFragment()
// 		fn(range.realParent, fragment)

// 		return replaceRange(range, fragment)
// 	}, range)

// 	// after initializing the effect, from this point on it will be safe to give it real access to the parent
// 	// since this whole render cycle is synchronous, the reactive updates can't happen until we've finished the tree
// 	// and performed the final append to put the tree into the real parent
// 	// this nicely prevents wasteful operations, since we only have to perform this "flattening" once
// 	// and don't have to maintain some allocated collection to do so
// 	range.parent = realParent

// 	return destructor
// }

export function replaceRange(
	range: Range,
	fragment: DocumentFragment,
): Range {
	const { parent, current } = range
	const nodes = fragment.childNodes
	switch (nodes.length) {
	case 0:
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

	case 1: {
		const node = nodes[0]
		if (node instanceof Text) {
			const str = node.data
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
		}

		range.swap({ type: DisplayType.node, item: node })
		if (current.type === DisplayType.many) {
			replaceManyWithSingle(parent, current.item, node)
			return range
		}

		parent.replaceChild(node, current.item)
		return range
	}

	default:
		range.swap({ type: DisplayType.many, item: { begin: nodes[0], end: nodes[nodes.length - 1] } })
		if (current.type === DisplayType.many) {
			reconcileRanges(parent, fragment, current.item)
			return range
		}

		parent.replaceChild(fragment, current.item)
		return range
	}
}
