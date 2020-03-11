// mutation is disallowed entirely in contexts where we're automatically picking up dependencies
// in contexts where dependencies are manually supplied, we can compare any mutations against the current watcher set and throw an error

type Dict<T> = { [key: string]: T }
type NonEmpty<T> = [T, ...T[]]

declare const _reactive_brand: unique symbol
// type TrueReactive<T> = { [_reactive_brand]: true, signal }
type MutableReactive<T> = ((value: T) => void) & { [_reactive_brand]: true }
type ImmutableReactive<T> = (() => T) & { [_reactive_brand]: true }
type Reactive<T> = MutableReactive<T> & ImmutableReactive<T>

// type FakeMutable<T> = (value: T) => void
// type FakeImmutable<T> = () => T
// type FakeReactive<T> = FakeMutable<T> & FakeImmutable<T>

type Immutable<T> = () => T
type Mutable<T> = ((value: T) => void) & Immutable<T>

const STATE = {
	mutationAllowed: true,
	listener: null as Computation | null,
	// owner: null as Owner | null,
}


type Primitives = string | number | boolean | null

class Computation {
	constructor(readonly fn: () => unknown) {}
	// wake() {
	// 	// if there's a current batch (there will only ever be one??) add to it
	// 	// otherwise just call fn
	// }
}

// class Batch {
// 	//
// }

class Signal<T> {
	protected dependencies = null as NonEmpty<Computation> | null
	constructor(protected value: T) {}

	sample() {
		return this.value
	}

	read(listener: Computation | null): T {
		if (listener !== null)
			this.register(listener)
		return this.value
	}

	mutate(next: T) {
		this.value = next

		if (this.dependencies === null) return
		for (const computation of this.dependencies)
			// computation.wake()
			computation.fn()
	}

	register(listener: Computation) {
		if (this.dependencies === null)
			this.dependencies = [listener]
		else
			this.dependencies.push(listener)
	}
}


// we can have a "pipe" function that takes a tuple of dependencies and a tuple of targets,
// and the function has to return the new value of the tuple
// and we can have a gated pipe that only fires when some condition is true?
// and we can have an "optional" pipe that can return undefined to not update anything?
// function f<T>(fn: (value: T) => boolean): void
// function f<T, U extends T>(fn: (value: T) => value is U): void
// function f<T>(fn: (value: T) => boolean) {
//   return
// }
// f((n: number) => n === 0)

function value<T extends Primitives>(initial: T): Mutable<T> {
	const signal = new Signal(initial)

	function value(): T
	function value(next: T): void
	function value(next?: T) {
		if (next === undefined)
			return signal.read(STATE.listener)

		if (!STATE.mutationAllowed)
			throw new Error(`attempted to mutate ${internal} with ${next} in an immutable context`)

		signal.mutate(next)
		return
	}

	return value
}

function computed<T>(fn: () => T): Immutable<T> {
	// create some kind of new computation and register it as the listener
	const computation = new Computation(fn)
	const { listener: oldListener, mutationAllowed: oldMutationAllowed } = STATE
	STATE.listener = computation
	STATE.mutationAllowed = false
	// fn() will add all the called dependencies to STATE.listeners
	// and by passing it in to signal, it will pull all those dependencies off
	// and save them internally, so it will know who to call whenever it's mutated
	const v = new Signal(fn(), computation)
	STATE.listener = oldListener
	STATE.mutationAllowed = oldMutationAllowed
	// in effectful computations, we'll need to add the computation to some owner
	// and deal with cleaning up the side effects
	// in this case, does it matter? the only reason to add it anywhere is to make this idiot proof
	return v
}

function watch<T>(reactive: Reactive<T>, fn: (value: T) => unknown) {
	// const signal: Signal<T> = (reactive as any).signal
	const signal = reactive.signal
	fn(signal.sample())
	signal.register(() => { fn(signal.sample()) })
}

// function effect(fn: () => unknown) {
// 	//
// }

// function cleanup(fn: () => unknown) {
// 	//
// }


const letter = value('a')
const count = value(1)

const str = computed(() => letter().repeat(count()))

watch(str, str => {
	console.log(str)
})









// // bunch of intended changes:
// // - don't do this stupid S interface thing, just export functions by name so that they're tree-shakable
// // - create some kind of async buffering mode for computations?
// // - allow for both read and write only signals
// // - have more nuanced wrappers, such as a ref that only contains a primitive, things that make the keys of an object reactive, a reactive array and dictionary, etc
// // - it seems that the "freeze" thing should be the default?

// // logs all dependencies (probably the same as S())
// export function effect() {
// 	//
// }
// // uses explicit dependencies
// export function watch() {
// 	//
// }

// // logs all dependencies but expects the function to return a value
// export function computed() {
// 	//
// }

// // in the state management library we'll want thunks

// // probably want some watcher concepts that always run on every change and others that only run when the comparator says there's a difference

// // definitely want a "sample" function

// // with a "drifter" or "shared" ref concept, it's possible to have something always be set by some "computed"-like computation,
// // but still allow other outside code to mutate it
// // all we've done is relax the invariant that the value is always equal to the result of that computation

// // if we can figured out some "reactive actor" concept that makes it easy for people to make a class fully readonly reactive
// // in a single threaded environment, actors are really just about access control, and the invariants that come along with it

// // freeze is really "batch" or something

// // a watcher that only fires when some boolean function (which can be a type guard!) returns true
// // this makes it so we can wait until something particular happens

// // some "reducer" function that takes an initial value?

// // this only takes in primitives, so no comparator function is needed
// export function value() {
// 	//
// }

// // this only takes things that extend objects, and a comparator is required
// export function ref() {
// 	//
// }

// // this is basically just like a value or ref, but it doesn't care what it gets,
// // and it triggers on every update, without any comparisons
// export function channel() {
// 	//
// }

// // takes a bunch of signals and calls them all, just a convenience
// export function gather() {
// 	//
// }
