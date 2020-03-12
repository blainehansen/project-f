type Dict<T> = { [key: string]: T }
type NonEmpty<T> = [T, ...T[]]
type Primitive = string | number | boolean | null | undefined
type OnlyAllow<A, E> = A extends E ? A : never

const noop = () => {}
const always = () => true

export type Fn = () => unknown
export type Handle = () => void
export type Registrar = (fn: Fn) => void

// declare const _reactive_brand: unique symbol
// // type TrueReactive<T> = { [_reactive_brand]: true, signal }

// export type Immutable<T> = (() => T) & { readonly signal?: Signal<T> }
export type Immutable<T> = (() => T)
export type Mutable<T> = ((value: T) => void) & Immutable<T>

const STATE = {
	mutationAllowed: true,
	listener: null as null | Computation,
	batch: null as null | Batch,
}
type STATE = typeof STATE


class Signal<T = unknown> {
	protected dependencies = new Set<Computation>()
	constructor(
		protected value: T,
		// protected readonly comparator: (a: T, b: T) => boolean,
		protected readonly STATE: STATE,
	) {}

	protected register(listener: Computation) {
		this.dependencies.add(listener)
	}
	unregister(computation: Computation) {
		this.dependencies.delete(computation)
	}

	protected read(): T {
		const { listener } = this.STATE
		if (listener !== null) {
			this.register(listener)
			listener.register(this)
		}

		return this.value
	}

	protected mutate(next: T) {
		if (!this.STATE.mutationAllowed)
			throw new Error(`attempted to mutate ${this.value} with ${next} in a readonly context`)

		if (this.value === next) return

		const { batch } = this.STATE
		if (batch === null) {
			this.value = next
			Computation.run([...this.dependencies])
			return
		}
		batch.add(() => { this.value = next }, this.dependencies)
	}

	static sample<T, S extends Immutable<T>>(signalLike: S): T {
		// UNSAFE: is there any other way to do this without exposing the signals?
		// do we have to extend the Function class?
		if (!(signalLike as any).signal)
			return signalLike()
		return (signalLike as any).signal.value
	}

	// consider overloading to require a comparator if not Primitive
	static value<T>(initial: T): T extends Primitive ? Mutable<T> : never {
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

	static computed<T>(computer: () => T): Immutable<T> {
		const thisComputation = new Computation(STATE => {
			thisComputation.unregister()

			const { listener, mutationAllowed } = STATE
			STATE.listener = thisComputation
			STATE.mutationAllowed = false
			const value = computer()
			STATE.listener = listener
			STATE.mutationAllowed = mutationAllowed

			signal.mutate(value)
		}, STATE)

		const { listener, mutationAllowed } = STATE
		STATE.listener = thisComputation
		STATE.mutationAllowed = false
		const value = computer()
		const signal = new Signal(value, STATE)
		STATE.listener = listener
		STATE.mutationAllowed = mutationAllowed

		function computed(): T {
			return signal.read()
		}
		(computed as any).signal = signal
		return computed
	}
}

class Computation {
	protected watched = new Set<Signal>()
	constructor(
		protected readonly fn: (STATE: STATE) => void,
		protected readonly STATE: STATE,
	) {}

	register(signal: Signal) {
		this.watched.add(signal)
	}
	unregister() {
		for (const signal of this.watched)
			signal.unregister(this)
		this.watched.clear()
	}

	static run(computations: Iterable<Computation>) {
		for (const computation of computations)
			computation.fn(computation.STATE)
	}

	static effect(fn: (destructor: Registrar) => unknown): Handle {
		let userDestructor = noop
		const destructor = () => {
			thisComputation.unregister()
			userDestructor()
		}

		const thisComputation = new Computation(STATE => {
			const destroy = (dest: Fn) => {
				userDestructor = dest
			}
			destructor()

			const { listener, mutationAllowed } = STATE
			STATE.listener = thisComputation
			STATE.mutationAllowed = false
			fn(destroy)
			STATE.listener = listener
			STATE.mutationAllowed = mutationAllowed
		}, STATE)

		thisComputation.fn(thisComputation.STATE)

		// at some point we'll need to attach thisComputation to some owner
		// but not yet

		return destructor
	}
}

class Batch {
	protected readonly mutations: Fn[] = []
	protected readonly computations = new Set<Computation>()
	add(mutation: Fn, computations: Iterable<Computation>) {
		this.mutations.push(mutation)
		for (const computation of computations)
			this.computations.add(computation)
	}
	run() {
		for (const mutation of this.mutations)
			mutation()
		Computation.run(this.computations)

		this.mutations.length = 0
		this.computations.clear()
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

export const effect = Computation.effect
export const value = Signal.value
export const computed = Signal.computed
export const sample = Signal.sample
