It's time to figure out our docs

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
  span(&fn={ () => unsafe(rawHtml) })
```


## Attributes

```wolf
div(id=dynamicId)
div(id={ reactiveId() })


button(disabled=isButtonDisabled)

//- static string attributes work the same as before
button(disabled="true")
```

<!-- there are a couple of ways around the problem of whether to "prop-wrap" things or not -->

```wolf
//- make a shorthand for "don't call"
div(hidden.direct=something)
div(*hidden=something)

//- make a shorthand for the opposite, "call"
div(hidden.bind=something)
div((hidden)=something)
div(*hidden=something)

//- make a shorthand for "wrap", as in take my non Immutable and turn it into one
div(hidden.wrap=something)
```

## Using Expressions

```wolf
| {{ number + 1 }}

| {{ ok ? 'YES' : 'NO' }}

| {{ message.split('').reverse().join('') }}

div(id={ 'list-' + id })
```

# Node Functions

Sometimes we need to act on some dom node directly. The `&receive` attribute allows us to do that.

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
p(&fn=makeRed)

//- Since we can pass any expression to fn, it can be anything
p(&fn={ p => { p.style.color = 'red' } })
```

Within this function, you could set custom event handlers, set up reactive computations with something like `Reactivity.effect`, or whatever you like.

Just be sure to clean up any side effects you produce!

## The builtin `show`

# Class and Style Bindings

Still figuring this out. Dynamic metas can do some of this lifting, but ultimately there's a lot of options here.


# Conditional Rendering

```wolf
@if (awesome): h1 Wolf is awesome!

@if (awesome): h1 Wolf is awesome!
@else: h1 Oh no 😢

@if (type === 'A'): div A
@else-if (type === 'B'): div B
@else-if (type === 'C'): div C
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

## Using `key` to control conditional reuse

Still thinking about this


# List Rendering with `@each`

```wolf
ul#example-1
  <!-- :key="item.message" -->
  @each (item in items())
    li {{ item.message }}
```

```ts
export function setup() {
  const items = channel([
    { message: 'A' },
    { message: 'B' },
  ])
  return { items }
}
```

```wolf
ul#example-2
  @each ((item, index) in items(), key=item.message)
    span {{ index }}
    li {{ parentMessage() }} - {{ item.message }}
```


```ts
export function setup() {
  const parentMessage = value('Parent')
  const items = channel([
    { message: 'A' },
    { message: 'B' },
  ])
  return { parentMessage, items }
}
```


## Using `@each` with an Object

You gotta do it right, and use the smart iterator methods to do this.


## Using `@if` and `@each` together

Since `@if` and `@each` aren't attached to particular nodes, they can be intuitively composed together.

```wolf
//- only render the loop if the condition is true
@if (condition)
  @each (item in items()) {{ item.name }}

//- only render an item of the loop if the condition is true (you can think of this like `continue` in for loops if nothing is rendered)
@each (item in items())
  @if (item.condition) {{ item.name }}
```

# Event Handling

```wolf
button(@click=greet) Greet
```

```ts
export function setup() {
  function greet(event: Event) {
    alert('Hello!')
    if (event.target)
      alert(event.target.tagName)
  }
  return { counter }
}
```

<!-- blaine, this seems like a nice place to automatically handle function wrapping -->
<!-- it isn't that bad to see if the trimmed beginning is some arrow function thing right? -->

```wolf
button(@click={ counter(counter() + 1) }) Add 1
```

```ts
export function setup() {
  const counter = value(0)
  return { counter }
}
```


```wolf
button(@click={ say('hi') }) Say hi
button(@click={ say('what') }) Say what
```

```ts
export function setup() {
  const say = (message: string) => alert(message)
  return { say }
}
```

You can also use the `$event` variable.

```wolf
button(@click={ warn('Form cannot be submitted yet.', $event) }) Submit
```


## Event Modifiers

Very reasonable, do it basically exactly as he states.


## Key Modifiers

Also very reasonable.


### Ack try your best with system modifiers and mouse button modifiers


# Form Input Bindings

For low level primitive html inputs, the `:sync` attribute is used to bind the value of the input to some signal. In general, the syntax of prefixing a colon `:` on some attribute means that the attributed is "synced", a two-way binding, so whatever you pass will be expected to be of type `Mutable`.

## Text

```wolf
//- default type is text
input(:sync=message, placeholder="edit me")
p Message is: {{ message() }}
```

## Multiline Text

```wolf
span Multiline message is:
p(style="white-space: pre-line;") {{ message() }}
br
textarea(:sync=message, placeholder="add multiple lines")
```

# Checkbox

```wolf
input#checkbox(type="checkbox", :sync=checked)
label(for="checkbox") {{ '' + checked() }}
```

```ts
export function setup() {
  const checked = value(false)
}
```

<!-- TODO do the fancy thing of binding checkbox to an array or Set if there is a "value" on the checkbox? -->
<!-- TODO another fancy thing, true-value and false-value -->

## Radio

```wolf
input(type="radio" value="One", :sync=picked) One
input(type="radio" value="Two", :sync=picked) Two
span Picked: {{ picked }}
//- of course, `value` can be dynamic
input(type="radio" value=oneVariable, :sync=picked) One
```

## Select

```wolf
select(:sync=selected)
  option(value=null) Please select one
  option A
  option B
  option C
  option(value="A") Actually A
