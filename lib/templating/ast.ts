import { Dict, NonEmpty, OmitVariants, PickVariants } from '../utils'

export const CTXFN: unique symbol = Symbol()
export type CTXFN = typeof CTXFN
export class ComponentDefinition {
	constructor(
		readonly props: string[],
		readonly syncs: string[],
		readonly events: string[],
		readonly slots: Dict<boolean>,
		readonly createFn: NonEmpty<string> | CTXFN | undefined,
		readonly entities: (Entity | SlotUsage)[],
	) {}
}

export type Entity =
	| Html
	| TextSection
	| Directive


export type Html =
	| Tag
	| SyncedTextInput
	| SyncedCheckboxInput
	| SyncedRadioInput
	| SyncedSelect

export class Tag {
	readonly type = 'Tag' as const
	constructor(
		readonly ident: string,
		readonly attributes: TagAttributes,
		readonly entities: Entity[],
	) {}
}

export class TagAttributes {
	constructor(
		readonly idMeta: IdMeta | undefined,
		readonly classMetas: ClassMeta[],
		readonly bindings: Dict<BindingAttribute>,
		readonly events: Dict<NonEmpty<EventAttribute>>,
		readonly receivers: ReceiverAttribute[],
		// readonly refs: RefAttribute | undefined,
	) {}
}

export enum LivenessType { static, dynamic, reactive }
export namespace LivenessType {
	export function max(a: LivenessType, b: LivenessType) {
		switch (a) {
		case LivenessType.static:
			return b
		case LivenessType.dynamic:
			return b === LivenessType.reactive ? b : a
		case LivenessType.reactive:
			return a
		}
	}

	// export function strongest(values: Iterable<>) {
	// 	let strongest =
	// }
}
export class IdMeta {
	readonly type = 'IdMeta' as const
	constructor(
		readonly liveness: LivenessType,
		readonly value: string,
	) {}
}
export class ClassMeta {
	readonly type = 'ClassMeta' as const
	constructor(
		readonly liveness: LivenessType,
		readonly value: string,
	) {}
}

export class AttributeCode {
	constructor(
		readonly isBare: boolean,
		readonly code: string,
	) {}
}
export class BindingAttribute {
	readonly type = 'BindingAttribute' as const
	constructor(
		readonly attribute: string,
		readonly value: BindingValue,
	) {}
}
export type BindingValue =
	| { type: 'empty' }
	| { type: 'static', value: string }
	| { type: 'dynamic', code: AttributeCode, initialModifier: boolean }
	| { type: 'reactive', reactiveCode: AttributeCode }
export type ExistentBindingValue = OmitVariants<BindingValue, 'type', 'empty'>
export type InertBindingValue = OmitVariants<BindingValue, 'type', 'empty' | 'reactive'>

export class EventAttribute {
	readonly type = 'EventAttribute' as const
	constructor(
		readonly event: string,
		readonly variety: 'bare' | 'inline' | 'handler',
		readonly code: string,
	) {}
}

export class ReceiverAttribute {
	readonly type = 'ReceiverAttribute' as const
	constructor(
		readonly code: AttributeCode,
	) {}
}
// export class RefAttribute {
// 	readonly type = 'RefAttribute' as const
// 	constructor(
// 		readonly ident: string,
// 		readonly variety: 'ref' | 'deref',
// 	) {}
// }

export type Attribute =
	| BindingAttribute
	| SyncAttribute
	| EventAttribute
	| ReceiverAttribute
	// | RefAttribute

export class SyncedTextInput {
	readonly type = 'SyncedTextInput' as const
	constructor(
		readonly isTextarea: boolean,
		readonly mutable: AttributeCode,
		readonly attributes: TagAttributes,
	) {}
}
export class SyncedCheckboxInput {
	readonly type = 'SyncedCheckboxInput' as const
	constructor(
		readonly mutable: AttributeCode,
		readonly value: InertBindingValue | undefined,
		readonly attributes: TagAttributes,
	) {}
}
export class SyncedRadioInput {
	readonly type = 'SyncedRadioInput' as const
	constructor(
		readonly mutable: AttributeCode,
		readonly value: InertBindingValue,
		readonly attributes: TagAttributes,
	) {}
}
export class SyncedSelect {
	readonly type = 'SyncedSelect' as const
	constructor(
		readonly mutable: AttributeCode,
		readonly isMultiple: boolean,
		readonly attributes: TagAttributes,
		readonly entities: Entity[],
	) {}
}


