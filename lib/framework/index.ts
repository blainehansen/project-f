// // reactivity types
// const _reactive_brand: unique symbol = Symbol()
// type _reactive_brand = typeof _reactive_brand

// type MutableReactive<T> = ((value: T) => void) & { _reactive_brand: _reactive_brand }
// type ImmutableReactive<T> = (() => T) & { _reactive_brand: _reactive_brand }
// type Reactive<T> = MutableReactive<T> & ImmutableReactive<T>

// type FakeMutable<T> = (value: T) => void
// type FakeImmutable<T> = () => T
// type FakeReactive<T> = FakeMutable<T> & FakeImmutable<T>


// // component
// type HTML = unknown

// type Args = Dict<any>

// // design the input types of components such that the caller can always lie to the callee. it can pass handles that aren't actually reactive or reactively mutable

// // this can or can not be reactive
// type Prop<T> = () => T
// type Props = Dict<Prop<any>>
// type MakeProps<D extends Dict<any>> = { [K in keyof D]: Prop<D[K]> }

// // same here, the caller can lie
// type Sync<T> = ((value: T) => void) & (() => T)
// type Syncs = Dict<Sync<any>>
// type MakeSyncs<D extends Dict<any>> = { [K in keyof D]: Sync<D[K]> }

// type Slot<I extends Dict<any>> = (input: I) => HTML
// type Slots = Dict<Slot<Dict<any>>>
// type MakeSlots<D extends Dict<Dict<any>>> = { [K in keyof D]: Slot<D[K]> }

// type Ev<I extends any[]> = (...args: I) => void
// type Evs = Dict<Ev<any[]>>
// type MakeEvs<D extends Dict<any[]>> = { [K in keyof D]: Ev<D[K]> }

// // it would make a lot of sense to have some sort of EventProxy type that lets you list component types and a list of events that you'll just pass along

// type Component<A extends Args = {}, P extends Props = {}, Y extends Syncs = {}, S extends Slots = {}, E extends Evs = {}> =
// 	(i: A & P, Y: Y, S: S, E: E) => HTML

// class ComponentBuilder<A extends Args, P extends Props, Y extends Syncs, S extends Slots, E extends Evs> {
// 	protected constructor() {}

// 	static build() {
// 		return new ComponentBuilder<{}, {}, {}, {}, {}>()
// 	}
// 	args<NA extends Dict<any> = {}>() {
// 		return this as unknown as ComponentBuilder<NA, P, Y, S, E>
// 	}
// 	props<NP extends Dict<any> = {}>() {
// 		return this as unknown as ComponentBuilder<A, MakeProps<NP>, Y, S, E>
// 	}
// 	syncs<NY extends Dict<any> = {}>() {
// 		return this as unknown as ComponentBuilder<A, P, MakeSyncs<NY>, S, E>
// 	}
// 	slots<NS extends Dict<Dict<any>> = {}>() {
// 		return this as unknown as ComponentBuilder<A, P, Y, MakeSlots<NS>, E>
// 	}
// 	events<NE extends Dict<any[]> = {}>() {
// 		return this as unknown as ComponentBuilder<A, P, Y, S, MakeEvs<NE>>
// 	}

// 	finish<T>(setup: (i: A & P & Y & S & E) => T): Component<A, P, Y, S, E> {
// 		throw new Error()
// 	}
// }


// // there are two types of events:
// // - ones that a component *defines and emits*, which are therefore merely hooks for its parent to subscribe to
// // effectively these are just functions with a "subscriber list"
// // these are really easy an really clean

// // - ones that a component *expects to receive*, and which therefore theoretically can come from anywhere. however, from an architectural standpoint it would be nicer if it only came from the descendents (or at least siblings)
// // these are basically just functions defined on the thing! giving someone else the ability to trigger this event is just giving them a handle to the function
// // these are more tricky. this is the problem state management systems are trying to solve. these are basically carbon actors

// // one way to maybe make this more sane is have some kind of "capability" driven system. design the types of these function handles such that you can only use one if you also have a handle to the entity that created it. This means that the creator has to explicitly grant you access


// // function make_actor() {
// // 	const actor_symbol: unique symbol = Symbol()
// // }
