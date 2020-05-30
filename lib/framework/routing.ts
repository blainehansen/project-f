import ts = require('typescript')

// /[a-zA-Z_]\w*/
const dynamicSegment = /:([a-zA-Z_]\w*)(<[a-zA-Z_]\w*>)?/

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
			console.log('rooted:', true)
			rooted = true
		}
		console.log('segment:', segment)
		console.log(segment.match(dynamicSegment))
	}

	console.log()
}

split('todo')
split('/todo')
split('/todo/:id<number>')
split('/:stuff')
split('/?<Query>')




// type UnionToIntersection<U> =
// 	(U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never

// type AllKeys<L extends any[]> = {
// 	[K in keyof L]: keyof L[K]
// }[number]

// type Extend<O, Keys extends string | number | symbol> = UnionToIntersection<{
// 	[K in Keys]: O extends Record<K, any>
// 		? { [_ in K]: O[K] }
// 		: { [_ in K]: undefined }
// }[Keys]>

// type Unify<L extends any[]> = {
// 	[I in keyof L]: {
// 		[K in AllKeys<L>]: Extend<L[I], AllKeys<L>>
// 	}[AllKeys<L>]
// }[number]


// type L = [A, B]
// type O = Unify<L>



// import { Dict } from '../utils'

// // there are a small number of primitive types that we don't have to derive anything for
// // number, string, boolean
// export type Route =
// 	| '/todo'
// 	| '/todo/:id<number>?<Query>'

// type RouteHandler<P extends string, T extends Dict<any>> = { path: P, matcher: RegExp, decoder: Decoder<T> }

// type ProduceRouteType<R extends RouteHandler<string, Dict<any>>[]> = Unify<{
// 	[K in keyof R]: R[K] extends RouteHandler<any, infer T>
// 		? T
// 		: never
// }>

// type Handlers = [
// 	{ path: '/todo', matcher: RegExp, decoder: Decoder<{ query: Partial<Query> }> },
// 	{ path: '/todo/:id<number>?<Query>', matcher: RegExp, decoder: Decoder<{ id: number, query: Partial<Query> }> },
// ]
// // here the above Route would end up in this state at the end
// type Route = ProduceRouteType<Handlers>
// // with a final unified type of:
// // type Route = { id: number | undefined, query: Partial<Query> }



// export type DiscriminatedRoute =
// 	| ['new', '/todo']
// 	| ['detail', '/todo/:id<number>?<Query>']

// type NamedRouteHandler<P extends string, T extends Dict<any>> = { name: P, path: string, matcher: RegExp, decoder: Decoder<T> }

// type ProduceNamedRouteType<R extends NamedRouteHandler<string, Dict<any>>[]> = {
// 	[K in keyof R]: R[K] extends NamedRouteHandler<infer N, infer T>
// 		? { path: N } & T
// 		: never
// }

// type Handlers = [
// 	{ name: 'new', path: '/todo', matcher: RegExp, decoder: Decoder<{}> },
// 	{ name: 'detail', path: '/todo/:id<number>?<Query>', matcher: RegExp, decoder: Decoder<{ id: number, query: Partial<Query> }> },
// ]
// // here the above Route would end up in this state at the end
// type Route = ProduceNamedRouteType<Handlers>
// // with a final discriminated type of:
// // type Route = { path: 'new' } | { path: 'detail', id: number, query: Partial<Query> }

// // at the end of the day this will involve producing:
// // - the implied decoders (the reasonable thing to do here is just stamp out a decoder directly and use the TypeOf helper to extract the type)
// // - the regex that tests for each variant, and maybe a union regex to test if this route specifically is on deck





// // there are several questions


// // it seems it's never reasonable to infer a missing parameter,
// // since we're being so strict with types
// // there is however the situation of "overlapping with index"
// // if someone does something like this:
// // /user
// // /user/:id?
// // these two overlap, and an undefined id will require using the same component
// // as with a defined id

// // does this mean we shouldn't have undefined segments?
// // should people just get that same behavior by having two different routes
// // pass a different prop to the same component

// // each component can have multiple strings that match it,
// // there is only *one* of these mappings per page component
// // and route segments *never* map to the empty string
// // (we can ensure this by testing it against the empty string)

// import { Ok, Err } from '@ts-std/monads'


// function splitRoute(input: string) {
// 	const route = input.endsWith('/')
// 		? input.slice(0, input.length - 1)
// 		: input

// 	let last = 0
// 	const give = []
// 	for (let index = 0; index < route.length; index++) {
// 		const char = route[index]
// 		if (char === '/') {
// 			if (last !== 0 && last === index)
// 				return Err(`stuttering slash: ${input}`)

// 			give.push(route.slice(last, index + 1))
// 			last = index + 1
// 		}
// 	}
// 	give.push(route.slice(last))

// 	return Ok(give)
// }

// console.log(splitRoute('/user/:id'))
// console.log(splitRoute('/user/:id/'))
// console.log(splitRoute('user/:id/'))
