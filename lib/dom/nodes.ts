import { effect, Mutable, Immutable } from '../reactivity'
import { NonEmpty, NonLone, Overwrite, KeysOfType, Falsey } from '../utils'

export function makeDocumentFragment(nodes: NonLone<Node>) {
	const fragment = document.createDocumentFragment()
	for (const node of nodes)
		fragment.appendChild(node)
	return fragment
}

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