export class TextSection {
	readonly type = 'TextSection' as const
	constructor(
		readonly items: NonEmpty<TextItem>,
	) {}
}
export class TextItem {
	readonly type = 'TextItem' as const
	constructor(
		readonly liveness: LivenessType,
		readonly content: string,
	) {}
}

export type Directive =
	| ComponentInclusion
	| IfBlock
	| EachBlock
	| MatchBlock
	| SwitchBlock
	| TemplateDefinition
	| TemplateInclusion
	// | VariableBinding

export class ComponentInclusion {
	readonly type = 'ComponentInclusion' as const
	constructor(
		readonly name: string,
		readonly props: Dict<BindingAttribute>,
		readonly syncs: Dict<SyncAttribute>,
		// readonly nativeEvents: Dict<NonEmpty<EventAttribute>>,
		readonly events: Dict<NonEmpty<EventAttribute>>,
		readonly slotInsertions: Dict<SlotInsertion>,
	) {}
}
export const enum SyncModifier { fake, setter }
export class SyncAttribute {
	readonly type = 'SyncAttribute' as const
	constructor(
		readonly attribute: string,
		readonly modifier: SyncModifier | undefined,
		readonly code: AttributeCode,
	) {}
}

export class LiveCode {
	readonly type = 'LiveCode' as const
	constructor(
		readonly reactive: boolean,
		readonly code: string,
	) {}
}
export class AssignedLiveCode {
	readonly type = 'AssignedLiveCode' as const
	constructor(
		readonly assignedName: string,
		readonly reactiveCode: string,
	) {}
}

export class IfBlock {
	readonly type = 'IfBlock' as const
	constructor(
		readonly expression: LiveCode,
		readonly entities: Entity[],
		readonly elseIfBranches: [LiveCode, Entity[]][],
		readonly elseBranch: Entity[] | undefined,
	) {}
}

// this would allow a more literal for block, giving them more control
// export class ForBlock {
// 	readonly type = 'ForBlock' as const
// 	constructor(
// 		readonly paramsExpression: string,
// 		readonly listExpression: string,
// 		readonly entities: Entity[],
// 		// readonly keyExpression: string | undefined,
// 		// readonly emptyBranch: NonEmpty<Entity> | undefined,
// 	) {}
// }

export class EachBlock {
	readonly type = 'EachBlock' as const
	constructor(
		readonly params: { variableCode: string, indexCode: string | undefined },
		readonly listExpression: LiveCode,
		readonly entities: Entity[],
		// readonly keyExpression: string | undefined,
		// readonly emptyBranch: NonEmpty<Entity> | undefined,
	) {}
}

export class MatchBlock {
	readonly type = 'MatchBlock' as const
	constructor(
		readonly matchExpression: LiveCode | AssignedLiveCode,
		readonly patterns: [LiveCode, Entity[]][],
		readonly defaultPattern: Entity[] | undefined,
	) {}
}

export class SwitchBlock {
	readonly type = 'SwitchBlock' as const
	constructor(
		readonly switchExpression: LiveCode | AssignedLiveCode,
		readonly cases: (SwitchCase | SwitchDefault)[],
	) {}
}
export class SwitchCase {
	readonly isDefault = false
	constructor(
		readonly isFallthrough: boolean,
		readonly expression: LiveCode,
		readonly entities: Entity[],
	) {}
}
export class SwitchDefault {
	readonly isDefault = true
	constructor(
		readonly isFallthrough: boolean,
		readonly entities: Entity[],
	) {}
}

export class SlotUsage {
	readonly type = 'SlotUsage' as const
	constructor(
		readonly name: string | undefined,
		readonly argsExpression: string | undefined,
		readonly fallback: NonEmpty<Entity> | undefined,
	) {}
}

export class SlotInsertion {
	readonly type = 'SlotInsertion' as const
	constructor(
		readonly name: string | undefined,
		readonly paramsExpression: string | undefined,
		readonly entities: Entity[],
	) {}
}


export class TemplateDefinition {
	readonly type = 'TemplateDefinition' as const
	constructor(
		readonly name: string,
		readonly paramsExpression: string | undefined,
		readonly entities: Entity[],
	) {}
}

export class TemplateInclusion {
	readonly type = 'TemplateInclusion' as const
	constructor(
		readonly name: string,
		readonly argsExpression: string | undefined,
	) {}
}
