import { Dict, NonEmpty } from '../utils'

export class ComponentDefinition {
	constructor(
		readonly props: string[],
		readonly syncs: string[],
		readonly events: string[],
		readonly slots: Dict<boolean>,
		readonly createFn: string[] | undefined,
		readonly entities: NonEmpty<Entity>,
	) {}
}

export type Entity =
	| Tag
	| TextSection
	| Directive

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
	constructor(
		readonly isClass: boolean,
		readonly isDynamic: boolean,
		readonly value: string,
	) {}
}

export class Attribute {
	constructor(
		readonly name: string,
		readonly value: string | AttributeCode | undefined,
	) {}
}
export class AttributeCode {
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
	| MatchBlock
	| SwitchBlock
	| SlotUsage
	| SlotInsertion
	| TemplateDefinition
	| TemplateInclusion
	// | VariableBinding

export class ComponentInclusion {
	readonly type = 'ComponentInclusion' as const
	constructor(
		readonly name: string,
		readonly params: Attribute[],
		readonly entities: Entity[],
	) {}
}

export class IfBlock {
	readonly type = 'IfBlock' as const
	constructor(
		readonly expression: string,
		readonly entities: NonEmpty<Entity>,
		readonly elseIfBranches: [string, NonEmpty<Entity>][],
		readonly elseBranch: NonEmpty<Entity> | undefined,
	) {}
}

// this would allow a more literal for block, giving them more control
// export class ForBlock {
// 	readonly type = 'ForBlock' as const
// 	constructor(
// 		readonly paramsExpression: string,
// 		readonly listExpression: string,
// 		readonly entities: NonEmpty<Entity>,
// 		// readonly keyExpression: string | undefined,
// 		// readonly emptyBranch: NonEmpty<Entity> | undefined,
// 	) {}
// }

export class EachBlock {
	readonly type = 'EachBlock' as const
	constructor(
		readonly paramsExpression: string,
		readonly listExpression: string,
		readonly entities: NonEmpty<Entity>,
		// readonly keyExpression: string | undefined,
		// readonly emptyBranch: NonEmpty<Entity> | undefined,
	) {}
}

export class MatchBlock {
	readonly type = 'MatchBlock' as const
	constructor(
		readonly matchExpression: string,
		// readonly patterns: [string, Entity[]][],
		readonly patterns: NonEmpty<[string, Entity[]]>,
		readonly defaultPattern: Entity[] | undefined,
	) {}
}

export class SwitchBlock {
	readonly type = 'SwitchBlock' as const
	constructor(
		readonly switchExpression: string,
		readonly cases: NonEmpty<SwitchCase | SwitchDefault>,
	) {}
}
export class SwitchCase {
	readonly isDefault = false
	constructor(
		readonly isFallthrough: boolean,
		readonly expression: string,
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
		readonly entities: NonEmpty<Entity>,
	) {}
}


export class TemplateDefinition {
	readonly type = 'TemplateDefinition' as const
	constructor(
		readonly name: string,
		readonly paramsExpression: string | undefined,
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
