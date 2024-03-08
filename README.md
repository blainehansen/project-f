# :warning: this repo is dormant for now :warning:

I might return to it some day, but don't hold your breath!

Feel free to check out the rough unfinished documentation below.

---

# Template Syntax

## Text

```wolf
span Message: {{ msg() }}
```

In a static context this will only produce a render, and won't be reactive at runtime

## Raw HTML

```wolf
p Using interpolation (will be escaped): {{ rawHtml }}
p
  | Using directive (won't be escaped):
  //- this is intentionally inconvenient!
  span((fn)={ () => unsafe(rawHtml) })
```


## Attributes

```wolf
div(id=dynamicId)
div(:id=reactiveId)


button(disabled=isButtonDisabled)

//- static string attributes work the same as before
button(something="yoyo")
```

Four levels of attribute binding

- static, with the string syntax: `attr="something"`
- dynamic, but non-reactive: `attr=something` `attr={ something.complex() }`
- dynamic, reactive `Immutable`: `:attr=something` `:attr={ something.complex() }`
- dynamic, reactive `Mutable`: `!attr=something` `!attr={ something.complex() }`

this means there's no behavioral difference between the bare and complex forms for each of these

the argument syntax of the actual component can have multiple separate objects representing the props/syncs/etc. since the users will never actually interact with that form, the prefixes just let the framework know which group to put this symbol in. the generated code can then just destructure each group in the args, and lump them all together in the call to the setup function.

`:attr|fake={ some expression that will be wrapped in an Immutable }` shorthand might be nice to allow wrapping non `Immutable` values
`!attr|fake={ some expression that resolves to an Immutable }` shorthand would also be nice to generate a fake `Mutable` from an `Immutable`, with a noop setting side
`!attr|setter={ get, set }` shorthand would also be nice to generate a setter from a non `Mutable`

all of these shorthands would merely exist to save people noisy imports for these common cases

in the context of props and syncs to components, the reactive options won't be wrapped or called in any way, but merely passed down to the component. so they aren't reactive *at the site*, but reactive within the component once used

## Using Expressions

```wolf
| {{ number + 1 }}

| {{ ok() ? 'YES' : 'NO' }}

| {{ message.split('').reverse().join('') }}

div(id={ 'list-' + id })
```

# Node Functions

Sometimes we need to act on some dom node directly. The `(fn)` attribute allows us to do that.

In this example, let's say `makeRed` is a function in scope that looks like this:

```ts
function makeRed(node: HTMLParagraphElement) {
  // this is a dumb example,
  // since you could just set style.color in the template
  node.style.color = 'red'
}
```

Then we can set `makeRed` to receive our paragraph:

```wolf
p((fn)=makeRed)

//- we can pass any expression to (fn)
p((fn)={ p => { p.style.color = 'red' } })
```

Within this function, you could set custom event handlers, set up reactive computations with something like `Reactivity.effect`, or whatever you like.

Just be sure to clean up any side effects you produce!

## The builtin `show`

TODO

# Class and Style Bindings

TODO Still figuring this out. Dynamic metas can do some of this lifting, but ultimately there's a lot of options here.


# Conditional Rendering

```wolf
@if (awesome): h1 Wolf is awesome!

@if (awesome): h1 Wolf is awesome!
@else: h1 Oh no 😢

@if (type === 'A'): div A
@elseif (type === 'B'): div B
@elseif (type === 'C'): div C
@else: Not A/B/C
```

Because if blocks aren't attached to specific nodes, they automatically work to conditionally render entire sections of the template.

```wolf
@if (ok)
  h1 Title
  p Paragraph
@else
  | uh oh! There's a problem!
  button burn it down
```

## Match Statements

`@match` allows you to quickly choose between many cases.

```wolf
@match (weapon.type)
  @when ('blade')
    h1 Watch out! It's sharp!
  @when ('projectile')
    p This is a projectile weapon.
    p It shoots {{ weapon.projectile }}.
  @when ('blunt')
    //- render nothing
  @default: span unknown weapon type
```

These allow you to get all the benefits of typescript type narrowing and discriminated unions.

If you also want to play around with the complexity of [fallthrough cases](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/switch), you can also use the `@switch` directive, with its `@case`/`@fallcase` and `@default`/`@falldefault` variants.

```wolf
@switch (fruit)
  @case ('oranges')
    | Oranges are $0.59 a pound.
  @fallcase ('mangoes')
    //- since this is a fallcase
    //- this output will be rendered *in addition*
    //- to the below 'guavas' and 'papayas' cases
    strong Oh I like mangoes too!
  @fallcase ('guavas')
    //- and of course you can also render *nothing* in a case or fallcase
  @case ('papayas')
    | Mangoes, guavas, and papayas are $2.79 a pound.
    //- since this is a normal case,
    //- the fallthrough stops here

  //- in the event you ever want it,
  //- you can also use @falldefault, which is just what it sounds like
  @default
    | Sorry, we're out of {{ fruit }}.
```

