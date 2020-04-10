import { noop, eq, alwaysFalse, Primitive, Comparator, Fn, Handle, Registrar } from '../utils'

export type Immutable<T> = (() => T)
export type Mutable<T> = ((value: T) => void) & Immutable<T>

// abstract class ReactiveContainer<T> {
// 	protected readonly abstract signal: Signal<T>
// }

// type ReactiveImmutable<T> = ReactiveContainer<T> & Immutable<T>
// type ReactiveMutable<T> = ReactiveContainer<T> & Mutable<T>
// type UnsafeReactiveContainer<T> = { readonly signal: Signal<T> }

// function make(value: number): ReactiveImmutable<number> {
// 	function f() {
// 		return value
// 	}
// 	f.signal = value
// 	return f as unknown as ReactiveImmutable<number>
// }


const STATE = {
	mutationAllowed: true,
	batch: null as null | Batch,
	owner: null as null | Computation,
	listener: null as null | Computation,
}
type STATE = typeof STATE

class ReactivityPanic extends Error {
	constructor(message: string) {
		STATE.mutationAllowed = true
		STATE.batch = null
		STATE.owner = null
		STATE.listener = null
		super(message)
	}
}


const EMPTY: unique symbol = Symbol()

type UnsafeSignal<T = unknown> = {
	readonly value: T
}
class Signal<T = unknown> {
	readonly descendants = new Set<Computation>()
	protected next: T | typeof EMPTY = EMPTY
	protected _pending = false
	constructor(
		protected value: T,
		protected readonly comparator: Comparator<T>,
		protected readonly STATE: STATE,
	) {}

	get pending() {
		return this._pending || this.next !== EMPTY
	}

	register(listener: Computation) {
		this.descendants.add(listener)
	}
	unregister(computation: Computation) {
		this.descendants.delete(computation)
	}

	read(): T {
		const { listener } = this.STATE
		if (listener !== null) {
			this.register(listener)
			listener.register(this as Signal)
		}

		return this.value
	}

	mutate(next: T) {
		if (!this.STATE.mutationAllowed)
			throw new ReactivityPanic(`attempted to mutate ${this.value} with ${next} in a readonly context`)

		if (this.comparator(this.value, next)) return
		this.next = next

		const { batch: globalBatch } = this.STATE
		const [batch, runImmediate] = globalBatch === null
			? [this.STATE.batch = new Batch(), true]
			: [globalBatch, false]

		batch.addSignal(this as Signal)

		if (runImmediate) {
			batch.run()
			this.STATE.batch = globalBatch
		}
	}
	wake() {
		this._pending = true
	}
	finalize() {
		if (this.next === EMPTY) return
		this.value = this.next
		this.next = EMPTY
		this._pending = false
	}
}

abstract class Computation<T = unknown> {
	protected _pending = false
	protected readonly ancestors = new Set<Signal>()
	protected readonly children = new Set<Computation>()
	constructor(
		protected readonly destructor: Fn,
		protected readonly STATE: STATE,
		protected signal: Signal<T> | undefined,
	) {}

	abstract initialize(): T

	get pending() {
		return this._pending
	}
	get ready() {
		for (const ancestor of this.ancestors)
			if (ancestor.pending) return false
		return true
	}

	giveSignal(signal: Signal<T>) {
		this.signal = signal
	}

	wake() {
		this._pending = true
		if (this.signal)
			this.signal.wake()
	}

	register(signal: Signal) {
		this.ancestors.add(signal)
	}
	unregister() {
		for (const signal of this.ancestors)
			signal.unregister(this as Computation)
		this.ancestors.clear()

		for (const child of this.children)
			child.unregister()
		this.children.clear()
		this.destructor()
		this._pending = false
	}
	add(child: Computation) {
		this.children.add(child)
	}

	run() {
		this.unregister()
		const value = this.initialize()
		if (this.signal)
			this.signal.mutate(value)
	}
}


class StatefulComputation<T> extends Computation<T> {
	constructor(
		protected readonly fn: (state: T) => T,
		protected state: T,
		destructor: Fn,
		STATE: STATE,
		signal: Signal<T> | undefined,
	) {
		super(destructor, STATE, signal)
	}

	initialize() {
		const { owner, listener, mutationAllowed } = this.STATE
		this.STATE.owner = this as Computation
		this.STATE.listener = this as Computation
		this.STATE.mutationAllowed = false
		const value = this.fn(this.state)
		this.state = value
		this.STATE.owner = owner
		this.STATE.listener = listener
		this.STATE.mutationAllowed = mutationAllowed
		if (owner !== null)
			owner.add(this as Computation)

		return value
	}
}

class StatelessComputation<T> extends Computation<T> {
	constructor(
		protected readonly fn: () => T,
		destructor: Fn,
		STATE: STATE,
		signal: Signal<T> | undefined,
	) {
		super(destructor, STATE, signal)
	}

	initialize() {
		const { owner, listener, mutationAllowed } = this.STATE
		this.STATE.owner = this as Computation
		this.STATE.listener = this as Computation
		this.STATE.mutationAllowed = false
		const value = this.fn()
		this.STATE.owner = owner
		this.STATE.listener = listener
		this.STATE.mutationAllowed = mutationAllowed
		if (owner !== null)
			owner.add(this as Computation)

		return value
	}
}


