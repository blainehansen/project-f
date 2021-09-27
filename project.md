- for this project to be done, people can:
  - tooling
    - install a webpack loader and have it work
    - or just run a cli on a directory
    - use an editor plugin for nice syntax highlighting
  - feel good while writing it
    - everything is extraordinarily type-safe, but well-inferred
    - the templating language is terse but very expressive
    - the declarative data is ergonomic

# tasks
- fix dom manipulation library (need to actually think about new interface given move toward more imperative style and fragment gathering)
- much more exact and advanced thinking about reactivity
  - safe class-based api
  - actually do various combinators
  - need way to safely mutate signals in a reactive context
- lots of testing for everything
- fix kreia







- state management system, especially with "thunk" objects, and desperately want self canceling async reactive wrappers
- routing, static vs compile time resolved vs dynamically resolved
- how to constrain type system to only allow node and browser apis in certain places
- wolf (and basic html version using third party parser)
- markdown variant
- whatever macro layers




# framework
https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Performance_best_practices_for_Firefox_fe_engineers
https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback
https://hacks.mozilla.org/2016/11/cooperative-scheduling-with-requestidlecallback/

use a `requestAnimationFrame` eternal loop to create a new batch every frame, and maybe even slower than that (skip every other frame?).
at the beginning of the frame function, run the old batch with `batch.run()`. then create a new batch that will intercept all signal mutations
all the signals triggered in "tick" will not actually produce any dom operations until the frame function begins and


# reactivity
rip off a bunch of the observable operators