## Using `key` to control conditional reuse

Still thinking about this

# Binding Variables with `@bind`

TODO think about the syntax and consequences


# List Rendering

## `@each`

```wolf
ul#example-1
  <!-- :key="item.message" -->
  @each (item of items())
    li {{ item.message }}
```

```ts
export function create() {
  const items = channel([
    { message: 'A' },
    { message: 'B' },
  ])
  return { items }
}
```

```wolf
ul#example-2
  @each ((item, index) of items(), key=item.message)
    span {{ index }}
    li {{ parentMessage() }} - {{ item.message }}
```


```ts
export function create() {
  const parentMessage = value('Parent')
  const items = channel([
    { message: 'A' },
    { message: 'B' },
  ])
  return { parentMessage, items }
}
```


### Using `@each` with an Object

You gotta do it right, and use the smart iterator methods to do this.

## `@for`

```wolf
ul#example-2
  @for (let index = 0; index < items.length; index++)
    li {{ items[index].message }}
```

## Using `@if` and `@each`/`@for` together

Since `@if` and `@each`/`@for` aren't attached to particular nodes, they can be intuitively composed together.

```wolf
//- only render the loop if the condition is true
@if (condition)
  @each (item of items()) {{ item.name }}

//- only render an item of the loop if the condition is true
@each (item of items())
  @if (item.condition) {{ item.name }}
```


# Template Macros

Sometimes we find ourself in a situation where some little piece of our template is repeated multiple times, but is too trivial to be worth its own component definition. For those situations, we have the `@template` and `@include` directives.

`@template` creates a little "macro" that can be reused with `@include`.

```wolf
h1 Hello World!

//- excitedGreeting is the name of this template
@template (&excitedGreeting)
  strong Wow how are you doing!!!!
  strong 🥰 🥰 🥰 🥰 🥰

//- templates can be thought of like little functions
//- so they can even take arguments
//- defined in the same syntax as typescript functions
@template (hello, name: string)
  div How are you doing {{ name }}?
  div Are you having a nice day?

@include (hello, 'World')
@include (hello, 'Everybody')

div Here are our wonderful people:
@each (person of people())
  @include (hello, person.name)
  @if (person.favorite)
    @include (excitedGreeting)

h2 And these are our incredible worlds!!
@each (world of worlds())
  div This world has this many inhabitants: {{ world.inhabitants }}
  @include (hello, world)
  @include (excitedGreeting)

  @each (inhabitant of inhabitants())
    div And also to you, respected {{ inhabitant.title }}
    @include (hello, inhabitant.name)
```

Strictly speaking this feature isn't *essential*, since you can always achieve the same thing by iterating over complex arrays and using other kinds of conditional statements. But when you want this feature, you'll love it.


# Event Handling

```wolf
button(@click=greet) Greet
```

```ts
export function create() {
  function greet(event: Event) {
    alert('Hello!')
    if (event.target)
      alert(event.target.tagName)
  }
  return { counter }
}
```

```wolf
button(@click={ counter(counter() + 1) }) Add 1
```

```ts
export function create() {
  const counter = value(0)
  return { counter }
}
```


```wolf
button(@click={ say('hi') }) Say hi
button(@click={ say('what') }) Say what
```

```ts
export function create() {
  const say = (message: string) => alert(message)
  return { say }
}
```

You can also use the `$event` variable.

```wolf
button(@click={ warn('Form cannot be submitted yet.', $event) }) Submit
```

If you want to provide a full handler, use the `handler` modifier.

```wolf
button(@click|handler={ e => warn('Form cannot be submitted yet.', e) }) Submit
```


## Event Modifiers

Very reasonable, do it basically exactly as he states.


## Key Modifiers

Also very reasonable.


### Ack try your best with system modifiers and mouse button modifiers


# Form Input Bindings

For low level primitive html inputs, the `!sync` attribute is used to bind the value of the input to some signal. In general, the syntax of prefixing a colon `!` on some attribute means that the attributed is "synced", a two-way binding, so whatever you pass will be expected to be of type `Mutable`.

## Text

```wolf
//- default type is text
input(!sync=message, placeholder="edit me")
p Message is: {{ message() }}
```

## Multiline Text

```wolf
span Multiline message is:
p(style="white-space: pre-line;") {{ message() }}
br
textarea(!sync=message, placeholder="add multiple lines")
```

# Checkbox

```wolf
input#checkbox(type="checkbox", !sync=checked)
label(for="checkbox") {{ '' + checked() }}
```

```ts
export function create() {
  const checked = value(false)
  return { checked }
}
```

<!-- TODO do the fancy thing of binding checkbox to an array or Set if there is a "value" on the checkbox? -->
<!-- TODO another fancy thing, true-value and false-value -->