class Batch {
	protected readonly signals: Signal[] = []
	protected readonly computations: Computation[] = []
	addSignal(signal: Signal) {
		this.signals.unshift(signal)
		for (const descendant of signal.descendants)
			descendant.wake()
	}

	run() {
		while (this.signals.length > 0 || this.computations.length > 0) {
			let signal
			while (signal = this.signals.pop()) {
				if (!signal.pending) continue
				signal.finalize()
				Array.prototype.unshift.apply(this.computations, [...signal.descendants])
				continue
			}

			const nextComputations = []
			let runCount = 0
			let computation
			while (computation = this.computations.pop()) {
				if (!computation.pending) continue

				if (!computation.ready) {
					nextComputations.unshift(computation)
					continue
				}

				runCount++
				computation.run()
			}

			this.computations.splice(0, nextComputations.length, ...nextComputations)

			if (this.computations.length > 0 && runCount === 0)
				throw new ReactivityPanic('circular reference')
		}
	}
}

export function batch(fn: Fn) {
	const thisBatch = new Batch()
	const { batch } = STATE
	STATE.batch = thisBatch
	fn()
	STATE.batch = batch
	thisBatch.run()
}

export function data<T>(initial: T, comparator: Comparator<T>): Mutable<T> {
	const signal = new Signal(initial, comparator, STATE)

	function mut(): T
	function mut(next: T): void
	function mut(next?: T) {
		if (arguments.length === 0)
			return signal.read()

		// UNSAFE: the checks above this line must guarantee that next is a T
		signal.mutate(next!)
		return
	}
	(mut as any).signal = signal
	return mut
}
export namespace data {
	export function protect<T>(initial: T, comparator: Comparator<T>): [Immutable<T>, Mutable<T>] {
		const d = data(initial, comparator)
		return [d, d]
	}
}

// export function reducer<T>(initial: T, fn: (current: T, next: T) => T, comparator?: Comparator<T>): Mutable<T> {
// 	const signal = new Signal(initial, comparator || eq, STATE)

// 	function mut(): T
// 	function mut(next: T): void
// 	function mut(next?: T) {
// 		if (arguments.length === 0)
// 			return signal.read()

// 		// UNSAFE: the checks above this line must guarantee that next is a T
// 		signal.mutate(fn(sample(signal), next!))
// 		return
// 	}
// 	(mut as any).signal = signal
// 	return mut
// }

export function ref<T>(mutable: Mutable<T> | Immutable<T>): Immutable<T> {
	return mutable
}


// function immutable(): Immutable<T> {
// 	function _immutable(): T {
// 		return signal.read()
// 	}
// 	(_immutable as any).signal = signal
// }

export function value<T>(initial: T): T extends Primitive ? Mutable<T> : never {
	return data(initial, eq) as T extends Primitive ? Mutable<T> : never
}
export namespace value {
	export function protect<T>(initial: T): T extends Primitive ? [Immutable<T>, Mutable<T>] : never {
		const d = value(initial)
		return [d, d] as unknown as T extends Primitive ? [Immutable<T>, Mutable<T>] : never
	}
}

export function channel<T>(initial: T): Mutable<T> {
	return data(initial, alwaysFalse)
}
export namespace channel {
	export function protect<T>(initial: T): [Immutable<T>, Mutable<T>] {
		const d = data(initial, alwaysFalse)
		return [d, d]
	}
}


export function sample<T, S extends Immutable<T>>(signalLike: S): T {
	// UNSAFE: is there any other way to do this without exposing the signals?
	// do we have to extend the Function class?
	if (!(signalLike as any).signal)
		return signalLike()
	return ((signalLike as any).signal as UnsafeSignal<T>).value
}


export function effect(
	fn: (destructor: Registrar) => unknown,
): Handle {
	let userDestructor = noop
	const destructorRegistrar = (destructor: Fn) => { userDestructor = destructor }
	const computation = new StatelessComputation(
		() => { fn(destructorRegistrar) },
		() => { userDestructor() },
		STATE, undefined,
	)

	computation.initialize()

	return () => { computation.unregister() }
}
export function statefulEffect<T>(
	fn: (state: T, destructor: Registrar) => T,
	initialState: T,
): Handle {
	let userDestructor = noop
	const destructorRegistrar = (destructor: Fn) => { userDestructor = destructor }
	const computation = new StatefulComputation(
		state => fn(state, destructorRegistrar), initialState,
		() => { userDestructor() },
		STATE, undefined,
	)

	computation.initialize()

	return () => { computation.unregister() }
}

export function computed<T>(fn: () => T, comparator?: Comparator<T>): Immutable<T> {
	const computation = new StatelessComputation(fn, noop, STATE, undefined)
	const value = computation.initialize()
	const signal = new Signal(value, comparator || eq, STATE)
	computation.giveSignal(signal)

	function _computed(): T {
		return signal.read()
	}
	(_computed as any).signal = signal
	return _computed
}

export function thunk<T>(fn: () => T, comparator?: Comparator<T>): Immutable<T> {
	let signal = undefined as undefined | Signal<T>
	function _thunk(): T {
		if (signal === undefined) {
			const computation = new StatelessComputation(fn, noop, STATE, undefined)
			const value = computation.initialize()
			signal = new Signal(value, comparator || eq, STATE)
			;(_thunk as any).signal = signal
		}
		return signal.read()
	}
	return _thunk
}
