import { Primitive, Comparator, Reducer } from '../utils'

export interface Immutable<T> {
	r(): T,
}
export interface Mutable<T> extends Immutable<T> {
	s(value: T): void,
}

interface Watchable<T = unknown> extends Mutable<T> {
	watchers(): Set<Watcher>,
	watch(watchable: Watcher): void,
	unwatch(watchable: Watcher): void,
	sample(): T,
	pend(): void,
	pending(): boolean,
	finish(): void,
}

interface Watcher {
	watching(): readonly Watchable[],
	trigger(): void,
	triggered(): boolean,
	ready(): boolean,
	run(): void,
	reset(): void,
	destroy(): void,
}

class DerivedSignal<T, A extends NonEmpty<Watchable<any>>> implements Watchable<T>, Watcher {
	protected value: T
	constructor(
		readonly transformer: (...watchables: A) => T,
		readonly watching: A,
	) {
		this.value = this.transformer(...this.watching)
	}

	protected readonly _watchers = new Set<Watcher>([this])
	watchers() {
		return this._watchers
	}
	watch(watchable: Watcher) {
		this._watchers.add(watchable)
	}
	unwatch(watchable: Watcher) {
		this._watchers.remove(watchable)
	}
	sample(): T { return this.value }
	protected _pending = false
	pend() {
		this._pending = true
		this._triggered = true
		for (const watcher of this._watchers)
			watcher.triggered = true
	}
	get pending() { return this._pending }
	finish() { this._pending = false }

	trigger() { this._triggered = true }
	triggered(): boolean { return this._triggered }
	ready(): boolean {
		return this.watching.all(w => !w.pending)
	}
	run() {
		this.value = this.transformer(...this.watching)
		this._triggered = false
	}
	reset() {}
	destroy() {}

	r(): T {
		//
	}
	s(value: T) {
		//
	}
}

class Batch {
	constructor(
		protected readonly watchables: Watchable[] = [],
		protected readonly watchers: Watcher[] = [],
	) {}

	addWatchable(watchable: Watchable) {
		this.watchables.unshift(watchable)
		watchable.pend()
	}
	run() {
		while (this.watchables.length > 0 || this.watchers.length > 0) {
			let watchable
			while (watchable = this.watchables.pop()) {
				if (!watchable.pending()) continue
				watchable.finish()
				Array.prototype.unshift.apply(this.watchers, watchable.watchers())
				continue
			}

			const nextWatchers = []
			let runCount = 0
			let watcher
			while (watcher = this.watchers.pop()) {
				if (!watcher.triggered()) continue

				if (!watcher.ready()) {
					nextWatchers.unshift(watcher)
					continue
				}

				runCount++
				watcher.run()
			}

			this.watchers.splice(0, nextWatchers.length, ...nextWatchers)

			if (this.watchers.length > 0 && runCount === 0)
				throw new ReactivityPanic('circular reference')
		}
	}
}



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
type EMPTY = typeof EMPTY

abstract class ReactiveSignal<T = unknown> implements Mutable<T> {
	protected readonly listeners = new Set<Computation>()
	protected STATE: STATE = STATE
	protected _pending = false
	abstract pending(): boolean

	addListener(listener: Computation) {
		this.listeners.add(listener)
	}
	removeListener(listener: Computation) {
		this.listeners.delete(listener)
	}

	// readDirect(listener: Computation) {
	// 	this.addListener(listener)
	// 	listener.register(this as Signal)
	// }
	protected readGlobal() {
		const { listener } = this.STATE
		if (listener !== null) {
			this.addListener(listener)
			listener.register(this as Signal)
		}
	}

	// notifyBatch(next: T, batch: Batch) {
	// 	//
	// }
	protected notifyGlobal(next: T) {
		if (!this.STATE.mutationAllowed)
			throw new ReactivityPanic(`attempted to mutate ${this.value} with ${next} in a readonly context`)

		// if (this.comparator(this.value, next)) return
		// this.next = next

		const { batch } = this.STATE
		if (batch === null)
			Batch.runSingle(this.STATE, this)
		else
			batch.addSignal(this)
	}
	wake() {
		this._pending = true
	}
	abstract finalize(): void
	abstract r(): T
	abstract sample()
	abstract s(value: T): void
}

// class VoidSignal extends ReactiveSignal<void> {
// 	pending() {
// 		return this._pending
// 	}
// 	finalize() {
// 		this._pending = false
// 	}
// 	r() {
// 		this.readGlobal()
// 	}
// 	sample() {}
// 	s() {
// 		this.notifyGlobal()
// 	}
// }
// export function signal(): Mutable<void> {
// 	new new VoidSignal()
// }

// class Channel<T> extends ReactiveSignal<T> {
// 	protected next: T | EMPTY = EMPTY
// 	constructor(protected value: T) { super() }
// 	pending() {
// 		return this._pending || this.next !== EMPTY
// 	}
// 	finalize() {
// 		if (this.next === EMPTY) return
// 		this.value = this.next
// 		this.next = EMPTY
// 		// TODO should this assignment always happen regardless of whether next wasn't EMPTY?
// 		this._pending = false
// 	}
// 	r() {
// 		this.readGlobal()
// 		return this.value
// 	}
// 	sample() {
// 		return this.value
// 	}
// 	s(next: T) {
// 		this.notifyGlobal(next)
// 		this.next = next
// 	}
// }
// export function channel<T>(initial: T): Mutable<T> {
// 	return new Channel(initial)
// }

