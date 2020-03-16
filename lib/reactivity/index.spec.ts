import 'mocha'
import { expect } from 'chai'
import { assert_type as assert, tuple as t } from '@ts-std/types'

import { data, ref, value, channel, batch, effect, computed, thunk, sample, Immutable } from './index'


describe('value', () => it('works', () => {
	const a = value('a')
	expect(a()).equal('a')
	a('')
	expect(a()).equal('')

	let bad: never = value([])
	bad = value({})
	bad = value(new Set())
}))

describe('data', () => it('works', () => {
	const a = data([0, 0, 0], (left, right) => left.length === right.length)
	expect(a()).eql([0, 0, 0])

	// we don't just not alert dependencies
	// we drop the value on the ground
	a([1, 2, 3])
	expect(a()).eql([0, 0, 0])

	let runCount = 0
	let currentMessage = ''
	effect(() => {
		runCount++
		currentMessage = a().join(', ')
	})

	expect(runCount).equal(1)
	expect(currentMessage).equal('0, 0, 0')

	a([1])
	expect(runCount).equal(2)
	expect(currentMessage).equal('1')

	a([0])
	expect(runCount).equal(2)
	expect(currentMessage).equal('1')
}))


describe('channel', () => it('works', () => {
	const a = channel([0, 0, 0])
	expect(a()).eql([0, 0, 0])

	a([1, 2, 3])
	expect(a()).eql([1, 2, 3])

	let runCount = 0
	let currentMessage = ''
	effect(() => {
		runCount++
		currentMessage = a().join(', ')
	})

	expect(runCount).equal(1)
	expect(currentMessage).equal('1, 2, 3')

	a([1])
	expect(runCount).equal(2)
	expect(currentMessage).equal('1')

	a([0])
	expect(runCount).equal(3)
	expect(currentMessage).equal('0')
}))


