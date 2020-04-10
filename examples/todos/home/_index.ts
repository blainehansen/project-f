export type Query = {
	// searchText
	q: string,
	// filterCompletion
	c: boolean,
}

// the base route has a well-typed query argument portion
// the compiler will automatically derive a decoder for the parameterized type
// which will be used to validate incoming routes, showing an error when they aren't right
// also, all the dynamic sections of a route will be spread as props to the component
// this means that this Route type is the *full* description of the Components type
// Page components are different than normal ones
@rigor
export type Route = '/?<Query>'

function render() {
	return computed(() => {
		//
	})
}

function setup() {
	//
}

// class App {
// 	constructor() {}
// 	render = render
// }
export default function() {
	const context = setup()
	return render(context)
}
