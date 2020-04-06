import { NonEmpty, NonLone, NonRedundant } from '../utils'

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


// // simply displayed
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

	if (Array.isArray(current))
		return reconcileContent(parent, current, value)

	return reconcileContent(parent, [current], value)
}

// TODO this is a dumb version for now
export function reconcileContent(
	parent: HTMLElement,
	current: NonEmpty<Node>,
	values: NonLone<string | Node>,
) {
	clearContent(parent)
	return appendAll(parent, values)
}

export function appendAll(parent: HTMLElement, values: NonLone<string | Node>): NonLone<Node> {
	const fragment = new DocumentFragment()
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