describe('readonly ref', () => it('works', () => {
	const a = value('a')
	const r = ref(a)
	assert.values_callable(r, t(), true)
	assert.values_callable(r, t('b'), false)

	expect(r()).equal('a')

	let runCount = 0
	let currentMessage = ''
	effect(() => {
		runCount++
		currentMessage = r()
	})

	expect(runCount).equal(1)
	expect(currentMessage).equal('a')

	a('b')
	expect(runCount).equal(2)
	expect(currentMessage).equal('b')

	a('b')
	expect(runCount).equal(2)
	expect(currentMessage).equal('b')
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


describe('effect disallows mutation', () => it('works', () => {
	const a = value('a')
	expect(() => effect(() => a('b'))).throw('readonly')
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


describe('computed', () => it('works', () => {
	const str = value('a')
	let runCount = 0
	const upper = computed(() => {
		runCount++
		return str().toUpperCase()
	})
	assert.values_callable(upper, t(), true)
	assert.values_callable(upper, t('b'), false)

	expect(upper() as string).equal('A')
	expect(runCount).equal(1)

	str('b')
	expect(upper()).equal('B')
	expect(runCount).equal(2)

	str('b')
	expect(upper()).equal('B')
	expect(runCount).equal(2)
}))


describe('computed diamond', () => it('works', () => {
	const str = value('a')
	const evenLetters = computed(() => str().length % 2 === 0)
	const upperStr = computed(() => str().toUpperCase())

	expect(str()).equal('a')
	expect(evenLetters()).equal(false)
	expect(upperStr()).equal('A')

	let runCount = 0
	let currentMessage = ''

	effect(() => {
		runCount++
		currentMessage = evenLetters() ? `${upperStr()} even` : upperStr()
	})

	expect(runCount).equal(1)
	expect(currentMessage).equal('A')

	str('aa')
	expect(runCount).equal(2)
	expect(currentMessage).equal('AA even')
}))


describe('complex computed diamond', () => it('works', () => {
	const append = value('append')
	const str = value('a')

	let evenLettersRunCount = 0
	const evenLetters = computed(() => {
		evenLettersRunCount++
		return str().length % 2 === 0
	})
	let transformedStrRunCount = 0
	const transformedStr = computed(() => {
		transformedStrRunCount++
		const app = ` ${append()}`
		return evenLetters()
			? str().toUpperCase() + app
			: str() + app
	})

	expect(append()).equal('append')
	expect(str()).equal('a')
	expect(evenLetters()).equal(false)
	expect(transformedStr()).equal('a append')
	expect(evenLettersRunCount).equal(1)
	expect(transformedStrRunCount).equal(1)

	let runCount = 0
	let currentMessage = ''
	effect(() => {
		runCount++
		currentMessage = evenLetters() ? `${transformedStr()} even` : transformedStr()
	})

	expect(runCount).equal(1)
	expect(currentMessage).equal('a append')
	expect(evenLettersRunCount).equal(1)
	expect(transformedStrRunCount).equal(1)

	str('aa')
	expect(runCount).equal(2)
	expect(currentMessage).equal('AA append even')
	expect(evenLettersRunCount).equal(2)
	expect(transformedStrRunCount).equal(2)
}))


describe('computed circular reference', () => it('works', () => {
	const str = value('a')
	const upperStr: Immutable<string> = computed(() => {
		return str() === str().toUpperCase()
			? alreadyUpper() ? str() : str()
			: str().toUpperCase()
	})
	const alreadyUpper: Immutable<boolean> = computed(() => {
		return upperStr() === str()
	})

	expect(() => str('A')).throw('circular reference')
}))


describe('thunk', () => it('works', () => {
	const str = value('a')
	let runCount = 0
	const upperStr = thunk(() => {
		runCount++
		return str().toUpperCase()
	})

	expect(runCount).equal(0)
	expect(upperStr()).equal('A')
	expect(runCount).equal(1)
}))


describe('destructors', () => it('works', () => {
	let destructorRunCount = 0
	let totalRunCount = 0
	let runCount = 0
	const s = value(true)

	const stop = effect(destroy => {
		s()
		runCount++
		totalRunCount++
		destroy(() => {
			destructorRunCount++
			runCount = 0
		})
	})

	expect(runCount).equal(1)
	expect(totalRunCount).equal(1)
	expect(destructorRunCount).equal(0)

	s(false)
	expect(runCount).equal(1)
	expect(totalRunCount).equal(2)
	expect(destructorRunCount).equal(1)

	s(true)
	expect(runCount).equal(1)
	expect(totalRunCount).equal(3)
	expect(destructorRunCount).equal(2)

	stop()
	expect(runCount).equal(0)
	expect(totalRunCount).equal(3)
	expect(destructorRunCount).equal(3)

	// all watching should have stopped
	s(false)
	expect(runCount).equal(0)
	expect(totalRunCount).equal(3)
	expect(destructorRunCount).equal(3)

	s(true)
	expect(runCount).equal(0)
	expect(totalRunCount).equal(3)
	expect(destructorRunCount).equal(3)
}))


describe('sample', () => it('works', () => {
	const a = value('a')
	const b = value('b')

	let runCount = 0
	let currentMessage = ''

	effect(() => {
		runCount++
		currentMessage = `${sample(a)} ${b()}`
	})

	expect(runCount).equal(1)
	expect(currentMessage).equal('a b')

	a('aa')
	expect(runCount).equal(1)
	expect(currentMessage).equal('a b')

	b('bb')
	expect(runCount).equal(2)
	expect(currentMessage).equal('aa bb')

	a('a')
	expect(runCount).equal(2)
	expect(currentMessage).equal('aa bb')

	b('b')
	expect(runCount).equal(3)
	expect(currentMessage).equal('a b')
}))


describe('nested computations', () => it('works', () => {
	const active = value(true)
	const a = value('a')
	const b = value('b')
	let aRunCount = 0
	let aMessage = ''
	let bRunCount = 0
	let bMessage = ''

	effect(() => {
		if (!active()) return
		effect(destroy => {
			aRunCount++
			aMessage = a()
			destroy(() => { aMessage = '' })
		})
		effect(destroy => {
			bRunCount++
			bMessage = b()
			destroy(() => { bMessage = '' })
		})
	})

	expect(aRunCount).equal(1)
	expect(aMessage).equal('a')
	expect(bRunCount).equal(1)
	expect(bMessage).equal('b')

	batch(() => { a('aa'); b('bb') })
	expect(aRunCount).equal(2)
	expect(aMessage).equal('aa')
	expect(bRunCount).equal(2)
	expect(bMessage).equal('bb')

	active(false)
	expect(aRunCount).equal(2)
	expect(aMessage).equal('')
	expect(bRunCount).equal(2)
	expect(bMessage).equal('')

	batch(() => { a('a'); b('b') })
	expect(aRunCount).equal(2)
	expect(aMessage).equal('')
	expect(bRunCount).equal(2)
	expect(bMessage).equal('')

	active(true)
	expect(aRunCount).equal(3)
	expect(aMessage).equal('a')
	expect(bRunCount).equal(3)
	expect(bMessage).equal('b')
}))

describe('deep nested computations', () => it('works', () => {
	const active = value(true)
	const a = value('a')
	const b = value('b')
	let aRunCount = 0
	let aDestructorRunCount = 0
	let aMessage = ''
	let bRunCount = 0
	let bDestructorRunCount = 0
	let bMessage = ''

	effect(() => {
		if (!active()) return
		effect(destroy => {
			aRunCount++
			aMessage = a()
			destroy(() => { aDestructorRunCount++; aMessage = '' })

			effect(destroy => {
				bRunCount++
				bMessage = b()
				destroy(() => { bDestructorRunCount++; bMessage = '' })
			})
		})
	})

	expect(aRunCount).equal(1)
	expect(aDestructorRunCount).equal(0)
	expect(aMessage).equal('a')
	expect(bRunCount).equal(1)
	expect(bDestructorRunCount).equal(0)
	expect(bMessage).equal('b')

	a('aa')
	expect(aRunCount).equal(2)
	expect(aDestructorRunCount).equal(1)
	expect(aMessage).equal('aa')
	expect(bRunCount).equal(2)
	expect(bDestructorRunCount).equal(1)
	expect(bMessage).equal('b')

	b('bb')
	expect(aRunCount).equal(2)
	expect(aDestructorRunCount).equal(1)
	expect(aMessage).equal('aa')
	expect(bRunCount).equal(3)
	expect(bDestructorRunCount).equal(2)
	expect(bMessage).equal('bb')

	batch(() => { a('a'); b('b') })
	expect(aRunCount).equal(3)
	expect(aDestructorRunCount).equal(2)
	expect(aMessage).equal('a')
	expect(bRunCount).equal(4)
	expect(bDestructorRunCount).equal(3)
	expect(bMessage).equal('b')

	active(false)
	expect(aRunCount).equal(3)
	expect(aDestructorRunCount).equal(3)
	expect(aMessage).equal('')
	expect(bRunCount).equal(4)
	expect(bDestructorRunCount).equal(4)
	expect(bMessage).equal('')

	batch(() => { a('aa'); b('bb') })
	expect(aRunCount).equal(3)
	expect(aDestructorRunCount).equal(3)
	expect(aMessage).equal('')
	expect(bRunCount).equal(4)
	expect(bDestructorRunCount).equal(4)
	expect(bMessage).equal('')

	active(true)
	expect(aRunCount).equal(4)
	expect(aDestructorRunCount).equal(3)
	expect(aMessage).equal('aa')
	expect(bRunCount).equal(5)
	expect(bDestructorRunCount).equal(4)
	expect(bMessage).equal('bb')
}))


describe('nested computed', () => it('works', () => {
	const active = value(true)
	const a = value('a')
	const b = value('b')

	let aRunCount = 0
	let bRunCount = 0

	effect(() => {
		if (!active()) return
		computed(() => {
			aRunCount++
			return a()
		})
		computed(() => {
			bRunCount++
			return b()
		})
	})

	expect(aRunCount).equal(1)
	expect(bRunCount).equal(1)

	a('aa')
	expect(aRunCount).equal(2)
	expect(bRunCount).equal(1)
	b('bb')
	expect(aRunCount).equal(2)
	expect(bRunCount).equal(2)

	active(false)
	expect(aRunCount).equal(2)
	expect(bRunCount).equal(2)

	batch(() => { a('a'); b('b') })
	expect(aRunCount).equal(2)
	expect(bRunCount).equal(2)

	active(true)
	expect(aRunCount).equal(3)
	expect(bRunCount).equal(3)
}))
