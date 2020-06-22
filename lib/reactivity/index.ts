import { noop, Fn, Registrar, Handle, Primitive, Comparator, Reducer, NonEmpty } from '../utils'

export interface Immutable<T> {
	r(): T,
}
export interface Mutable<T> extends Immutable<T> {
	s(next: T): void,
}

// export class FakeMutable<T> implements Mutable<T> {
// 	protected readonly value: T
// 	r() { return this.value }
// 	s(_next: T) {}
// }
// export class RelayMutable<T> implements Mutable<T> {
// 	protected readonly value: T
// 	r() { return this.value }
// 	s(_next: T) {}
// }

export function borrow<T>(ref: Immutable<T> | Mutable<T>): Immutable<T> {
	return ref
}


const REACTIVITY_CONTEXT = {
	mutationAllowed: true,
	batch: null as null | Batch,
	owner: null as null | Watcher,
	watcher: null as null | Watcher,
	// what is runWithin really for?
	// it's for any Watcher to capture children Watchers to ensure they're cleaned up properly
	// and it's for variable dependency
	runWithin<T>(fn: () => T, pushWatcher: Watcher, useWatcher: boolean) {
		// TODO if useWatcher is true, and after running the fn no Watchables were actually gathered,
		// then that Watcher will *never be performed again*, since it has no way of being triggered
		// const { owner, watcher, mutationAllowed } = this
		const { owner, watcher } = this
		this.owner = pushWatcher
		this.watcher = useWatcher ? pushWatcher : null
		this.mutationAllowed = false
		const value = fn()
		this.owner = owner
		this.watcher = watcher
		// this.mutationAllowed = mutationAllowed
		this.mutationAllowed = true
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

class Batch {
	protected readonly watchables = new Set<Watchable>()
	protected watchers = new Set<Watcher>()

	static handleWatchable(REACTIVITY_CONTEXT: REACTIVITY_CONTEXT, watchable: Watchable) {
		const { batch } = REACTIVITY_CONTEXT
		if (batch === null) {
			const immediateBatch = new Batch()
			immediateBatch.addWatchable(watchable)
			REACTIVITY_CONTEXT.batch = immediateBatch
			immediateBatch.perform()
			REACTIVITY_CONTEXT.batch = null
		}
		else
			batch.addWatchable(watchable)
	}
	protected addWatchable(watchable: Watchable) {
		this.watchables.add(watchable)
		watchable.pend()
	}

	perform() {
		console.log()
		console.log()
		console.log('beginning batch')
		while (this.watchables.size > 0 || this.watchers.size > 0) {
			for (const watchable of this.watchables) {
				console.log('watchable: ', watchable)
				console.log()
				// we're making an assumption that this won't mutate this.watchables
				watchable.finish()
				for (const watcher of watchable.watchers()) {
					watcher.trigger()
					this.watchers.add(watcher)
				}
			}
			this.watchables.clear()

			let runCount = 0
			const notReadyWatchers = new Set<Watcher>()
			for (const watcher of this.watchers) {
				if (!watcher.triggered()) continue
				console.log('watcher: ', watcher)
				console.log()
				if (!watcher.deps.ready()) {
					notReadyWatchers.add(watcher)
					continue
				}

				runCount++
				// this action can place more Watchables into the queue
				watcher.run()
			}
			this.watchers.clear()
			this.watchers = notReadyWatchers

			if (this.watchers.size > 0 && runCount === 0)
				throw new ReactivityPanic('circular reference')
		}
		console.log('ending batch')
		console.log()
		console.log()
	}
}
export function batch(fn: Fn) {
	const thisBatch = new Batch()
	const { batch } = REACTIVITY_CONTEXT
	REACTIVITY_CONTEXT.batch = thisBatch
	fn()
	REACTIVITY_CONTEXT.batch = batch
	thisBatch.perform()
}






export type Watchable<T = unknown> = SourceWatchable<T> | ReactivePipe<T>
export type Watcher = SinkWatcher | ReactivePipe<unknown>

// interface WatchableLike<T> {
// 	readonly isSource: boolean,
// 	watchers(): Set<WatcherLike<unknown>>,
// 	addWatcher(watcher: Watcher): void,
// 	removeWatcher(watcher: Watcher): void,
// 	pend(): void,
// 	pending(): boolean,
// 	finish(): void,
// 	sample(): T,
// }

export abstract class SourceWatchable<T> implements Mutable<T>/*, WatchableLike<T>*/ {
	protected readonly REACTIVITY_CONTEXT = REACTIVITY_CONTEXT

	// readonly isSource = true as const
	protected readonly _watchers = new Set<Watcher>()
	watchers() { return this._watchers }
	addWatcher(watcher: Watcher) {
		this._watchers.add(watcher)
		watcher.deps.addDependency(this)
	}
	removeWatcher(watcher: Watcher) {
		this._watchers.delete(watcher)
	}

	protected _pending = false
	pend() { this._pending = true }
	abstract pending(): boolean
	abstract finish(): void

	protected maybeAddGlobalWatcher() {
		const { watcher } = this.REACTIVITY_CONTEXT
		if (watcher !== null)
			this.addWatcher(watcher)
	}
	abstract r(): T
	abstract sample(): T

	protected notifyMutation(next: T) {
		if (!this.REACTIVITY_CONTEXT.mutationAllowed)
			// TODO perhaps this is more reasonable as a warning
			// console.error(`mutated ${this} with ${_next} in a readonly context`)
			throw new ReactivityPanic(`attempted to mutate ${this} with ${next} in a readonly context`)
		Batch.handleWatchable(this.REACTIVITY_CONTEXT, this)
	}
	abstract s(next: T): void
}


abstract class DependencyManager {
	abstract readonly dependencies: Iterable<Watchable>
	abstract addDependency(watchable: Watchable): void
	abstract clear(): void
	ready() {
		for (const dependency of this.dependencies)
			if (dependency.pending()) return false
		return true
	}
}
class FixedDependencyManager<L extends NonEmpty<any>> extends DependencyManager {
	constructor(readonly dependencies: WatchableTuple<L>) { super() }
	addDependency(watchable: Watchable) {}
	clear() {}
	regainDependencies(watcher: Watcher) {
		for (const dependency of this.dependencies)
			dependency.addWatcher(watcher)
	}
}
class VariableDependencyManager extends DependencyManager {
	readonly dependencies = new Set<Watchable>()
	clear() { this.dependencies.clear() }
	addDependency(watchable: Watchable) {
		this.dependencies.add(watchable)
	}
}

// interface WatcherLike<T> {
// 	readonly deps: DependencyManager,
// 	addChild(watcher: Watcher): void,
// 	trigger(): void
// 	run(): T,
// 	reset(): void,
// }

export abstract class SinkWatcher {
	protected readonly REACTIVITY_CONTEXT = REACTIVITY_CONTEXT

	// readonly isSink = true as const
	abstract readonly deps: DependencyManager

	protected readonly children = new Set<Watcher>()
	addChild(watcher: Watcher) { this.children.add(watcher) }

	protected _triggered = false
	triggered() { return this._triggered }
	trigger() { this._triggered = true }
	abstract run(): void
	protected globalReset() {
		for (const dependency of this.deps.dependencies)
			dependency.removeWatcher(this)
		this.deps.clear()

		for (const child of this.children)
			child.reset()
		this.children.clear()

		this._triggered = false
	}
	abstract reset(): void
}

abstract class LeafWatcher extends SinkWatcher {
	abstract readonly deps: DependencyManager
	protected destructor: Fn | undefined = undefined
	readonly registrar = (destructor: Fn) => { this.destructor = destructor }
	abstract run(): void
	reset() {
		this.globalReset()
		if (this.destructor)
			this.destructor()
		this.destructor = undefined
	}
}

abstract class Watch<L extends NonEmpty<any>> extends LeafWatcher {
	readonly deps: FixedDependencyManager<L>
	abstract run(): void
	constructor(
		dependencies: WatchableTuple<L>,
		immediate: boolean,
	) {
		super()
		this.deps = new FixedDependencyManager(dependencies)
		if (immediate) this.run()
		else this.deps.regainDependencies(this)
	}
}
class StatelessWatch<L extends NonEmpty<any>> extends Watch<L> {
	constructor(
		protected readonly fn: (destructor: Registrar) => unknown,
		dependencies: WatchableTuple<L>, immediate: boolean,
	) { super(dependencies, immediate) }

	run() {
		this.reset()
		this.deps.regainDependencies(this)
		this.REACTIVITY_CONTEXT.runWithin(() => this.fn(this.registrar), this, false)
	}
}
class StatefulWatch<L extends NonEmpty<any>, T> extends Watch<L> {
	constructor(
		protected state: T,
		protected readonly fn: (state: T, destructor: Registrar) => T,
		dependencies: WatchableTuple<L>, immediate: boolean,
	) { super(dependencies, immediate) }

	run() {
		this.reset()
		this.deps.regainDependencies(this)
		this.state = this.REACTIVITY_CONTEXT.runWithin(() => this.fn(this.state, this.registrar), this, false)
	}
}

abstract class Effect extends LeafWatcher {
	constructor() { super() }
	readonly deps = new VariableDependencyManager()
	abstract run(): void
}
class StatelessEffect extends Effect {
	constructor(
		protected readonly fn: (registrar: Registrar) => unknown,
	) {
		super()
		this.run()
	}

	run() {
		this.reset()
		this.REACTIVITY_CONTEXT.runWithin(() => this.fn(this.registrar), this, true)
	}
}
export function effect(fn: (destructor: Registrar) => unknown): Handle {
	const eff = new StatelessEffect(fn)
	return () => { eff.reset() }
}
class StatefulEffect<T> extends Effect {
	constructor(
		protected state: T,
		protected readonly fn: (state: T, registrar: Registrar) => T,
	) {
		super()
		this.run()
	}

	run() {
		this.reset()
		this.state = this.REACTIVITY_CONTEXT.runWithin(() => this.fn(this.state, this.registrar), this, true)
	}
}
export function statefulEffect<T>(fn: (state: T, registrar: Registrar) => T, initialState: T): Handle {
	const eff = new StatefulEffect(initialState, fn)
	return () => { eff.reset() }
}




class Signal extends SourceWatchable<void> {
	pending() { return this._pending }
	finish() { this._pending = false }
	r() { this.maybeAddGlobalWatcher() }
	sample() {}
	s() { this.notifyMutation() }
}
export function signal(): Mutable<void> {
	return new Signal()
}
export function derivedSignal<L extends NonEmpty<any>>(...dependencies: WatchableTuple<L>): Immutable<void> {
	return new FixedDependencyReactivePipe(() => new Signal(), () => {}, dependencies)
}

const EMPTY: unique symbol = Symbol()
type EMPTY = typeof EMPTY

class Channel<T> extends SourceWatchable<T> {
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
		this.next = next
		this.notifyMutation(next)
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

	s(next: T) {
		this.next = this.reducerFn(this.value, next)
		this.notifyMutation(next)
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





abstract class ReactivePipe<T> extends SinkWatcher implements Immutable<T> {
	// readonly isSource = false as const
	// readonly isSink = false as const
	abstract readonly deps: DependencyManager

	protected abstract readonly internalWatchable: SourceWatchable<T>
	trigger() {
		super.trigger()
		this.internalWatchable.pend()
	}
	abstract run(): void
	reset() { this.globalReset() }

	watchers() { return this.internalWatchable.watchers() }
	addWatcher(watcher: Watcher) { this.internalWatchable.addWatcher(watcher) }
	removeWatcher(watcher: Watcher) { this.internalWatchable.removeWatcher(watcher) }
	pend() { this.internalWatchable.pend() }
	pending() { return this.internalWatchable.pending() }
	finish() { this.internalWatchable.finish() }
	r() { return this.internalWatchable.r() }
	sample() { return this.internalWatchable.sample() }
}

type WatchableTuple<L extends any[]> = { [K in keyof L]: Watchable<L[K]> }

class FixedDependencyReactivePipe<L extends NonEmpty<any>, T> extends ReactivePipe<T> {
	readonly deps: FixedDependencyManager<L>
	protected readonly internalWatchable: SourceWatchable<T>
	constructor(
		watchableFn: (initialValue: T) => SourceWatchable<T>,
		protected readonly fn: (...args: L) => T,
		dependencies: WatchableTuple<L>,
	) {
		super()
		this.deps = new FixedDependencyManager(dependencies)
		this.internalWatchable = watchableFn(this.runInternal())
	}
	runInternal() {
		const gathered = [] as unknown as L
		for (const dependency of this.deps.dependencies) {
			// taking the opportunity to do what regainDependencies does
			dependency.addWatcher(this)
			gathered.push(dependency.sample())
		}
		return this.REACTIVITY_CONTEXT.runWithin(() => this.fn(...gathered), this, true)
	}
	run() {
		this.reset()
		this.internalWatchable.s(this.runInternal())
	}
}

class VariableDependencyReactivePipe<T> extends ReactivePipe<T> {
	readonly deps = new VariableDependencyManager()
	protected readonly internalWatchable: SourceWatchable<T>
	constructor(
		watchableFn: (initialValue: T) => SourceWatchable<T>,
		protected readonly fn: () => T,
	) {
		super()
		this.internalWatchable = watchableFn(this.runInternal())
	}
	runInternal() {
		return this.REACTIVITY_CONTEXT.runWithin(this.fn, this, true)
	}
	run() {
		this.reset()
		const value = this.runInternal()
		this.internalWatchable.s(value)
	}
}






// class ReactivePipeSplitWatcher {
// 	//
// }

// export class ReactiveMulti<L extends NonEmpty<any>, W> {
// 	//
// }

// export function split<T>(obj: Immutable<T>): { [K in T]: Immutable<T[K]> } {
// 	if (!(obj instanceof SourceWatchable || obj instanceof ReactivePipe)) {
// 		//
// 	}

// 	// create the watcher
// 	// call the function once initially, getting the T that will be destructured
// 	// create the structure of Watchables, initializing with the
// }

export function computed<T>(transformer: () => T, comparator?: Comparator<T>): Immutable<T> {
	return new VariableDependencyReactivePipe(
		value => comparator ? new DistinctChannel(value, comparator) : new ValueChannel(value),
		transformer
	)
}


// this.value = this.REACTIVITY_CONTEXT.runWithin(() => this.transformer(this.watchable.sample()), this, false)
