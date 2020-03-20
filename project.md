The `Rigor` stack. `thin-ql` and whatever forms of typed api contract stuff on backend, along with managed sql migrations and rust sql macros. then the front uses result oriented http with generated api definitions from backend, the router and top level management are also generated.

# typescript macros
It's official, the typescript project is too much of a past-locked mangle, it isn't worth chasing my tail to fix their idiot mistakes and try to make that ecosystem bearable. If you really want to go all the way, you can just work on carbon. But if you want to gain some recognition and independence in the meantime then it makes more sense to just go with these simpler projects. Just keep everything possible in rust and only deal with typescript in the smallest necessary ways.

Just have some very specific target files that you manually ingest with `createProgram` walk/transform yourself.
Another flavor is to simply generate templates based on some external definition, and then import/check the actual code to ensure it meets the definition. When doing things where that makes sense go that route for now.


# reactivity
watch
"combine" or maybe "join", computed with manual dependency declaration, especially useful to create a tuple or object spread since that produces multiple signals all with those same precise dependencies
"pipe", probably the automatic version of the above "combine"
"drifter", a computed that you can mutate in the interim (all we've done is relax the invariant that the value is always equal to the result of that computation)

computed with a "setter" rule, this is perhaps a simple version of actors that only mediates a single value

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
