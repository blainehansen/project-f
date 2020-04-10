import ts = require('typescript')

// const identRegex = /[a-zA-Z_]\w*/
const dynamicSegment = /:[a-zA-Z_]\w*(<[a-zA-Z_]\w*>)?/
// const stringElidedSegment = /:[a-zA-Z_]\w*/

function split(path: string) {
	const [route, ...querySegments] = path.split('?')
	if (querySegments.length > 1) throw new Error(`this path has a badly formatted query segment: %${path}`)

	if (route === '/')
		return true

	const routeSegments = route.split('/')
	console.log(routeSegments)
	console.log(querySegments)

	let rooted = false
	for (const segment of routeSegments) {
		if (segment === '') {
			if (rooted) throw new Error(`this path has a stuttering slash: ${path}`)
			rooted = true
		}
		console.log(segment.match(dynamicSegment))
	}

	console.log()
}

split('todo')
split('/todo')
split('/todo/:id<number>')
split('/?<Query>')





import { Dict } from '../utils'

// there are a small number of primitive types that we don't have to derive anything for
// number, string, boolean
export type Route =
	// since there are two possibilities, we need to infer that id could be missing? and therefore null
	// the biggest point is that we need to create a unified type
	| '/todo'
	| '/todo/:id<number>?<Query>'

type RouteHandler<P extends string, T extends Dict<any>> = { path: P, matcher: RegExp, decoder: Decoder<T> }

type ProduceRouteType<R extends RouteHandler<string, Dict<any>>[]> = {
	[K in keyof R]: R[K] extends RouteHandler<infer P, infer T>
		? T
		: never
}[number]

type Handlers = [
	{ path: '/todo', matcher: RegExp, decoder: Decoder<{ id: undefined, query: {} }> },
	{ path: '/todo/:id<number>?<Query>', matcher: RegExp, decoder: Decoder<{ id: number, query: {} | Query }> },
]
// here the above Route would end up in this state at the end
type Route = ProduceRouteType<Handlers>
// with a final unified type of:
// type Route = { id: number | undefined, query: {} | Query }



export type DiscriminatedRoute =
	| ['new', '/todo']
	| ['detail', '/todo/:id<number>?<Query>']

type NamedRouteHandler<P extends string, T extends Dict<any>> = { name: P, path: string, matcher: RegExp, decoder: Decoder<T> }

type ProduceNamedRouteType<R extends NamedRouteHandler<string, Dict<any>>[]> = {
	[K in keyof R]: R[K] extends NamedRouteHandler<infer N, infer T>
		? { path: N } & T
		: never
}

type Handlers = [
	{ name: 'new', path: '/todo', matcher: RegExp, decoder: Decoder<{}> },
	{ name: 'detail', path: '/todo/:id<number>?<Query>', matcher: RegExp, decoder: Decoder<{ id: number, query: {} | Query }> },
]
// here the above Route would end up in this state at the end
type Route = ProduceNamedRouteType<Handlers>
// with a final discriminated type of:
// type Route = { path: 'new' } | { path: 'detail', id: number }

// the most reasonable way to handle this is to do the most "convenient" thing first, the unified type
// and then have a stricter variant like `DiscriminatedRoute` that does the safer thing
// that way we give everyone what they want with a simple opt in and a name change

// export type Handler = [
// 	// { path: '/todo', matcher: RegExp, decoder: Decoder<{}> },
// 	{ path: '/todo/:id<number?>', matcher: RegExp, decoder: Decoder<{ id?: number }> },
// ]

// export type Handler = [
// 	{ path: '/todo', matcher: RegExp, decoder: Decoder<{ id: undefined }> },
// 	{ path: '/todo/:id<number>', matcher: RegExp, decoder: Decoder<{ id: number }> },
// 	{ path: '/todo/:id<string>', matcher: RegExp, decoder: Decoder<{ id: string }> },
// ]

type Route = ProduceRouteType<Handler>

function r(d: Route) {
	console.log(d.id)
}


// the simple way to create a unified type for this is to simply create a discriminated union
// with the route text as the discriminant! then we just fill in the rest of the types from there

// at the end of the day this will involve producing:
// - a type for the whole thing
// - the implied decoders (the reasonable thing to do here is just stamp out a decoder directly and use the TypeOf helper to extract the type)
// - the regex that tests for each variant, and maybe a union regex to test if this route specifically is on deck
