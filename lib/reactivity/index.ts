import { noop, Primitive, Fn, Handle, Registrar } from '../utils'

// export type Immutable<T> = (() => T) & { readonly signal?: Signal<T> }
export type Immutable<T> = (() => T)
export type Mutable<T> = ((value: T) => void) & Immutable<T>

// declare const brand: unique symbol
// export type ReactiveImmutable<T> = Immutable<T> & { [brand]: true }
// export type ReactiveMutable<T> = Mutable<T> & { [brand]: true }

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

class Signal<T = unknown> {
	readonly descendants = new Set<Computation>()
	protected next: T | typeof EMPTY = EMPTY
	protected _pending = false
	constructor(
		protected value: T,
		// protected readonly comparator: (a: T, b: T) => boolean,
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
			listener.register(this)
		}

		return this.value
	}

	mutate(next: T) {
		if (!this.STATE.mutationAllowed)
			throw new ReactivityPanic(`attempted to mutate ${this.value} with ${next} in a readonly context`)

		// if (this.comparator(this.value, next)) return
		if (this.value === next) return
		this.next = next

		const { batch: globalBatch } = this.STATE
		const [batch, runImmediate] = globalBatch === null
			? [this.STATE.batch = new Batch(), true]
			: [globalBatch, false]

		batch.addSignal(this)

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

class Computation<T = unknown> {
	protected _pending = false
	protected readonly ancestors = new Set<Signal>()
	protected readonly children = new Set<Computation>()
	constructor(
		protected readonly fn: () => T,
		protected readonly destructor: Fn,
		protected readonly STATE: STATE,
		protected signal: Signal<T> | undefined,
	) {}

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
			signal.unregister(this)
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
		// this._pending = false
		if (this.signal)
			this.signal.mutate(value)
	}

	initialize() {
		const { owner, listener, mutationAllowed } = this.STATE
		this.STATE.owner = this
		this.STATE.listener = this
		this.STATE.mutationAllowed = false
		const value = this.fn()
		this.STATE.owner = owner
		this.STATE.listener = listener
		this.STATE.mutationAllowed = mutationAllowed
		if (owner !== null)
			owner.add(this)

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
					// this.computations.unshift(computation)
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

export function sample<T, S extends Immutable<T>>(signalLike: S): T {
	// UNSAFE: is there any other way to do this without exposing the signals?
	// do we have to extend the Function class?
	if (!(signalLike as any).signal)
		return signalLike()
	return (signalLike as any).signal.value
}

// consider overloading to require a comparator if not Primitive
export function value<T>(initial: T): T extends Primitive ? Mutable<T> : never {
	const signal = new Signal(initial, STATE)

	function value(): T
	function value(next: T): void
	function value(next?: T) {
		if (arguments.length === 0)
			return signal.read()

		// UNSAFE: the checks above this line must guarantee that next is a T
		// consider using a spread tuple type instead of overloads
		signal.mutate(next!)
		return
	}
	(value as any).signal = signal

	return value as T extends Primitive ? Mutable<T> : never
}

export function effect(fn: (destructor: Registrar) => unknown): Handle {
	let userDestructor = noop
	const destructorRegistrar = (dest: Fn) => { userDestructor = dest }
	const computation = new Computation(() => {
		fn(destructorRegistrar)
	}, () => { userDestructor() }, STATE, undefined)

	computation.initialize()

	return () => { computation.unregister() }
}

export function computed<T>(fn: () => T): Immutable<T> {
	const computation = new Computation(fn, noop, STATE, undefined)
	const value = computation.initialize()
	const signal = new Signal(value, STATE)
	computation.giveSignal(signal)

	function computed(): T {
		return signal.read()
	}
	(computed as any).signal = signal
	return computed
}