span Selected: {{ selected() }}
```

```ts
export function setup() {
  const selected = value(null as null | 'A' | 'B' | 'C')
  return { selected }
}
```

### Multiple Select

When you give the `multiple` flag, the select will expect to bind to an array.

```wolf
select(:sync=selected, multiple)
  option A
  option B
  option C
span Selected: {{ selected().toString() }}
```

```ts
export function setup() {
  const selected = value([] as ('A' | 'B' | 'C')[])
  return { selected }
}
```


### Modifiers?

`.lazy` ehhh
`.number` could be valuable, if the `type="number"` attribute was there we could use a safe number parsing function to return a result, or even simpler would just be `string | number`
`.trim` seems simple enough



## Complex Binding

<!-- TODO blaine this might not be how you want to do this, it's less flexible -->
<!-- instead just provides functions like `setter` and then don't wrap their stuff any particular way -->
<!-- we might be able to produce a shorthand for just this one case -->
<!-- or even better! allow dot-style arguments to the sync to signal you want a shorthand -->
If you pass a complex expression to any `:sync` style binding, it will be passed to the `Reactivity.setter` function, which produces a `Mutable`. You can use this to wire up more complex reactivity.

```wolf
@if (completed()): p The task is done!
@else Oh man....
input(type="checkbox", :sync={ completed, complete })
```

```ts
export function setup() {
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

Components are defined in a single file, with a `#!` to indicate which section you're in.
The default template language is `wolf`, and the script section must be in typescript.
The type signature of the component is determined by the exported `Component` type (a "bare" component that takes no props, no syncs, emits no events, and has no slots, is inferred if this `Component` type is missing).
The exported `setup` function lets you expose variables to the template.


`ButtonCounter.iron`

```iron
#! template
button(@click={ count(count() + 1) }) You've clicked me {{ count() }} times.

#! script
export function setup() {
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
.body(&fn={ unsafe(body()) })

#!
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
  input(:sync=name, placeholder="type a name!")
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
  @each (message in messages())
    p.message {{ message }}

  +Greeter(message="Hello", @send=receive)

#! script
export function setup() {
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
    // status: ('failed' | 'succeeded' | null) => void
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
    // optionalString: (arg1: number, arg2: boolean, arg3: string?) => void
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

Syncs aren't always "real", meaning it just have to have the type of `() => T & (value: T) => void`. The parent doesn't have to *actually* give a child direct mutable access to a value. It can just listen for the child's events coming back up, and do whatever it wants with them, including ignore them.

```iron
#! template
.Checkbox
  input(type="checkbox", :sync=checked)

#! script
export type Component = {
  // now we've changed checked to be a sync instead
  syncs: { checked: boolean },
  // so we don't need that extra event
}
// and we don't need a setup function to wire everything up
// the type of checked is `Mutable` rather than `Immutable` like with a prop
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
  @slot(default: siteMetadata, globalTitle)

  @slot(footer: { links, contact })

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
    p You're using this browser! {{ metadata.browser }}

  //- we could skip footer, but we won't this time
  @insert(footer, { links, contact }): .footer-box
    p Contact us: {{ contact() }}
    p Have some links:
    @each(link in links)
      p {{ link }}
```


## How do we do dynamic components? The same I'd imagine, all of them just have to have assignable types.


# Refs

should we allow refs?
we have a few ways to do it:

- just allow them to create nodes themselves and expose them to the template, and then have a special syntax to indicate "hey this node is the place where I want you to put this"
- simply allow the `&fn` feature
- put a `refs` property on the `Component` type, so they'll receive it in their setup function