// class ReducerChannel<T> extends Channel<T> {
// 	constructor(
// 		protected value: T,
// 		protected readonly reducerFn: Reducer,
// 	) { super() }

// 	s(value: T): void {
// 		this.value = this.reducerFn(this.value, value)
// 		this.notify(this.value)
// 	}
// }
// export function reducer<T>(initial: T, reducerFn: Reducer): Mutable<T> {
// 	return new ReducerChannel(initial, reducerFn)
// }

// class ValueSignal<T> extends Channel<T> {
// 	constructor(protected value: T) { super() }

// 	s(value: T) {
// 		if (this.value === value) return
// 		super.s(value)
// 	}
// }
// // https://github.com/microsoft/TypeScript/issues/22596
// export function primitive<T>(initial: T): [T] extends [Primitive] ? Mutable<T> : never {
// 	return new ValueSignal(initial)
// }
// export function data<T>(initial: T): Mutable<T> {
// 	return new ValueSignal(initial)
// }

// class DistinctSignal<T> extends Channel<T> {
// 	constructor(protected value: T, readonly comparator: Comparator<T>) { super() }

// 	s(value: T) {
// 		if (this.comparator(this.value, value)) return
// 		super.s(value)
// 	}
// }
// export function distinct<T>(initial: T, comparator: Comparator<T>): Mutable<T> {
// 	return new DistinctSignal(initial, comparator)
// }



abstract class Computation<T = unknown> {
	protected _pending = false
	protected readonly STATE: STATE = STATE
	protected readonly listening = new Set<Signal>()
	protected readonly owned = new Set<Computation>()

	pending() {
		return this._pending
	}
	ready() {
		for (const ancestor of this.listening)
			if (ancestor.pending()) return false
		return true
	}
	wake() {
		this._pending = true
	}
	listen(signal: Signal) {
		this.listening.add(signal)
	}
	own(owned: Computation) {
		this.owned.add(owned)
	}

	abstract destruct(): void
	abstract runComputation(): void
	protected abstract runInternal(): T
	initialize(): T {
		const { owner, listener, mutationAllowed } = STATE
		this.STATE.owner = this as Computation
		this.STATE.listener = this as Computation
		this.STATE.mutationAllowed = false
		const value = this.runInternal()
		this.STATE.owner = owner
		this.STATE.listener = listener
		this.STATE.mutationAllowed = mutationAllowed
		if (owner !== null)
			owner.own(this as Computation)

		return value
	}
}

abstract class EffectComputation<T> extends Computation<T> {
	protected readonly abstract destructor: Fn
	protected abstract runInternal(): T
	destruct() {
		for (const signal of this.listening)
			signal.removeListener(this as Computation)
		this.listening.clear()

		for (const child of this.children)
			child.destruct()
		this.children.clear()

		this.destructor()
		this._pending = false
	}
	run() {
		this.destruct()
		this.initialize()
	}
}

class StatelessEffectComputation extends EffectComputation<void> {
	constructor(
		protected readonly fn: () => void,
		protected readonly destructor: Fn,
	) { super() }

	protected runInternal() {
		this.fn()
	}
}

class StatefulEffectComputation<T> extends EffectComputation<T> {
	constructor(
		protected readonly fn: (state: T) => T,
		protected state: T,
		protected readonly destructor: Fn,
	) { super() }

	protected runInternal(): T {
		return this.state = this.fn(this.state)
	}
}

class SignalComputation<T> extends Computation<T> {
	constructor(
		protected readonly fn: () => T,
		protected readonly signal: Signal<T>,
	) { super() }

	static channel<T>(fn: () => T): Immutable<T> {
		const signal = new Channel()
		Computation.runGlobal(fn)
		return signal
	}

	protected runInternal(): T {
		return this.fn()
	}
	wake() {
		this._pending = true
		this.signal.wake()
	}
	destruct() {
		for (const signal of this.listening)
			signal.removeListener(this as Computation)
		this.listening.clear()

		for (const child of this.children)
			child.destruct()
		this.children.clear()

		this._pending = false
	}
	run() {
		this.destruct()
		const value = this.initialize()
		this.signal.notify(value)
	}
}
export const computedChannel = SignalComputation.channel

// class SignalBind<T> extends Computation<T, Signal> {
// 	//
// }

// type SignalTuple<L extends any[]> = { [K in keyof L]: ReactiveSignal<L[K]> }
// class MultiSignalComputation<L extends NonEmpty<ReactiveSignal<any>>> extends Computation<T, L> {
// 	//
// }



// export function batch(fn: Fn) {
// 	const thisBatch = new Batch()
// 	const { batch } = STATE
// 	STATE.batch = thisBatch
// 	fn()
// 	STATE.batch = batch
// 	thisBatch.run()
// }

// export function sample<T>(immutable: Immutable<T>): T {
// 	return immutable instanceof ReactiveSignal ? ReactiveSignal.sample(immutable) : immutable.r()
// }
// export function ref<T>(signal: Mutable<T> | Immutable<T>): Immutable<T> {
// 	return signal
// }
// export function protect(signal: Mutable<T> | Immutable<T>) {
// 	return { immutable: signal as Immutable<T>, mutable: signal as Mutable<T> }
// }
