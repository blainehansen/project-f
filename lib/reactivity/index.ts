import { noop, Fn, Registrar, Handle, Primitive, Comparator, Reducer } from '../utils'

export interface Immutable<T> {
	r(): T,
}
export interface Mutable<T> extends Immutable<T> {
	s(next: T): void,
}

export interface Watchable<T> extends Mutable<T> {
	watchers(): Set<Watcher>,
	addWatcher(watcher: Watcher): void,
	removeWatcher(watcher: Watcher): void,
	pend(): void,
	pending(): boolean,
	finish(): void,
	sample(): T,
}

export interface Watcher {
	addDependency(watchable: Watchable): void,
	addChild(watcher: Watcher): void,
	trigger(): void,
	triggered(): boolean,
	ready(): boolean,
	run(): void,
	reset(final: boolean): void,
}

export abstract class Reactive<T> implements Watchable<T> {
	//
}

// export type Watchable<T = unknown> = Reactive<T> | Derived<T>
// export type Watcher = Computation | Derived<unknown>

const REACTIVITY_CONTEXT = {
	mutationAllowed: true,
	batch: null as null | Batch,
	owner: null as null | Watcher,
	watcher: null as null | Watcher,
	runWithin<T>(fn: () => T, pushWatcher: Watcher, useWatcher: boolean) {
		// TODO for computations that didn't capture any actual signals
		// we should send a flag or something indicating to just throw everything away
		const { owner, watcher, mutationAllowed } = this
		this.owner = pushWatcher
		this.watcher = useWatcher ? pushWatcher : null
		this.mutationAllowed = false
		const value = fn()
		this.owner = owner
		this.watcher = watcher
		this.mutationAllowed = mutationAllowed
		if (owner !== null)
			owner.addChild(pushWatcher)
		return value
	}
}
type REACTIVITY_CONTEXT = typeof REACTIVITY_CONTEXT

class ReactivityPanic extends Error {
	constructor(message: string) {
		REACTIVITY_CONTEXT.mutationAllowed = true
		REACTIVITY_CONTEXT.batch = null
		REACTIVITY_CONTEXT.owner = null
		REACTIVITY_CONTEXT.watcher = null
		super(message)
	}
}

abstract class Effect implements Watcher {
	protected REACTIVITY_CONTEXT = REACTIVITY_CONTEXT

	constructor(protected readonly destructor: Fn) {}

	protected readonly _dependencies = new Set<Watchable>()
	addDependency(watchable: Watchable): void {
		this._dependencies.add(watchable)
	}
	protected readonly children = new Set<Watcher>()
	addChild(watcher: Watcher) {
		this.children.add(watcher)
	}

	protected _triggered = false
	trigger() { this._triggered = true }
	triggered(): boolean { return this._triggered }
	ready(): boolean {
		for (const dependency of this._dependencies)
			if (dependency.pending()) return false
		return true
	}

	reset(final: boolean) {
		for (const dependency of this._dependencies)
			dependency.removeWatcher(this)
		this._dependencies.clear()

		for (const child of this.children)
			child.reset(final)
		this.children.clear()

		this.destructor()
		this._triggered = false
	}
	abstract run(): void
}

class StatelessEffect extends Effect {
	constructor(protected readonly fn: Fn, destructor: Fn) {
		super(destructor)
		this.REACTIVITY_CONTEXT.runWithin(this.fn, this, true)
	}
	run() {
		this.reset(false)
		this.REACTIVITY_CONTEXT.runWithin(this.fn, this, true)
	}
}
export function effect(fn: (destructor: Registrar) => unknown): Handle {
	let userDestructor = noop
	const destructorRegistrar = (destructor: Fn) => { userDestructor = destructor }
	const eff = new StatelessEffect(
		() => { fn(destructorRegistrar) },
		() => { userDestructor() },
	)
	return () => { eff.reset(true) }
}

