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

// export type Refs<C> = C extends { refs: Dict<any> }
// 	? {
// 		[K in keyof C['refs']]:
// 			C['refs'][K] extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[C['refs'][K]]
// 			: C['refs'][K] extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[C['refs'][K]]
// 			: never
// 	}
// 	: {}

// export type Args<C> = Props<C> & Syncs<C> & Events<C> & Refs<C>
export type Args<C> = Props<C> & Syncs<C> & Events<C>

export type Insertable<A extends any[]> = (realParent: Node, parent: DocumentFragment, ...args: A) => void
// export type ComponentDefinition<C> = Insertable<[Props<C>, Syncs<C>, Events<C>, Refs<C>, Slots<C>]>
export type ComponentDefinition<C> = Insertable<[Props<C>, Syncs<C>, Events<C>, Slots<C>]>

export function mount(component: ComponentDefinition<{}>, parent: Node) {
	const container = document.createDocumentFragment()
	component(parent, container, {}, {}, {}, {})
	parent.appendChild(container)
}
