import { setAttribute } from './dom'
import { getFieldData, FieldData, FieldFlags } from './fieldData'
import { setAttributeNS } from './index'

export type PropObj = { [ name: string ]: any }

export function assign(a: PropObj, b: PropObj) {
	const props = Object.keys(b)
	for (let i = 0, len = props.length; i < len; i++) {
		const name = props[i]
		a[name] = b[name]
	}
}

export function spread(node: HTMLElement, obj: PropObj, svg: boolean) {
	const props = Object.keys(obj)
	for (let i = 0, len = props.length; i < len; i++) {
		const name = props[i]
		setField(node, name, obj[name], svg)
	}
}

function setField(node: HTMLElement | SVGElement, field: string, value: any, svg: boolean) {
	const [name, namespace, flags] = getFieldData(field, svg)
	const type = flags & FieldFlags.Type
	if (type === FieldFlags.Property) {
		if (namespace) node = (node as any)[namespace];
		(node as any)[name] = value
	}
	else if (type === FieldFlags.Attribute)
		if (namespace) setAttributeNS(node, namespace, name, value)
		else setAttribute(node, name, value)
	else if (type === FieldFlags.Assign)
		if (value && typeof value === 'object') assign(node.style, value)
}