class StatefulEffect<T> extends Effect {
	constructor(protected state: T, protected readonly fn: (state: T) => T, destructor: Fn) {
		super(destructor)
		this.state = this.REACTIVITY_CONTEXT.runWithin(() => this.fn(this.state), this, true)
	}
	run() {
		this.reset(false)
		this.state = this.REACTIVITY_CONTEXT.runWithin(() => this.fn(this.state), this, true)
	}
}
export function statefulEffect<T>(
	fn: (state: T, destructor: Registrar) => T,
	initialState: T,
): Handle {
	let userDestructor = noop
	const destructorRegistrar = (destructor: Fn) => { userDestructor = destructor }
	const eff = new StatefulEffect(
		initialState,
		state => fn(state, destructorRegistrar),
		() => { userDestructor() },
	)

	return () => { eff.reset(true) }
}


export abstract class Watchable<T = unknown> implements Mutable<T> {
	protected REACTIVITY_CONTEXT = REACTIVITY_CONTEXT

	protected readonly _watchers = new Set<Watcher>()
	watchers(): Set<Watcher> { return this._watchers }
	addWatcher(watcher: Watcher) {
		this._watchers.add(watcher)
		watcher.addDependency(this)
	}
	protected maybeAddGlobalWatcher() {
		const { watcher } = this.REACTIVITY_CONTEXT
		if (watcher !== null)
			this.addWatcher(watcher)
	}
	removeWatcher(watcher: Watcher) {
		this._watchers.delete(watcher)
	}

	protected _pending = false
	pend(): void { this._pending = true }
	abstract pending(): boolean
	abstract finish(): void

	// the purpose of this function is to:
	// - check if mutation is currently allowed
	// - add this Watchable to the current batch, which transitively adds all Watchers of this Watchable to the batch
	// 		- if this Watchable would have been the only root, then run that batch
	protected notify(_next: T) {
		if (!this.REACTIVITY_CONTEXT.mutationAllowed)
			// TODO perhaps this is more reasonable as a warning
			// console.error(`mutated ${this} with ${_next} in a readonly context`)
			throw new ReactivityPanic(`attempted to mutate ${this} with ${_next} in a readonly context`)

		Batch.handleWatchable(this.REACTIVITY_CONTEXT, this)
	}
	abstract r(): T
	abstract sample(): T
	abstract s(next: T): void
}


class Batch {
	constructor(
		protected readonly watchables: Watchable[] = [],
		protected readonly watchers: Watcher[] = [],
	) {}

