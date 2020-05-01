export function tuple<L extends any[]>(...args: L) {
	return args
}

export function exec<T>(fn: () => T): T {
	return fn()
}

export type Dict<T> = { [key: string]: T }
export type Primitive = string | number | boolean | null | undefined
export type OnlyAllow<A, E> = A extends E ? A : never
export type Comparator<T> = (left: T, right: T) => boolean

export const noop = () => {}
export const alwaysTrue = () => true
export const alwaysFalse = () => false
export const eq = <T>(left: T, right: T) => left === right

export type Fn = () => unknown
export type Handle = () => void
export type Registrar = (fn: Fn) => void

export type Equivalent<T, U> = T extends U ? U extends T ? true : false : false
export type Negate<B extends boolean> = B extends true ? false : true
export type TupleLike<T> = T extends any[] ? Negate<Equivalent<T, any[]>> : false
export type Overwrite<A, B> = {
	[K in Exclude<keyof A, keyof B>]: A[K]
} & B

export type NonEmpty<T> = [T, ...T[]]
export type NonLone<T> = [T, T, ...T[]]

export type NonRedundant<T> = null | undefined | T | NonLone<T>

export class Panic extends Error {}
