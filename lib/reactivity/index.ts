import { Primitive, Comparator, Reducer } from '../utils'

export interface Immutable<T> {
	r(): T,
}
export interface Mutable<T> extends Immutable<T> {
	s(next: T): void,
}

interface Watchable<T = unknown> extends Mutable<T> {
	watchers(): Set<Watcher>,
	watch(watcher: Watcher): void,
	unwatch(watcher: Watcher): void,
	pend(): void,
	pending(): boolean,
	finish(): void,
	sample(): T,
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

const EMPTY: unique symbol = Symbol()
type EMPTY = typeof EMPTY


// when a Watchable is also a Watcher,
// does it make sense for it to own other Watchers?
// or is this simply an idea required by our Computation concept?
// it seems Computation is a narrowing of Watcher
// what happens when a computed (which is both a Watchable and a Watcher) creates a Watchable of its own?


const STATE = {
	mutationAllowed: true,
	batch: null as null | Batch,
	owner: null as null | Computation,
	watcher: null as null | Watcher,
}
type STATE = typeof STATE

class ReactivityPanic extends Error {
	constructor(message: string) {
		STATE.mutationAllowed = true
		STATE.batch = null
		STATE.owner = null
		STATE.watcher = null
		super(message)
	}
}

abstract class Effect<T = unknown> {
	//
}

abstract class ReactiveSignal<T = unknown> implements Watchable<T> {
	protected STATE = STATE

	protected readonly _watchers = new Set<Watcher>()
	watchers(): Set<Watcher> { return this._watchers }
	watch(watcher: Watcher): void { this._watchers.add(watcher) }
	unwatch(watcher: Watcher): void { this._watchers.delete(watcher) }
	protected _pending = false
	pend(): void { this._pending = true }
	abstract pending(): boolean
	abstract finish(): void

	// readDirect(watcher: Computation) {
	// 	this.watch(watcher)
	// 	watcher.register(this as Signal)
	// }
	protected readGlobal() {
		const { watcher } = this.STATE
		if (watcher !== null) {
			this.watch(watcher)
			watcher.register(this as Signal)
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
	abstract r(): T
	abstract sample(): T
	abstract s(next: T): void
}









class VoidSignal extends ReactiveSignal<void> {
	pending() { return this._pending }
	finish() { this._pending = false }
	r() {
		this.readGlobal()
	}
	sample() {}
	s() {
		this.notifyGlobal()
	}
}
export function signal(): Mutable<void> {
	return new VoidSignal()
}

class Channel<T> extends ReactiveSignal<T> {
	protected next: T | EMPTY = EMPTY
	constructor(protected value: T) { super() }
	pending() {
		return this._pending || this.next !== EMPTY
	}
	finish() {
		if (this.next === EMPTY) return
		this.value = this.next
		this.next = EMPTY
		// TODO should this assignment always happen regardless of whether next wasn't EMPTY?
		this._pending = false
	}
	r() {
		this.readGlobal()
		return this.value
	}
	sample() {
		return this.value
	}
	s(next: T) {
		this.notifyGlobal(next)
		this.next = next
	}
}
export function channel<T>(initial: T): Mutable<T> {
	return new Channel(initial)
}

class ReducerChannel<T> extends Channel<T> {
	constructor(
		value: T,
		protected readonly reducerFn: Reducer<T>,
	) { super(value) }

	s(next: T): void {
		this.notifyGlobal(next)
		this.next = this.reducerFn(this.value, next)
	}
}
export function reducer<T>(initial: T, reducerFn: Reducer<T>): Mutable<T> {
	return new ReducerChannel(initial, reducerFn)
}

class ValueSignal<T> extends Channel<T> {
	constructor(value: T) { super(value) }

	s(next: T) {
		if (this.value === next) return
		super.s(next)
	}
}
// https://github.com/microsoft/TypeScript/issues/22596
export function primitive<T>(initial: T): [T] extends [Primitive] ? Mutable<T> : never {
	return new ValueSignal(initial) as unknown as [T] extends [Primitive] ? Mutable<T> : never
}
export function data<T>(initial: T): Mutable<T> {
	return new ValueSignal(initial)
}

class DistinctSignal<T> extends Channel<T> {
	constructor(value: T, readonly comparator: Comparator<T>) { super(value) }

	s(next: T) {
		if (this.comparator(this.value, next)) return
		super.s(next)
	}
}
export function distinct<T>(initial: T, comparator: Comparator<T>): Mutable<T> {
	return new DistinctSignal(initial, comparator)
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
				Array.prototype.unshift.apply(this.watchers, [...watchable.watchers()])
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