	static handleWatchable(REACTIVITY_CONTEXT: REACTIVITY_CONTEXT, watchable: Watchable) {
		const { batch } = REACTIVITY_CONTEXT
		if (batch === null) {
			const batch = new Batch()
			batch.addWatchable(watchable)
			batch.run()
		}
		else
			batch.addWatchable(watchable)
	}
	protected addWatchable(watchable: Watchable) {
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
export function batch(fn: Fn) {
	const thisBatch = new Batch()
	const { batch } = REACTIVITY_CONTEXT
	REACTIVITY_CONTEXT.batch = thisBatch
	fn()
	REACTIVITY_CONTEXT.batch = batch
	thisBatch.run()
}









class Signal extends Watchable<void> {
	pending() { return this._pending }
	finish() { this._pending = false }
	r() {
		this.maybeAddGlobalWatcher()
	}
	sample() {}
	s() {
		this.notify()
	}
}
export function signal(): Mutable<void> {
	return new Signal()
}

class DerivedSignal extends Watchable<void> implements Watcher {
	protected constructor(
		protected readonly watchables: NonEmpty<Watchable>,
	) {
		super()
		for (const watchable of this.watchables)
			watchable.addWatcher(this)
		// this.REACTIVITY_CONTEXT.runWithin(this.fn, this, false)
	}

	addDependency(_watchable: Watchable): void {}
	protected readonly children = new Set<Watcher>()
	addChild(watcher: Watcher) {
		this.children.add(watcher)
	}

	protected _triggered = false
	trigger() { this._triggered = true }
	triggered(): boolean { return this._triggered }
	ready(): boolean {
		for (const watchable of this.watchables)
			if (watchable.pending()) return false
		return true
	}

	reset(final: boolean) {
		for (const watchable of this.watchables)
			watchable.removeWatcher(this)

		for (const child of this.children)
			child.reset(final)
		this.children.clear()

		this._triggered = false
	}
	run(): void {
		this.reset(false)
		for (const watchable of this.watchables)
			watchable.addWatcher(this)
	}
}
export function derivedSignal(...watchables: NonEmpty<Watchable>) {
	return new DerivedSignal(watchables)
}






const EMPTY: unique symbol = Symbol()
type EMPTY = typeof EMPTY

class Channel<T> extends Watchable<T> {
	protected next: T | EMPTY = EMPTY
	constructor(protected value: T) { super() }
	pending() {
		return this._pending || this.next !== EMPTY
	}
	finish() {
		// TODO perhaps add an assertion that checks if both _pending is true and next === EMPTY
		// if that's happened, then we were pended but never received a new value
		this._pending = false
		if (this.next === EMPTY) return
		this.value = this.next
		this.next = EMPTY
	}
	r() {
		this.maybeAddGlobalWatcher()
		return this.value
	}
	sample() {
		return this.value
	}
	s(next: T) {
		this.notify(next)
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
		this.notify(next)
		this.next = this.reducerFn(this.value, next)
	}
}
export function reducer<T>(initial: T, reducerFn: Reducer<T>): Mutable<T> {
	return new ReducerChannel(initial, reducerFn)
}

class ValueChannel<T> extends Channel<T> {
	constructor(value: T) { super(value) }

	s(next: T) {
		if (this.value === next) return
		super.s(next)
	}
}
// https://github.com/microsoft/TypeScript/issues/22596
export function primitive<T>(initial: T): [T] extends [Primitive] ? Mutable<T> : never {
	return new ValueChannel(initial) as unknown as [T] extends [Primitive] ? Mutable<T> : never
}
export function pointer<T>(initial: T): Mutable<T> {
	return new ValueChannel(initial)
}

class DistinctChannel<T> extends Channel<T> {
	constructor(value: T, readonly comparator: Comparator<T>) { super(value) }

	s(next: T) {
		if (this.comparator(this.value, next)) return
		super.s(next)
	}
}
export function distinct<T>(initial: T, comparator: Comparator<T>): Mutable<T> {
	return new DistinctChannel(initial, comparator)
}



// class DerivedChannel<U, T> extends Channel<T> implements Watcher {
// 	static derived<T, U>(watchable: Watchable<U>, transformer: (value: U) => T): Immutable<T> {
// 		const initial = REACTIVITY_CONTEXT.runWithin(() => transformer(watchable.sample()), this, false)
// 		return new DerivedChannel(initial, watchable, transformer)
// 	}
// 	protected constructor(
// 		initial: T,
// 		protected readonly watchable: Watchable<U>,
// 		protected readonly transformer: (value: U) => T,
// 	) {
// 		super(initial)
// 		this.watchable.addWatcher(this)
// 	}

// 	addDependency(_watchable: Watchable): void {}
// 	protected readonly children = new Set<Watcher>()
// 	addChild(watcher: Watcher) {
// 		this.children.add(watcher)
// 	}

// 	protected _triggered = false
// 	trigger() { this._triggered = true }
// 	triggered(): boolean { return this._triggered }
// 	ready(): boolean {
// 		return !this.watchable.pending()
// 	}

// 	reset(final: boolean) {
// 		this.watchable.removeWatcher(this)

// 		for (const child of this.children)
// 			child.reset(final)
// 		this.children.clear()

// 		this._triggered = false
// 	}
// 	run(): void {
// 		// when run is called, that means watchable has at some point been pended
// 		// so we reset, mostly to clean any children
// 		// and then we add ourself back to our single dependency's list
// 		this.reset(false)
// 		this.watchable.addWatcher(this)
// 		this.s(this.transformer(this.watchable.sample()))
// 	}
// }
// export const derived = DerivedChannel.derived