watch
"combine" or maybe "join", computed with manual dependency declaration, especially useful to create a tuple or object spread since that produces multiple signals all with those same precise dependencies
"pipe", probably the automatic version of the above "combine"
"drifter", a computed that you can mutate in the interim (all we've done is relax the invariant that the value is always equal to the result of that computation)
"refresher" for computeds, it will run the underlying computation again

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







The `Rigor` stack. `thin-ql` and whatever forms of typed api contract stuff on backend, along with managed sql migrations and rust sql macros. then the front uses result oriented http with generated api definitions from backend, the router and top level management are also generated.







## Features, ranked in priority order

- concise, whitespace sensitive html templating language that compiles to dom functions
- typed html tags (including attributes, style block, etc)
- typed components, with args, props, syncs, slots, and events
- standalone function-based reactivity engine
- path-based routing

```python
src/
  # in order to gain access to the window variable, you have to use a special ClientComponent
  # it has the browser window passed in or captured or something
  # what that means is that when the code is compiled and rendered (in node mode!!) that any references won't be valid
  # maybe we even want to do that with node stuff? afterall neither will exist

  # this directory is ignored, and all .iron files will have their default export globally registered
  # configurable
  components/
  # all these components will be expected to have a special RouteComponent as their default export
  # _ as prefix makes this file the index of its directory
  # /
  /_home.iron
  # the component prop definitions will be checked against this!!
  # /user/6
  # this is dynamic
  /user/:id.iron
  /users.iron

  # these are static
  # somewhere there has to be a function or file that fills these in
  /projects/$slug.iron
```

- single file components
- static generation by default, with dynamic boundaries
- typed css preprocessor, which merely passes typescript interpolations through
- preprocessor is enhanced with a utility generation system. the utility generation script creates a huge map of utility class names, and those are available to be applied or used
- all class names in the template are checked for existence













# Manifesto


There are a huge number of frontend frameworks, but none of them meet all the standards I crave for a framework, since none of them have the same values I have. These values are in priority order:

Robustness/safety should the most important concern for every engineer and every engineering project. No other pursuit gives us as many benefits to our productivity and improves the quality of our code as robustness does. Prioritizing robustness does require significant investment in tools, but that investment delivers the highest return.

My belief about software engineering at this point is that we collectively have massively ignored this value, and every year we pay for it dearly. If we all collectively shift our focus to make this value our highest value, then the compounding benefits we'll enjoy will be massive and will quickly pay for themselves.

- Robustness (as many errors and bugs as possible are caught by the build process). Having robustness allows for confident additions and changes to the code. Refactors and new features can be pursued with abandon.
- Code conciseness.
- Performance.
- Ease of understanding.

I believe everyone has allowed javascript to misguide them. By prioritizing "just-javascript"ness, we have created a whole bunch of frameworks that completely ignore much more important qualities. The "just-javascript"ness of these frameworks is a pointless red herring that gets us almost nothing in return for sacrificing a lot of more important things. This is most apparent in everyone's attempts to ignore typescript, and the insistence of almost every framework on having "magical" reactivity.


It's alright for something to be more complex, *and even more tedious*, IF that thing can be checked in an automated way. The only reason complexity should scare us is if we can't get the complexity right, if it will grow beyond us and lead to problems. If it can be checked in an automated way, then that really isn't much of a problem.

## Things that have become obvious

### Static typing

There's absolutely no reason to not use a typesafe language anymore. This really should have been the *only* priority of the web development community until it was robustly solved. Typescript is good enough! If you just take the time to push yourself to learn and understand conditional and mapped types (and occasionally dip into the unholy alchemy of recursive types) then you can still retain all the dynamism of javascript but with a set of type checks that are strong enough.

The typescript team essentially added compile-time macros to the language in the form of their conditional and mapped types.

### Make **everything** typesafe

Similarly, once you have a sufficiently typesafe language, there's no reason not to endeavor to extend its reach into *every* corner of your code. Every single thing you do should be checked at compile time, and this desire *should take priority over every other concern*. The creation of well-designed dsl's and macros can do the work of making this robustness concise and readable.

### Typed css

And speaking of making everything typesafe, this is the biggest thing we've been ignoring all this time when it comes to robustness. I propose a new way of thinking about css, where:

- Every single classname in every template in your project should be checked to ensure it exists in the css.
- All css should be checked for type correctness. If I use a color on the `width` property, my build process should catch that. There are [some projects](https://github.com/typestyle/typestyle) [pursuing this idea](https://github.com/frenic/csstype), but they're only focused on css-in-js. They also haven't achieved *true* type safety, since invalid values can still be passed such as the invalid colors `'blah'` or `'#RRRRRR'`, or the invalid size `'40pfx'`
- All css preprocessors should be fully typed. The most reasonable way I can figure to do this at this point is to translate css into a [typescript ast](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#creating-and-printing-a-typescript-ast), and then trick the typescript compiler into checking it for you. Typed css libraries like those mentioned above could be mixed with a preprocessor to get the best of all worlds. Here's a tiny proof of concept that hijacks the typescript compiler to make it check a constructed ast (the current version is in [`/lab/main.ts`](./lab/main.ts)).

https://eeyo.io/iro/documentation/


```ts
import { dirname, join } from 'path'
import ts = require('typescript')

const options = {
  strict: true,
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.CommonJS,
}

// target.ts is just an empty file, you could easily just use a temporary file for this
// we're just getting the typescript compiler to set up all the correct dependencies for type checking
const target_filename = join(dirname(__filename), 'target.ts')
const program = ts.createProgram([target_filename], options)

const pos = 0
const end = 4
const ident = ts.createIdentifier('yoyo')
ident.pos = pos
ident.end = end
const statement = ts.createExpressionStatement(ident)
statement.pos = pos
statement.end = end
const statements = ts.createNodeArray([statement])
statements.pos = pos
statements.end = end

for (const [index, source_file] of program.getSourceFiles().entries())
  if ((source_file as any).path === target_filename) {
    source_file.text = 'yoyo'
    source_file.statements = statements
    const diagnostics = ts.getPreEmitDiagnostics(program)
    // this will correctly be a list with one diagnostic with messageText = "Cannot find name 'yoyo'."
    console.log(diagnostics)
  }
```

### Scoped css

Similarly, the "cascading" nature of css is almost never worth the trouble. Whatever css you write should be stricly scoped to a small component, and shouldn't apply anywhere else. As our codebases have become truly large, this has only become more and more obvious.

### Utility first css

It only makes sense to have a design system that is both strict and very flexible. Projects like [tailwind css](https://tailwindcss.com/) have made it fairly obvious that it makes a lot of sense to just use a fully fledged language to generate utility classes that represent your design system, and then use them.

If this approach was fully melded with a typesafe css preprocessor (since you do *occasionally* need to write custom css) and scoped css, then we would finally have built a methodology that allows maintainable css.

### Non-magical reactivity

Almost every framework has a reactivity system that attempts to make normal variables *seem* reactive. This is very often done with the [getter/pattern](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get), or with [proxies](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) if the framework is willing to compromise browser compatibility.

While this seems convenient, I would argue that we lose more than we gain:

- Whether some variable is potentially reactive or not isn't clear, since reactive accesses look the same as normal accesses.
- Reactivity breaks down in many cases, such as in objects like arrays that don't support getter/setter.
- Reactivity can be lost if a variable is separated from the container that makes it reactive.
- Have to jump through hoops to only pass a *handle* to a reactive value to someone else without triggering a dependency for yourself.

Just accepting the small syntactic weight of [using functions for reactivity](https://github.com/adamhaile/S) makes all those problems disappear:

```ts
// name *is* the reactive value, and we understand that only by calling it do we interact with its reactivity
const name = R.value('hello')

// we can easily create combinators on reactive values
const upper = computed(name, name => name.toUpperCase())

// when we use it in functions that are reactive-aware,
// we can easily see where the edges of the reactivity are
function render() {
  return `Your name is: ${name()}, and when you shout it looks like this: ${upper()}`
}

// we can bundle and unbundle these variables without worrying about compromising their reactivity
const data = { name, upper }
const { name } = data

// and we're able to very easily move variables without actually triggering them
pass_to_someone_else(upper)
```

This is an example of people obsessing over "just-javascript" and getting basically nothing for their efforts. It's a fussiness that we need to get over. Javascript is a garbage language, and it can't be replaced fast enough.


### Exposed reactivity engines

Whatever reactivity engine is used internally by the framework should be exposed and documented for the users. Doing so allows them to create custom combinators or arbitrary systems, as well as simply to understand the nature of the tool they're using.

### Compiler-oriented *can* be superior

The creator of [Svelte correctly realized](https://svelte.dev/blog/frameworks-without-the-framework) that a compiler has the *potential* to dramatically improve every quality of the code that we ship. It can perform compile-time optimizations, check code for correctness, expand or transform code, etc.

Everyone, not just in the web development community *but throughout all branches of software engineering* should be taking this lesson to heart.

It's important to note however that simply using a compiler doesn't *guarantee* these benefits. The compiler in question has to be well-designed and well-executed.

### As much compile-time static generation as possible

Related to the predvious point, there's no reason not to move towards [statically generated sites.](https://nuxtjs.org/guide/commands/#static-generated-deployment-pre-rendered-). There are many ways to statically generate all the truly static aspects of a site and [define boundaries that are only dynamic](https://nuxtjs.org/api/components-client-only/) and shouldn't be pre-rendered.

### Path-defined routing

### Name and argument capable slots


## Things I prefer

### DSLs *can* make code more concise, readable, and expressive (also provide benefits of compiler-oriented)

### Single file components
