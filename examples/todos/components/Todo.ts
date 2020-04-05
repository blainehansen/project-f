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

	const insertionPoint = document.createTextNode('')
	component.appendChild(insertionPoint)

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

		return domInsert(range, content)
	}, { start: insertionPoint, end: insertionPoint })

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
	slots: {  },
}

function setup({ todo, celebrateCompletion }: Args<Component>) {
	const { description, completed } = spreadOdbject(todo)
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
