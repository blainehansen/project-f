import { noop, Primitive, Fn, Handle, Registrar } from '../utils'

// export type Immutable<T> = (() => T) & { readonly signal?: Signal<T> }
export type Immutable<T> = (() => T)
export type Mutable<T> = ((value: T) => void) & Immutable<T>

const STATE = {
	mutationAllowed: true,
	batch: null as null | Batch,
	owner: null as null | Computation,
	listener: null as null | Computation,
}
type STATE = typeof STATE


class Signal<T = unknown> {
	protected descendants = new Set<Computation>()
	protected pending = false
	protected next: T
	constructor(
		protected value: T,
		// protected readonly comparator: (a: T, b: T) => boolean,
		protected readonly STATE: STATE,
	) {
		this.next = value
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
			throw new Error(`attempted to mutate ${this.value} with ${next} in a readonly context`)

		// if (this.comparator(this.value, next)) return
		if (this.value === next) return

		this.pending = true
		this.next = next

		const { batch: globalBatch } = this.STATE
		const [batch, runImmediate] = globalBatch === null
			? [this.STATE.batch = new Batch(), true]
			: [globalBatch, false]

		batch.addSignal(this)

		if (runImmediate)
			batch.run()
	}
	finalize() {
		this.value = this.next
		this.pending = false
	}
}

const enum Status {
	Complete, Pending, Stalled,
}
class Computation {
	protected status = Status.Complete
	protected readonly signal: Signal | undefined
	protected readonly ancestors = new Set<Signal>()
	protected readonly children = new Set<Computation>()
	constructor(
		protected readonly fn: (STATE: STATE) => void,
		protected readonly destructor: Fn,
		protected readonly STATE: STATE,
	) {}

	get pending() {
		return this.status !== Status.Complete
	}
	wake() {
		this.status = Status.Pending
	}
	stall() {
		this.status = Status.Stalled
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
		this.status = Status.Complete
	}
	add(child: Computation) {
		this.children.add(child)
	}

	run() {
		// this.unregister()
		this.fn(this.STATE)
		// this.status = Status.Complete
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
		while (signals.length > 0 || computations.length > 0) {
			const signals = this.signals.slice()
			let signal
			while (signal = signals.pop()) {
				if (!signal.pending) continue
				signal.finalize()
				Array.prototype.unshift.apply(computations, [...signal.descendants])
			}

			const computations = this.computations.slice()
			let runCount = 0
			let computation
			while (computation = computations.pop()) {
				if (!computation.pending) continue

				if (!computation.ancestorsReady()){
					computation.status = Status.Stalled
					this.computations.unshift(computation)
					continue
				}

				computation.run()
				runCount++
			}

			if (this.computations.length > 0 && runCount === 0)
				throw new Error('circular reference')
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

	const thisComputation = new Computation(STATE => {
		const destructorRegistrar = (dest: Fn) => { userDestructor = dest }
		thisComputation.unregister()

		const { owner, listener, mutationAllowed } = STATE
		STATE.owner = thisComputation
		STATE.listener = thisComputation
		STATE.mutationAllowed = false
		fn(destructorRegistrar)
		STATE.owner = owner
		STATE.listener = listener
		STATE.mutationAllowed = mutationAllowed

		if (owner !== null)
			owner.add(thisComputation)
	}, () => { userDestructor() }, STATE)

	thisComputation.run()

	return () => { thisComputation.unregister() }
}

export function computed<T>(computer: () => T): Immutable<T> {
	const thisComputation = new Computation(STATE => {
		thisComputation.unregister()

		const { owner, listener, mutationAllowed } = STATE
		STATE.owner = thisComputation
		STATE.listener = thisComputation
		STATE.mutationAllowed = false
		const value = computer()
		STATE.owner = owner
		STATE.listener = listener
		STATE.mutationAllowed = mutationAllowed
		if (owner !== null)
			owner.add(thisComputation)

		signal.mutate(value)
	}, noop, STATE)

	const { owner, listener, mutationAllowed } = STATE
	STATE.owner = thisComputation
	STATE.listener = thisComputation
	STATE.mutationAllowed = false
	const value = computer()
	const signal = new Signal(value, STATE)
	STATE.owner = owner
	STATE.listener = listener
	STATE.mutationAllowed = mutationAllowed
	if (owner !== null)
		owner.add(thisComputation)

	function computed(): T {
		return signal.read()
	}
	(computed as any).signal = signal
	return computed
}
