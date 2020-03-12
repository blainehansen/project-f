import 'mocha'
import { expect } from 'chai'

import { batch, effect, value } from './index'

describe('value', () => it('works', () => {
	const a = value('a')
	expect(a()).equal('a')
	a('')
	expect(a()).equal('')

	let bad: never = value([])
	bad = value({})
	bad = value(new Set())
}))

describe('simple effect', () => it('works', () => {
	const a = value('a')
	let runCount = 0
	let currentMessage = ''
	effect(() => {
		runCount++
		currentMessage = a()
	})

	expect(currentMessage).equal('a')
	expect(runCount).equal(1)

	a('b')
	expect(currentMessage).equal('b')
	expect(runCount).equal(2)

	// checking for non repetition
	a('b')
	expect(currentMessage).equal('b')
	expect(runCount).equal(2)

	a('c')
	expect(currentMessage).equal('c')
	expect(runCount).equal(3)
}))

describe('complex effect', () => it('works', () => {
	const shouldRepeat = value(true)
	const str = value('initial')
	const count = value(1)
	const message = value('message')

	let runCount = 0
	let currentMessage = ''

	effect(() => {
		runCount++
		if (shouldRepeat())
			currentMessage = str().repeat(count())
		else
			currentMessage = message()
	})

	expect(runCount).equal(1)
	expect(currentMessage).equal('initial')

	shouldRepeat(false)
	expect(runCount).equal(2)
	expect(currentMessage).equal('message')

	// deregistered signals
	count(2)
	expect(runCount).equal(2)
	expect(currentMessage).equal('message')

	shouldRepeat(true)
	expect(runCount).equal(3)
	expect(currentMessage).equal('initialinitial')

	count(1)
	expect(runCount).equal(4)
	expect(currentMessage).equal('initial')
}))

describe('batch', () => it('works', () => {
	const str = value('initial')
	const count = value(1)

	let runCount = 0
	let currentMessage = ''

	effect(() => {
		runCount++
		currentMessage = str().repeat(count())
	})

	expect(runCount).equal(1)
	expect(currentMessage).equal('initial')

	batch(() => {
		count(4)
		expect(count()).equal(1)
		expect(runCount).equal(1)
		expect(currentMessage).equal('initial')

		str('blah')
		expect(str()).equal('initial')
		expect(runCount).equal(1)
		expect(currentMessage).equal('initial')
	})

	expect(runCount).equal(2)
	expect(currentMessage).equal('blahblahblahblah')
}))
