// (function () {
// 	var __, __insert1, __button2
// 	__ = Surplus.createElement("div", "Todo", null)
// 	__insert1 = Surplus.createTextNode('', __)
// 	__button2 = Surplus.createElement("button", null, __)
// 	__button2.onclick = addTodo
// 	__button2.textContent = "click me"

// 	Surplus.S.effect(function (__range) {
// 		return Surplus.insert(__range, editing()
// 			? (function () {
// 				var __
// 				__ = Surplus.createElement("input", null, null)
// 				Surplus.S.effect(function () {
// 					__.type = "text"
// 					__.value = description()
// 				})
// 				return __
// 			})()

// 			: (function () {
// 				var __
// 				__ = Surplus.createElement("div", null, null)
// 				Surplus.S.effect(function (__current) { return Surplus.content(__, description(), __current) }, '')
// 				Surplus.S.effect(function () { __.className = stateClass() })
// 				return __
// 			})()
// 		)
// 	}, { start: __insert1, end: __insert1 })

// 	return __
// })()






// so we've decided on a few things:
// "syncs" use the :prefix syntax to indicate. the expression is expected to be a Mutable,
// and if they don't use a single token we assume they're calling the "setter" function with an Immutable with some setter function
// the only exception is for primitive html types like input, for which we manually wire up valid syncs

// .Todo
// 	@if (editing()):
// 		input(type="text", :value=description, @keyup.enter={ editing(false) })
// 	@else
// 		.{ stateClass() }.{ descriptionColor() }(@click=beginEditing)
// 			| {{ description() }}

// 	input(type="checkbox", :value={ completed, complete })
// 	button(@click=archive) Archive

function render({
	description, completed, stateClass, editing, beginEditing, complete,
	descriptionColor, todo, archive, celebrateCompletion,
}: Context<Component, typeof setup>) {
	const component = document.createElement('div')
	component.className = "Todo"

	const placeholder = new Comment()
	component.appendChild(placeholder)

	statefulEffect(range => {
		const content = editing()
			? exec(() => {
				const descriptionInput = document.createElement('input')
				descriptionInput.type = "text"
				descriptionInput.oninput = e => {
					description(e.target.value)
				}
				effect(() => {
					descriptionInput.value = description()
				})
				descriptionInput.onkeyup = e => {
					if (e.key === 'Enter') editing(false)
				}
				return descriptionInput
			})
			: exec(() => {
				const div = document.createElement('div')
				effect(() => {
					div.className = [stateClass(), descriptionColor()].join(' ')
				})
				div.onclick = beginEditing
				effect(() => {
					div.textContent = description()
				})
				return div
			})

		return replaceRange(range, content)
	}, { type: RangeType.empty, placeholder })

	const checkboxInput = document.createElement('input')
	checkboxInput.type = "checkbox"
	checkboxInput.onchange = complete
	effect(() => {
		checkboxInput.checked = completed()
	})

	const buttonArchive = document.createElement('button')
	buttonArchive.textContent = "Archive"
	buttonArchive.onclick = archive

	return component
}

export default function(args: FullArgs<Component>) {
	const setupData = setup(args as Args<Component>)
	return render({ ...args, ...setupData })
}

type Component = {
	props: { descriptionColor: string },
	syncs: { todo: Todo },
	events: { archive: [], celebrateCompletion: string },
	// slots: {},
}

function setup({ todo, celebrateCompletion }: Args<Component>) {
	const { description, completed } = splitObject(todo)
	const stateClass = computed((): string => completed() ? 'text-strike' : '')

	const editing = value(false)
	function beginEditing() {
		if (completed()) return
		editing(true)
	}

	function complete(value: boolean) {
		completed(value)
		if (value)
			celebrateCompletion(description())
	}

	return { description, completed, stateClass, editing, beginEditing, complete }
}


export function Todo(description: string, completed: boolean) {
	return { description, completed }
}
export type Todo = ReturnType<typeof Todo>


// function object() {
// 	//
// }
