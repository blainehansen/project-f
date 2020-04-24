import { NonEmpty } from '../utils'

export class ComponentDefinition {
	constructor(
		// just using name/optional pairs is the simplest thing we need to render all of the code
		readonly props: { name: string, optional: boolean }[],
		readonly syncs: { name: string, optional: boolean }[],
		readonly events: { name: string, optional: boolean }[],
		readonly slots: { name: string, optional: boolean }[],
	) {}
}

export type Entity =
	| Tag
	| Directive
	| TextSection

export class Tag {
	readonly type = 'Tag' as const
	constructor(
		readonly ident: string,
		readonly metas: Meta[],
		readonly attributes: Attribute[],
		readonly entities: Entity[],
	) {}
}
// enum MetaType { class, id }
export class Meta {
	readonly type = 'Meta' as const
	constructor(
		readonly isClass: boolean,
		readonly isDynamic: boolean,
		readonly value: string,
	) {}
}

export class Attribute {
	readonly type = 'Attribute' as const
	constructor(
		readonly name: string,
		readonly value: AttributeValue | undefined,
	) {}
}
export type AttributeValue = string | AttributeCode
export class AttributeCode {
	readonly type = 'AttributeCode' as const
	constructor(
		readonly isBare: boolean,
		readonly code: string,
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
		readonly isCode: boolean,
		readonly content: string,
	) {}
}


export type Directive =
	| ComponentInclusion
	| IfBlock
	| EachBlock
	// matches and switches are different
	// - switches allow fallthrough of *empty* cases,
	// 	but all nonempty ones implicitly have a return (we aren't appending to a list of Displayables)
	// - matches don't allow fallthrough. empty cases will render nothing
	| MatchBlock
	| SwitchBlock
	| SlotDefinition
	| SlotInsertion
	| TemplateDefinition
	| TemplateInclusion

export class ComponentInclusion {
	readonly type = 'ComponentInclusion' as const
	constructor(
		readonly name: string,
		readonly params: string | undefined,
		readonly entities: Entity[],
	) {}
}

export class IfBlock {
	readonly type = 'IfBlock' as const
	constructor(
		readonly expression: string,
		readonly elseBranch: IfBlock | NonEmpty<Entity> | undefined,
	) {}
}

export class EachBlock {
	readonly type = 'EachBlock' as const
	constructor(
		readonly receiverExpression: string,
		readonly listExpression: string,
		// readonly keyExpression: string | undefined,
		// readonly emptyBranch: NonEmpty<Entity> | undefined,
	) {}
}

export class MatchBlock {
	readonly type = 'MatchBlock' as const
	constructor(
		readonly matchExpression: string,
		readonly patterns: MatchPattern[],
		readonly defaultPattern: Entity[] | undefined,
	) {}
}

export class MatchPattern {
	constructor(
		readonly expression: string,
		readonly entities: Entity[],
	) {}
}

export class SwitchBlock {
	readonly type = 'SwitchBlock' as const
	constructor(
		readonly switchExpression: string,
		readonly cases: SwitchCase[],
		readonly defaultCase: NonEmpty<Entity> | undefined,
	) {}
}

export class SwitchCase {
	constructor(
		readonly expression: string,
		// allows for empty rendering or fallthrough
		readonly entities: Entity[],
	) {}
}

export class SlotDefinition {
	readonly type = 'SlotDefinition' as const
	constructor(
		readonly name: string | undefined,
		readonly paramsExpression: string | undefined,
		readonly fallback: NonEmpty<Entity> | undefined,
	) {}
}

export class SlotInsertion {
	readonly type = 'SlotInsertion' as const
	constructor(
		readonly name: string | undefined,
		readonly receiverExpression: string | undefined,
		readonly entities: NonEmpty<Entity>,
	) {}
}


export class TemplateDefinition {
	readonly type = 'TemplateDefinition' as const
	constructor(
		readonly name: string,
		readonly argsExpression: string | undefined,
		readonly entities: NonEmpty<Entity>,
	) {}
}

export class TemplateInclusion {
	readonly type = 'TemplateInclusion' as const
	constructor(
		readonly name: string,
		readonly argsExpression: string | undefined,
	) {}
}
