import { NonEmpty } from '../utils'
import * as ast from './ast'

export type Entity = ast.Entity
export type Html = ast.Html
export type BindingValue = ast.BindingValue
export type ExistentBindingValue = ast.ExistentBindingValue
export type InertBindingValue = ast.InertBindingValue
export type Attribute = ast.Attribute
export type Directive = ast.Directive
export { LivenessType, SyncModifier, CTXFN } from './ast'

export type ComponentDefinition = ast.ComponentDefinition
export function ComponentDefinition(...params: ConstructorParameters<typeof ast.ComponentDefinition>) {
	return new ast.ComponentDefinition(...params)
}
export type Tag = ast.Tag
export function Tag(...params: ConstructorParameters<typeof ast.Tag>) {
	return new ast.Tag(...params)
}
export type TagAttributes = ast.TagAttributes
export function TagAttributes(...params: ConstructorParameters<typeof ast.TagAttributes>) {
	return new ast.TagAttributes(...params)
}
export type IdMeta = ast.IdMeta
export function IdMeta(...params: ConstructorParameters<typeof ast.IdMeta>) {
	return new ast.IdMeta(...params)
}
export type ClassMeta = ast.ClassMeta
export function ClassMeta(...params: ConstructorParameters<typeof ast.ClassMeta>) {
	return new ast.ClassMeta(...params)
}
export type AttributeCode = ast.AttributeCode
export function AttributeCode(...params: ConstructorParameters<typeof ast.AttributeCode>) {
	return new ast.AttributeCode(...params)
}
export type BindingAttribute = ast.BindingAttribute
export function BindingAttribute(...params: ConstructorParameters<typeof ast.BindingAttribute>) {
	return new ast.BindingAttribute(...params)
}
export type EventAttribute = ast.EventAttribute
export function EventAttribute(...params: ConstructorParameters<typeof ast.EventAttribute>) {
	return new ast.EventAttribute(...params)
}
export type ReceiverAttribute = ast.ReceiverAttribute
export function ReceiverAttribute(...params: ConstructorParameters<typeof ast.ReceiverAttribute>) {
	return new ast.ReceiverAttribute(...params)
}
export type SyncedTextInput = ast.SyncedTextInput
export function SyncedTextInput(...params: ConstructorParameters<typeof ast.SyncedTextInput>) {
	return new ast.SyncedTextInput(...params)
}
export type SyncedCheckboxInput = ast.SyncedCheckboxInput
export function SyncedCheckboxInput(...params: ConstructorParameters<typeof ast.SyncedCheckboxInput>) {
	return new ast.SyncedCheckboxInput(...params)
}
export type SyncedRadioInput = ast.SyncedRadioInput
export function SyncedRadioInput(...params: ConstructorParameters<typeof ast.SyncedRadioInput>) {
	return new ast.SyncedRadioInput(...params)
}
export type SyncedSelect = ast.SyncedSelect
export function SyncedSelect(...params: ConstructorParameters<typeof ast.SyncedSelect>) {
	return new ast.SyncedSelect(...params)
}
export type TextSection = ast.TextSection
export function TextSection(...items: NonEmpty<TextItem>) {
	return new ast.TextSection(items)
}
export type TextItem = ast.TextItem
export function TextItem(...params: ConstructorParameters<typeof ast.TextItem>) {
	return new ast.TextItem(...params)
}
export type ComponentInclusion = ast.ComponentInclusion
export function ComponentInclusion(...params: ConstructorParameters<typeof ast.ComponentInclusion>) {
	return new ast.ComponentInclusion(...params)
}
export type SyncAttribute = ast.SyncAttribute
export function SyncAttribute(...params: ConstructorParameters<typeof ast.SyncAttribute>) {
	return new ast.SyncAttribute(...params)
}
export type LiveCode = ast.LiveCode
export function LiveCode(...params: ConstructorParameters<typeof ast.LiveCode>) {
	return new ast.LiveCode(...params)
}
export type AssignedLiveCode = ast.AssignedLiveCode
export function AssignedLiveCode(...params: ConstructorParameters<typeof ast.AssignedLiveCode>) {
	return new ast.AssignedLiveCode(...params)
}
export type IfBlock = ast.IfBlock
export function IfBlock(...params: ConstructorParameters<typeof ast.IfBlock>) {
	return new ast.IfBlock(...params)
}
export type EachBlock = ast.EachBlock
export function EachBlock(...params: ConstructorParameters<typeof ast.EachBlock>) {
	return new ast.EachBlock(...params)
}
export type MatchBlock = ast.MatchBlock
export function MatchBlock(...params: ConstructorParameters<typeof ast.MatchBlock>) {
	return new ast.MatchBlock(...params)
}
export type SwitchBlock = ast.SwitchBlock
export function SwitchBlock(...params: ConstructorParameters<typeof ast.SwitchBlock>) {
	return new ast.SwitchBlock(...params)
}
export type SwitchCase = ast.SwitchCase
export function SwitchCase(...params: ConstructorParameters<typeof ast.SwitchCase>) {
	return new ast.SwitchCase(...params)
}
export type SwitchDefault = ast.SwitchDefault
export function SwitchDefault(...params: ConstructorParameters<typeof ast.SwitchDefault>) {
	return new ast.SwitchDefault(...params)
}
export type SlotUsage = ast.SlotUsage
export function SlotUsage(...params: ConstructorParameters<typeof ast.SlotUsage>) {
	return new ast.SlotUsage(...params)
}
export type SlotInsertion = ast.SlotInsertion
export function SlotInsertion(...params: ConstructorParameters<typeof ast.SlotInsertion>) {
	return new ast.SlotInsertion(...params)
}
export type TemplateDefinition = ast.TemplateDefinition
export function TemplateDefinition(...params: ConstructorParameters<typeof ast.TemplateDefinition>) {
	return new ast.TemplateDefinition(...params)
}
export type TemplateInclusion = ast.TemplateInclusion
export function TemplateInclusion(...params: ConstructorParameters<typeof ast.TemplateInclusion>) {
	return new ast.TemplateInclusion(...params)
}