## Radio

```wolf
input(type="radio" value="One", !sync=picked) One
input(type="radio" value="Two", !sync=picked) Two
span Picked: {{ picked }}
//- of course, `value` can be dynamic
input(type="radio" value=oneVariable, !sync=picked) One
```

## Select

```wolf
select(!sync=selected)
  option(value=null) Please select one
  option A
  option B
  option(value="C") This is the tricky one
span Selected: {{ selected() }}
```

```ts
export function create() {
  const selected = value(null as null | 'A' | 'B' | 'C')
  return { selected }
}
```

### Multiple Select

When you give the `multiple` flag, the select will expect to bind to an array.

```wolf
select(!sync=selected, multiple)
  option A
  option B
  option C
span Selected: {{ selected().toString() }}
```

```ts
export function create() {
  const selected = value([] as ('A' | 'B' | 'C')[])
  return { selected }
}
```


### Modifiers?

`.lazy` ehhh
`.number` could be valuable, if the `type="number"` attribute was there we could use a safe number parsing function to return a result, or even simpler would just be `string | number`
`.trim` seems simple enough



## Complex Binding

The `.setter` modifier can be used on any `Sync` attribute to call the `Reactivity.setter` function to create a `Mutable` wired up from two different functions.

```wolf
@if (completed()): p The task is done!
@else Oh man....
input(type="checkbox", !sync.setter={ completed, complete })
```

```ts
export function create() {
  const completed = value(false)
  function complete(value: boolean) {
    completed(value)
    if (value)
      alert('You did it!')
  }

  return { completed, complete, toggle }
}
```


# Components Basics

Components are defined in a single file, with a `#!` to indicate the beginning of a new section.
The default template language is `wolf`, and the script section must be in typescript.
The type signature of the component is determined by the exported `Component` type (a "bare" component that takes no props, no syncs, emits no events, and has no slots, is inferred if this `Component` type is missing).
The exported `setup` function lets you expose variables to the template.


`ButtonCounter.iron`

```iron
#! template
button(@click={ count(count() + 1) }) You've clicked me {{ count() }} times.

#! script
export function create() {
  const count = value(0)
  return { count }
}
```

Then, to reuse components, use the `+ComponentName` syntax.

`Main.iron`

```iron
#! template
div#components-demo
  +ButtonCounter
  +ButtonCounter
  +ButtonCounter
```


## Passing Data to Child Components with Props


`BlogPost.iron`

```iron
#! template
h3 {{ title() }}
.body((fn)={ unsafe(body()) })

#! script
export type Component = {
  props: { title: string },
}
// if no `setup` function is provided
// that's okay
```


`Main.iron`

<!-- TODO it would make a ton of sense for *static* components to not be allowed to take props -->
<!-- and *dynamic* ones to not be allowed to take args -->

```iron
#! template
+BlogPost(title="What a day")
+BlogPost(title="What a journey")
+BlogPost(title="What a life")
```


## Parent-Child Communication with Events

It's very often necessary for a child component to send some kind of messages to its parent. For that we have events.

`Greeter.iron`

```iron
#! template
.Greeter
  p I'm a child component that likes to say hello!
  input(!sync=name, placeholder="type a name!")
  button(@click=sendMessage) Send this message: {{ message() }}

#! script
export type Component = {
  props: { greeting: string },
  // this `events` type indicates that we emit one event called `send`
  // and it includes a string as payload
  // (arg: string) => void
  events: { send: string }
}

// you can destructure all the props and events directly
export function setup({ greeting, send }: Args<Component>) {
  const name = value('')
  const message = computed(() => greeting() + ' ' + name() + '!')
  // send
  const sendMessage = () => send(message())

  return { name, message, sendMessage }
}
```

Then the parent can listen for these events:

`Greeted.iron`

```iron
#! template
.Greeted
  p Here are all the messages I've received:
  @each (message of messages())
    p.message {{ message }}

  +Greeter(message="Hello", @send=receive)

#! script
export function create() {
  const messages = new ReactiveArray<string>()
  function receive(message: string) {
    messages.reactivePush(message)
  }
  return { messages, receive }
}
```

### Complex Events Types

You may be asking: can I send more complicated types to the parent? Of course!

