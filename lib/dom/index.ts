import { NonEmpty, NonLone, NonRedundant } from '../utils'

// the most general case is to have a parent, some begin and some end
// we need to be able to
// - quickly delete sequences (we can use range deleteContents for this)
// - quickly add many elements to the sequence (we can use DocumentFragment for this)
// - the next step is quick reconciliation, which is quite complicated

// the begin and end might be the same, in which case we can replaceChild/removeChild
// there might not be a begin or end or both, which means we act on the parent through appends rather than replaces


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



// export const enum ContentStateType { text, single, many }
// export type ContentState =
// 	// no content, perform textContent or just appendChild
// 	| undefined
// 	// text content, replace that text node or its data
// 	| { type: ContentStateType.text, text: Text }
// 	// single node content, replace that node
// 	| { type: ContentStateType.single, node: Node }
// 	// many nodes, reconcile
// 	| { type: ContentStateType.many, nodes: NonLone<Node> }

export type ContentState = undefined | Text | Element | NonLone<Node>
// export type ContentState = { parent: HTMLElement } & ({ type: , undefined | Text | Element | NonLone<Node> })

// // numbers and booleans are notably absent, since displaying them is probably a mistake
// // pipe them through a simple string transformer first
// export type BaseDisplayable = string | Node

// export type Displayable =
// 	// nothing displays
// 	| null | undefined
// 	| BaseDisplayable
// 	// here we enforce that
// 	| NonLone<BaseDisplayable>[]
// 	// // the function is called
// 	// // NOTE: this might be a reactive function?
// 	// | () => BaseDisplayable | NonLone<BaseDisplayable>[]

// export type Displayable = string | NonRedundant<Node>
export type Displayable = null | undefined | string | Element | NonLone<Node>

export function replaceContent(
	parent: HTMLElement,
	value: Displayable,
	current: ContentState,
): ContentState {
	if (value === undefined || value === null || value === '') {
		// do nothing
		if (current === undefined) return current

		clearContent(parent)
		return undefined
	}

	if (typeof value === 'string') {
		if (current instanceof Text) {
			current.data = value
			return current
		}

		parent.textContent = value
		// UNSAFE: we assume here that after setting textContent to a string,
		// that immediately afterwards the firstChild will be a Text
		return parent.firstChild as Text
	}

	if (value instanceof Element) {
		if (current === undefined)
			return parent.appendChild(value)
		if (Array.isArray(current)) {
			// UNSAFE: since we're setting textContent to a string
			// the parent will possibly have a firstChild of Text,
			// appendChild will leave the parent with two children instead of one
			clearContent(parent)
			return parent.appendChild(value)
		}

		// this handles both the Text and Element cases
		parent.replaceChild(value, current)
		return value
	}

	// value: NonLone<Node>
	if (current === undefined)
		return appendAll(parent, value)

	return reconcileArrays(parent, Array.isArray(current) ? current : [current], value)
}

// TODO this is a dumb version for now
export function reconcileArrays(
	parent: HTMLElement,
	existing: NonEmpty<Node>,
	values: NonLone<string | Node>,
) {
	const begin = existing[0]
	const end = existing[existing.length - 1]
	removeAllAfter(begin, end)
	parent.removeChild(begin)
	return appendAll(parent, values)
}


export const enum RangeType { empty, single, many }
export type Range =
	| { type: RangeType.empty, placeholder: Comment }
	| { type: RangeType.single, node: Text | Element }
	| { type: RangeType.many, nodes: NonLone<Node> }

export function replaceRange(
	parent: HTMLElement,
	existing: Range,
	value: Displayable,
): Range {
	switch (existing.type) {
	case RangeType.empty: {
		if (value === null || value === undefined || value === '')
			// do nothing
			return existing

		if (Array.isArray(value)) {
			const fragment = document.createDocumentFragment()
			for (const item of value)
				fragment.appendChild(item)

			parent.replaceChild(fragment, existing.placeholder)
			return { type: RangeType.many, nodes: value }
		}

		const newNode = typeof value === 'string' ? document.createTextNode(value) : value
		parent.replaceChild(newNode, existing.placeholder)
		return { type: RangeType.single, node: newNode }
	}

	case RangeType.single: {
		if (value === null || value === undefined || value === '') {
			// replace with nothing
			const placeholder = new Comment()
			parent.replaceChild(placeholder, existing.node)
			return { type: RangeType.empty, placeholder }
		}
		if (value === existing.node)
			return existing

		if (typeof value === 'string') {
			if (existing.node instanceof Text) {
				existing.node.data = value
				return existing
			}

			const newNode = document.createTextNode(value)
			parent.replaceChild(newNode, existing.node)
			existing.node = newNode
			return existing
		}

		if (Array.isArray(value)) {
			parent.replaceChild(makeDocumentFragment(value), existing.node)
			return { type: RangeType.many, nodes: value }
		}

		parent.replaceChild(value, existing.node)
		existing.node = value
		return existing
	}

	case RangeType.many:
		const { nodes } = existing
		const start = nodes[0]
		const end = nodes[nodes.length - 1]

		if (value === null || value === undefined || value === '') {
			const placeholder = new Comment()
			parent.replaceChild(placeholder, start)
			removeAllAfter(placeholder, end)
			return { type: RangeType.empty, placeholder }
		}

		if (Array.isArray(value)) {
			const nodes = reconcileArrays(parent, existing.nodes, value)
			return { type: RangeType.many, nodes }
		}

		const newNode = typeof value === 'string' ? document.createTextNode(value) : value
		parent.replaceChild(newNode, start)
		removeAllAfter(newNode, end)
		return { type: RangeType.single, node: newNode }
	}
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

export function appendAll(parent: HTMLElement, values: NonLone<string | Node>): NonLone<Node> {
	const fragment = document.createDocumentFragment()
	// UNSAFE: loop must add at least two elements
	const nodes = [] as unknown as NonLone<Node>
	for (const value of values) {
		const node = typeof value === 'string'
			? document.createTextNode(value)
			: value
		nodes.push(node)
		fragment.appendChild(node)
	}

	parent.appendChild(fragment)
	return nodes
}


export function clearContent(node: Node) {
	node.textContent = ''
	// node.textContent = null
	// null is what document or CDATA types have
}
