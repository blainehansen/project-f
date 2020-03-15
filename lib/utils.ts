export type Dict<T> = { [key: string]: T }
export type NonEmpty<T> = [T, ...T[]]
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