```ts
export type Component = {
  events: {
    // events can have any typescript type as their payload
    status: 'failed' | 'succeeded' | null,
    // status: (arg: 'failed' | 'succeeded' | null) => void
    numbers: number[],
    // numbers: (arg: number[]) => void
    todo: { task: string, done: boolean },
    // todo: (arg: { task: string, done: boolean }) => void

    // and especially worth paying attention to: tuple types
    // here the tuple becomes the arguments to the function
    // so you can have events with more (or less!) than one argument

    // noArgs has the empty tuple, so it's a function with no arguments:
    noArgs: [],
    // noArgs: () => void

    // twoArgs has a tuple with two types,
    // so it's a function that takes a string and a boolean
    twoArgs: [string, boolean],
    // twoArgs: (arg1: string, arg2: boolean) => void

    // sky's the limit! you can even do optional and spread types!
    optionalString: [number, boolean, string?],
    // optionalString: (arg1: number, arg2: boolean, arg3?: string) => void
    nameAndNumbers: [string, ...number[]],
    // nameAndNumbers: (arg1: string, ...args: number[]) => void
  },
};
```

If you find yourself in a situation where you absolutely need to send a tuple as a single argument, just wrap it in an extra tuple.

```ts
export type Component = {
  events: { singleTuple: [[number, boolean, string]] }
  // singleTuple: (arg: [number, boolean, string]) => void
};
```


What if you want to use props and events together to make a parent and child cooperate to mutate some value? You can, but you probably should instead use `syncs`.


## Parent-Child Binding with Syncs

Syncs essentially put a prop and an event together in the same package.

Syncs aren't always "real", meaning it just has to have the type of `() => T & (value: T) => void`. The parent doesn't have to *actually* give a child direct mutable access to a value. It can just listen for the child's events coming back up, and do whatever it wants with them, including ignore them.

```iron
#! template
.Checkbox
  input(type="checkbox", !sync=checked)

#! script
export type Component = {
  syncs: { checked: boolean },
}
```

Sometimes a component asks for a `Sync`, but you don't actually want to let it directly mutate your value. For this, you can use the `.setter` and `.fake` shorthands.

```iron
#! template
+ChildComponent(!syncedNumber.setter={ getterSide, setterSide })

//- this creates a `Mutable` with a noop setter side
//- so equivalent to: setter(fakeSync, () => {})
+ChildComponent(!syncedNumber.fake=fakeSync)

#! script
export function create() {
  let localSum = 0
  function getterSide(): number {
    return 0
  }
  function setterSide(n: number): void {
    localSum += n
  }

  function fakeSync(): number {
    return 5
  }

  return { getterSide, setterSide, fakeSync }
}
```


## Slots

Slots allow a component to accept chunks of html from the parent.

`AlertBox.iron`

```iron
#! template
.AlertBox
  strong Error!
  @slot
```

```wolf
+AlertBox: @insert Something bad happened.
```

This is a very simple example, so we don't need to define any types for the slot. But a component can have multiple slots, and they can pass values from the inside of the component into the slot's scope. How do we safely indicate all of this?

The above example doesn't specify any names for either the receiving `slot` or the giving `insert`, so both are inferred to be "default".

Here's a fuller example with multiple named slots, some that have scope. The typing rules for slots work just like events.

`BaseLayout.iron`

```iron
#! template
header
  @slot(header)
    //- we can have fallback content,
    //- which makes this slot optional
    h1 Here's the page title

  //- all arguments passed after the slot identifier
  //- with be passed to the below scope
  @slot(default; siteMetadata, globalTitle)

  @slot(footer, { links, contact })

#! script
type Component = {
  slots: {
    // header passes no scope
    // and it has some fallback content so it's optional
    header?: [],
    // header: undefined | (arg: header) => HTML

    // default isn't optional,
    // so it has to receive something
    default: [Metadata, string],
    // default: (arg1: Metadata, arg2: string) => HTML

    // notice here how footer *is* optional!
    // but it doesn't have any fallback??
    // if no insert is given for footer, nothing will be rendered in that slot
    footer?: { links: string[], contact: Immutable<string> },
  }
}
```

`UseLayout.iron`

```iron
+BaseLayout
  //- we won't pass anything for header,
  //- which is fine because it's optional

  //- we *have* to pass something for default
  //- but we'll ignore the globalTitle passed to us
  @insert(default, metadata)
    p Here's some content for ya!
    p You're using this browser: {{ metadata.browser }}

  //- we could skip footer, but we won't this time
  @insert(footer, { links, contact }): .footer-box
    p Contact us: {{ contact() }}
    p Have some links:
    @each(link of links)
      p {{ link }}
```


## Dynamic Components

<!-- How do we do dynamic components? The same I'd imagine, all of them just have to have assignable types. -->
<!-- perhaps it's natural to have a @component or @dynamic directive -->

## Classes and Ids on component inclusions

# Refs

should we allow refs?
we have a few ways to do it:

- just allow them to create nodes themselves and expose them to the template, and then have a special syntax to indicate "hey this node is the place where I want you to put this" (might as well include this, use syntax `div(*nodeBinding)`)
- simply allow the `(fn)` feature so they can attach to and manipulate the nodes we've already created
- put a `refs` property on the `Component` type, so they'll receive it in their setup function (don't like this as much, less flexible and it fairly substantially complicates codegen)
