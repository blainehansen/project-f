bunch of intended changes:

- don't do this stupid S interface thing, just export functions by name so that they're tree-shakable
- create some kind of async buffering mode for computations?
- allow for both read and write only signals
- have more nuanced wrappers, such as a ref that only contains a primitive, things that make the keys of an object reactive, a reactive array and dictionary, etc
- it seems that the "freeze" thing should be the default?

logs all dependencies (probably the same as S())
effect
uses explicit dependencies
watch

logs all dependencies but expects the function to return a value
computed

in the state management library we'll want thunks

probably want some watcher concepts that always run on every change and others that only run when the comparator says there's a difference

definitely want a "sample" function

with a "drifter" or "shared" ref concept, it's possible to have something always be set by some "computed"-like computation,
but still allow other outside code to mutate it
all we've done is relax the invariant that the value is always equal to the result of that computation

if we can figured out some "reactive actor" concept that makes it easy for people to make a class fully readonly reactive
in a single threaded environment, actors are really just about access control, and the invariants that come along with it

freeze is really "batch" or something

a watcher that only fires when some boolean function (which can be a type guard!) returns true
this makes it so we can wait until something particular happens

some "reducer" function that takes an initial value?

this only takes in primitives, so no comparator function is needed
value

this only takes things that extend objects, and a comparator is required
ref

this is basically just like a value or ref, but it doesn't care what it gets,
and it triggers on every update, without any comparisons
channel

takes a bunch of signals and calls them all, just a convenience
gather
