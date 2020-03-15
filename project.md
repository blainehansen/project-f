# reactivity
watch
computed with manual dependency declaration
"pipe", computed with both manual and automatic dependencies that modifies multiple signals, tuple or object?
"drifter", a computed that you can mutate in the interim (all we've done is relax the invariant that the value is always equal to the result of that computation)
computed with a "setter" rule

tuple spread value creator
object spread value creator
deep object value creator?

reactive array
reactive tuple (probably achievable with above and generics)
reactive dictionary
reactive object (probably achievable with above and generics)

"watchGuard", a watcher that only fires when some boolean function (which can be a type guard!) returns true, this makes it so we can wait until something particular happens. also could have a version that either returns the arguments of the computation function or undefined to indicate not to run ("watchFilter" for one that perhaps returns args and "watchGate" or something for other)

"reducer" that takes an initial value and an accumulator function

"gather" takes a bunch of signals and calls them all, just a convenience

what's the potential utility of write only signals?

# state management
thunks

# framework
