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




type UnionToIntersection<U> =
	(U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never

type AllKeys<L extends any[]> = {
	[K in keyof L]: keyof L[K]
}[number]

type Extend<O, Keys extends string | number | symbol> = UnionToIntersection<{
	[K in Keys]: O extends Record<K, any>
		? { [_ in K]: O[K] }
		: { [_ in K]: undefined }
}[Keys]>

type Unify<L extends any[]> = {
	[I in keyof L]: {
		[K in AllKeys<L>]: Extend<L[I], AllKeys<L>>
	}[AllKeys<L>]
}[number]


type L = [A, B]
type O = Unify<L>



import { Dict } from '../utils'

// there are a small number of primitive types that we don't have to derive anything for
// number, string, boolean
export type Route =
	| '/todo'
	| '/todo/:id<number>?<Query>'

type RouteHandler<P extends string, T extends Dict<any>> = { path: P, matcher: RegExp, decoder: Decoder<T> }

type ProduceRouteType<R extends RouteHandler<string, Dict<any>>[]> = Unify<{
	[K in keyof R]: R[K] extends RouteHandler<any, infer T>
		? T
		: never
}>

type Handlers = [
	{ path: '/todo', matcher: RegExp, decoder: Decoder<{ query: Partial<Query> }> },
	{ path: '/todo/:id<number>?<Query>', matcher: RegExp, decoder: Decoder<{ id: number, query: Partial<Query> }> },
]
// here the above Route would end up in this state at the end
type Route = ProduceRouteType<Handlers>
// with a final unified type of:
// type Route = { id: number | undefined, query: Partial<Query> }



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
	{ name: 'detail', path: '/todo/:id<number>?<Query>', matcher: RegExp, decoder: Decoder<{ id: number, query: Partial<Query> }> },
]
// here the above Route would end up in this state at the end
type Route = ProduceNamedRouteType<Handlers>
// with a final discriminated type of:
// type Route = { path: 'new' } | { path: 'detail', id: number, query: Partial<Query> }

// at the end of the day this will involve producing:
// - the implied decoders (the reasonable thing to do here is just stamp out a decoder directly and use the TypeOf helper to extract the type)
// - the regex that tests for each variant, and maybe a union regex to test if this route specifically is on deck
