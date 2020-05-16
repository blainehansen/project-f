import 'mocha'
import { expect } from 'chai'

import { NonEmpty } from '../utils'
import { boilEqual } from '../utils.spec'
import { realParent, parent } from './codegen.spec'

import { ComponentDefinition } from './ast'
import { reset, exit, wolf } from './wolf.grammar'
import { generateComponentDefinition } from './codegen'


// function bad(fn: () => any, input: string) {
// 	reset(input)
// 	expect(fn).throw()
// }
// function incomplete(fn: () => any, input: string) {
// 	reset(input)
// 	fn()
// 	expect(exit).throw()
// }

const cases: [string, string, string[], string][] = [
	['first from readme', `span Message: {{ msg() }}`, ['createElement'], `
		const ___span0 = ___createElement(___parent, "span")
		___span0.textContent = \`Message: \${msg()}\``
	],
]


describe('grammar and codegen integration', () => {
	for (const [description, source, runtimeImports, expected] of cases)
		it(description, () => {
			reset(source)
			const entities = wolf()
			exit()
			const definition = new ComponentDefinition([], [], [], {}, [], NonEmpty.expect(entities, "empty entities"))
			const generatedCode = generateComponentDefinition(definition)
			boilEqual(generatedCode, `
				import { ${runtimeImports.concat(['ComponentDefinition']).map(s => `${s} as ___${s}`).join(', ')} } from "project-f/runtime"
				const ___Component: ___ComponentDefinition<Component> = (
					___real, ___parent, {}, {}, {}, {}
				) => { ${expected} }
				export default ___Component
			`)
		})
})
