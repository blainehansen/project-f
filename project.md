# reactivity
"crossed diamond" computed test with unmutated secondary signal
comparator stuff
watch
computed with manual dependency declaration
computed with both manual and automatic dependencies that modifies multiple signals, tuple or object? "pipe"
"drifter", a computed that you can mutate in the interim (all we've done is relax the invariant that the value is always equal to the result of that computation)
computed with a "setter" rule

tuple spread value creator
object spread value creator
deep object value creator?
ref or readonly creator

reactive array
reactive tuple (probably achievable with above and generics)
reactive dictionary
reactive object (probably achievable with above and generics)

"actors", for controlling mutability from outside (in a single threaded environment, actors are really just about access control, and the invariants that come along with it)

"channels", triggers on every update, without any comparisons

"watchGuard", a watcher that only fires when some boolean function (which can be a type guard!) returns true, this makes it so we can wait until something particular happens. also could have a version that either returns the arguments of the computation function or undefined to indicate not to run ("watchFilter" for one that perhaps returns args and "watchGate" or something for other)

"reducer" that takes an initial value and an accumulator function

"gather" takes a bunch of signals and calls them all, just a convenience

what's the potential utility of write only signals?

# state management
thunks

# framework
