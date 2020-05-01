import { Dict, TupleLike } from '../utils'
import { Immutable, Mutable } from '../reactivity'


export type Props<C> = C extends { props: Dict<any> }
	? { [K in keyof C['props']]: Immutable<C['props'][K]> }
	: {}

export type Syncs<C> = C extends { syncs: Dict<any> }
	? { [K in keyof C['syncs']]: Mutable<C['syncs'][K]> }
	: {}

export type Events<C> = C extends { events: Dict<any> }
	? {
		[K in keyof C['events']]: TupleLike<C['events'][K]> extends true
			? (...args: C['events'][K]) => void
			: (arg: C['events'][K]) => void
	}
	: {}

export type Slots<C> = C extends { slots: Dict<any> }
	? {
		[K in keyof C['slots']]: TupleLike<C['slots'][K]> extends true
			? Insertable<C['slots'][K]>
			: Insertable<[C['slots'][K]]>
	}
	: {}

export type Args<C> = Props<C> & Syncs<C> & Events<C>

export type Insertable<A extends any[]> = (realParent: Node, parent: DocumentFragment, ...args: A) => void
export type ComponentDefinition<C> = Insertable<[Props<C>, Syncs<C>, Events<C>, Slots<C>]>

// // the final codegen will produce something like this
// const ___Component: ComponentDefinition<Component> = (
// 	___parent, ___initialPlace,
// 	{ p }, { y }, { e }, { s },
// ) => {
// 	const { d } = create({ p, y, e } as Args<Component>)

// 	// all the generated render stuff here
// }
// export default ___Component

// // this is the actual source
// export type Component = {
// 	props: { p: number },
// 	syncs: { y: boolean },
// 	events: { e: string },
// 	slots: { s: string },
// }
// export function create({ p, y, e }: Args<Component>) {
// 	const d = value()
// 	d(a() > 3)

// 	return { d }
// }
