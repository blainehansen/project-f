import { NonEmpty } from '../utils'
import * as ast from './ast'

export type Entity = ast.Entity
export type Directive = ast.Directive

export type ComponentDefinition = ast.ComponentDefinition
export function ComponentDefinition(...params: ConstructorParameters<typeof ast.ComponentDefinition>): ast.ComponentDefinition {
	return new ast.ComponentDefinition(...params)
}
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
export type TextSection = ast.TextSection
export function TextSection(...params: ConstructorParameters<typeof ast.TextSection>[0]): ast.TextSection {
	return new ast.TextSection(params)
}
export type TextItem = ast.TextItem
export function TextItem(...params: ConstructorParameters<typeof ast.TextItem>): ast.TextItem {
	return new ast.TextItem(...params)
}
export type ComponentInclusion = ast.ComponentInclusion
export function ComponentInclusion(...params: ConstructorParameters<typeof ast.ComponentInclusion>): ast.ComponentInclusion {
	return new ast.ComponentInclusion(...params)
}
export type IfBlock = ast.IfBlock
export function IfBlock(...params: ConstructorParameters<typeof ast.IfBlock>): ast.IfBlock {
	return new ast.IfBlock(...params)
}
export type EachBlock = ast.EachBlock
export function EachBlock(...params: ConstructorParameters<typeof ast.EachBlock>): ast.EachBlock {
	return new ast.EachBlock(...params)
}
export type MatchBlock = ast.MatchBlock
export function MatchBlock(...params: ConstructorParameters<typeof ast.MatchBlock>): ast.MatchBlock {
	return new ast.MatchBlock(...params)
}
export type MatchPattern = ast.MatchPattern
export function MatchPattern(...params: ConstructorParameters<typeof ast.MatchPattern>): ast.MatchPattern {
	return new ast.MatchPattern(...params)
}
export type SwitchBlock = ast.SwitchBlock
export function SwitchBlock(...params: ConstructorParameters<typeof ast.SwitchBlock>): ast.SwitchBlock {
	return new ast.SwitchBlock(...params)
}
export type SwitchCase = ast.SwitchCase
export function SwitchCase(...params: ConstructorParameters<typeof ast.SwitchCase>): ast.SwitchCase {
	return new ast.SwitchCase(...params)
}
export type SwitchDefault = ast.SwitchDefault
export function SwitchDefault(...params: ConstructorParameters<typeof ast.SwitchDefault>): ast.SwitchDefault {
	return new ast.SwitchDefault(...params)
}
export type SlotDefinition = ast.SlotDefinition
export function SlotDefinition(...params: ConstructorParameters<typeof ast.SlotDefinition>): ast.SlotDefinition {
	return new ast.SlotDefinition(...params)
}
export type SlotInsertion = ast.SlotInsertion
export function SlotInsertion(...params: ConstructorParameters<typeof ast.SlotInsertion>): ast.SlotInsertion {
	return new ast.SlotInsertion(...params)
}
export type TemplateDefinition = ast.TemplateDefinition
export function TemplateDefinition(...params: ConstructorParameters<typeof ast.TemplateDefinition>): ast.TemplateDefinition {
	return new ast.TemplateDefinition(...params)
}
export type TemplateInclusion = ast.TemplateInclusion
export function TemplateInclusion(...params: ConstructorParameters<typeof ast.TemplateInclusion>): ast.TemplateInclusion {
	return new ast.TemplateInclusion(...params)
}
