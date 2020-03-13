export type Dict<T> = { [key: string]: T }
export type NonEmpty<T> = [T, ...T[]]
export type Primitive = string | number | boolean | null | undefined
export type OnlyAllow<A, E> = A extends E ? A : never

export const noop = () => {}
export const always = () => true
export const never = () => false
export const eq = (a: Primitive, b: Primitive) => a === b

export type Fn = () => unknown
export type Handle = () => void
export type Registrar = (fn: Fn) => void
