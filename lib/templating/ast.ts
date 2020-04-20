import { NonEmpty } from '../utils'

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

// export class Directive {
// 	readonly type = 'Directive' as const
// 	constructor(
// 		readonly isPlus: boolean,
// 		readonly ident: string,
// 		readonly code: string | undefined,
// 		readonly entities: Entity[],
// 	) {}
// }
export type Directive =
	| IfBlock
	| EachBlock
	| ComponentInclusion
	| SlotDefinition
	| SlotProvidence
	// | MacroTemplate

export class IfBlock {
	constructor(
		readonly expression: string,
		readonly elseBranch: IfBlock | NonEmpty<Entity> | undefined,
	) {}
}

export class EachBlock {
	constructor(
		readonly receiverExpression: string,
		readonly listExpression: string,
		readonly emptyBranch: NonEmpty<Entity> | undefined,
	) {}
}

export class ComponentInclusion {
	constructor(
		readonly name: string,
		readonly params: string | undefined,
		readonly entities: Entity[],
	) {}
}

export class SlotDefinition {
	constructor(
		readonly name: string | undefined,
		readonly paramsExpression: string | undefined,
		readonly fallback: NonEmpty<Entity> | undefined,
	) {}
}

export class SlotProvidence {
	constructor(
		readonly name: string | undefined,
		readonly receiverExpression: string | undefined,
		readonly entities: NonEmpty<Entity>,
	) {}
}

// inside a Component, to define the slots:
// div
// 	@slot ()

export class MacroTemplate {
	constructor(
		readonly argsExpression: string,
		readonly entities: NonEmpty<Entity>,
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
