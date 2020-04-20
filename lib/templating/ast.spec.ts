import { NonEmpty } from '../utils'
import * as ast from './ast'

export type Entity = ast.Entity
export type AttributeValue = ast.AttributeValue

export type Tag = ast.Tag
export function Tag(...params: ConstructorParameters<typeof ast.Tag>): ast.Tag {
	return new ast.Tag(...params)
}
export type Meta = ast.Meta
export function Meta(...params: ConstructorParameters<typeof ast.Meta>): ast.Meta {
	return new ast.Meta(...params)
}
export type Attribute = ast.Attribute
export function Attribute(...params: ConstructorParameters<typeof ast.Attribute>): ast.Attribute {
	return new ast.Attribute(...params)
}
export type AttributeCode = ast.AttributeCode
export function AttributeCode(...params: ConstructorParameters<typeof ast.AttributeCode>): ast.AttributeCode {
	return new ast.AttributeCode(...params)
}
export type Directive = ast.Directive
export function Directive(...params: ConstructorParameters<typeof ast.Directive>): ast.Directive {
	return new ast.Directive(...params)
}
export type TextSection = ast.TextSection
export function TextSection(...params: NonEmpty<TextItem>): ast.TextSection {
	return new ast.TextSection(params)
}
export type TextItem = ast.TextItem
export function TextItem(...params: ConstructorParameters<typeof ast.TextItem>): ast.TextItem {
	return new ast.TextItem(...params)
}
