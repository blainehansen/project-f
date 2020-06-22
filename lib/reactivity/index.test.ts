import 'mocha'
import { expect } from 'chai'
import { assert_type as assert, tuple as t } from '@ts-std/types'

import {
	Immutable, Mutable, batch,
	signal, channel, primitive, pointer, distinct, borrow,
	/*derived, driftingDerived,*/ computed, /*driftingComputed,*/ /*thunk,*/
	effect, statefulEffect,
} from './index'


describe('OnlyWatchable', () => {
	it('signal', () => {
		const s = signal()
		s.r()
		s.s()
	})

	it('channel', () => {
		const a = channel([0, 0, 0])
		expect(a.r()).eql([0, 0, 0])

		a.s([1, 2, 3])
		expect(a.r()).eql([1, 2, 3])

		let runCount = 0
		let currentMessage = ''
		effect(() => {
			runCount++
			currentMessage = a.r().join(', ')
		})

		expect(runCount === 1).true
		expect(currentMessage === '1, 2, 3').true

		a.s([1])
		expect(runCount === 2).true
		expect(currentMessage === '1').true

		a.s([0])
		expect(runCount === 3).true
		expect(currentMessage === '0').true
	})

	it('primitive', () => {
		const a = primitive('a')
		expect(a.r() === 'a').true
		a.s('b')
		expect(a.r() === 'b').true

		let bad: never = primitive([])
		bad = primitive({})
		bad = primitive(new Set())
	})
	it('boolean primitive', () => {
		const v = primitive(true)
		const a: boolean = v.r()
		const b: void = v.s(false)
		const c: void = v.s(true)
	})

	it('pointer', () => {
		const arrOne = [] as number[]
		const a = pointer(arrOne)
		expect(a.r() === arrOne).true
		const arrTwo = [1, 2, 3]
		a.s(arrTwo)
		expect(a.r() === arrTwo).true
	})

	it('distinct', () => {
		const a = distinct([0, 0, 0], (left, right) => left.length === right.length)
		expect(a.r()).eql([0, 0, 0])

		// we don't just not alert dependencies
		// we drop the value on the ground
		a.s([1, 2, 3])
		expect(a.r()).eql([0, 0, 0])

		let runCount = 0
		let currentMessage = ''
		effect(() => {
			runCount++
			currentMessage = a.r().join(', ')
		})

		expect(runCount === 1).true
		expect(currentMessage === '0, 0, 0').true

		a.s([1])
		expect(runCount === 2).true
		expect(currentMessage === '1').true

		a.s([0])
		expect(runCount === 2).true
		expect(currentMessage === '1').true
	})

	it('immutable borrow', () => {
		const a = primitive('a')
		const r = borrow(a)
		assert.same<typeof a, Mutable<string>>(true)
		assert.same<typeof r, Mutable<string>>(false)
		assert.same<typeof r, Immutable<string>>(true)

		expect(r.r() === 'a').true

		let runCount = 0
		let currentMessage = ''
		effect(() => {
			runCount++
			currentMessage = r.r()
		})

		expect(runCount === 1).true
		expect(currentMessage === 'a').true

		a.s('b')
		expect(runCount === 2).true
		expect(currentMessage === 'b').true

		a.s('b')
		expect(runCount === 2).true
		expect(currentMessage === 'b').true
	})
})


describe('OnlyWatcher', () => {
	it('signal effect', () => {
		const s = signal()
		let runCount = 0
		effect(() => {
			s.r()
			runCount++
		})

		expect(runCount === 1).true
		s.s()
		expect(runCount === 2).true
		s.s()
		expect(runCount === 3).true
	})

	it('simple effect', () => {
		const a = primitive('a')
		let runCount = 0
		let currentMessage = ''
		effect(() => {
			runCount++
			currentMessage = a.r()
		})

		expect(currentMessage === 'a').true
		expect(runCount === 1).true

		a.s('b')
		expect(currentMessage === 'b').true
		expect(runCount === 2).true

		// checking for non repetition
		a.s('b')
		expect(currentMessage === 'b').true
		expect(runCount === 2).true

		a.s('c')
		expect(currentMessage === 'c').true
		expect(runCount === 3).true
	})

	it('statefulEffect', () => {
		const a = channel(0)
		let n = 0
		let runCount = 0
		let destructorRunCount = 0
		const stop = statefulEffect((b, destroy) => {
			n = a.r() + b
			runCount++
			destroy(() => {
				destructorRunCount++
				n = 0
			})

			return ++b
		}, 0)

		expect(n === 0).true
		expect(runCount === 1).true
		expect(destructorRunCount === 0).true

		a.s(0)
		expect(a.r() === 0).true
		expect(n === 1).true
		expect(runCount === 2).true
		expect(destructorRunCount === 1).true

		a.s(0)
		expect(a.r() === 0).true
		expect(n === 2).true
		expect(runCount === 3).true
		expect(destructorRunCount === 2).true

		a.s(1)
		expect(a.r() === 1).true
		expect(n === 4).true
		expect(runCount === 4).true
		expect(destructorRunCount === 3).true

		stop()
		expect(a.r() === 1).true
		expect(n === 0).true
		expect(runCount === 4).true
		expect(destructorRunCount === 4).true
	})

	it('effect disallows mutation', () => {
		const a = primitive('a')
		expect(() => effect(() => a.s('b'))).throw('readonly')
	})

	it('complex effect', () => {
		const shouldRepeat = primitive(true)
		const str = primitive('initial')
		const count = primitive(1)
		const message = primitive('message')

		let runCount = 0
		let currentMessage = ''

		effect(() => {
			runCount++
			if (shouldRepeat.r())
				currentMessage = str.r().repeat(count.r())
			else
				currentMessage = message.r()
		})

		expect(runCount === 1).true
		expect(currentMessage === 'initial').true

		shouldRepeat.s(false)
		expect(runCount === 2).true
		expect(currentMessage === 'message').true

		// deregistered signals
		count.s(2)
		expect(runCount === 2).true
		expect(currentMessage === 'message').true

		shouldRepeat.s(true)
		expect(runCount === 3).true
		expect(currentMessage === 'initialinitial').true

		count.s(1)
		expect(runCount === 4).true
		expect(currentMessage === 'initial').true
	})


	it('batch', () => {
		const str = primitive('initial')
		const count = primitive(1)

		let runCount = 0
		let currentMessage = ''

		effect(() => {
			runCount++
			currentMessage = str.r().repeat(count.r())
		})

		expect(runCount === 1).true
		expect(currentMessage === 'initial').true

		batch(() => {
			count.s(4)
			expect(count.r() === 1).true
			expect(runCount === 1).true
			expect(currentMessage === 'initial').true

			str.s('blah')
			expect(str.r() === 'initial').true
			expect(runCount === 1).true
			expect(currentMessage === 'initial').true
		})

		expect(runCount === 2).true
		expect(currentMessage === 'blahblahblahblah').true
	})

	it('destructors', () => {
		let destructorRunCount = 0
		let totalRunCount = 0
		let runCount = 0
		const s = primitive(true)

		const stop = effect(destroy => {
			s.r()
			runCount++
			totalRunCount++
			destroy(() => {
				destructorRunCount++
				runCount = 0
			})
		})

		expect(runCount === 1).true
		expect(totalRunCount === 1).true
		expect(destructorRunCount === 0).true

		s.s(false)
		expect(runCount === 1).true
		expect(totalRunCount === 2).true
		expect(destructorRunCount === 1).true

		s.s(true)
		expect(runCount === 1).true
		expect(totalRunCount === 3).true
		expect(destructorRunCount === 2).true

		stop()
		expect(runCount === 0).true
		expect(totalRunCount === 3).true
		expect(destructorRunCount === 3).true

		// all watching should have stopped
		s.s(false)
		expect(runCount === 0).true
		expect(totalRunCount === 3).true
		expect(destructorRunCount === 3).true

		s.s(true)
		expect(runCount === 0).true
		expect(totalRunCount === 3).true
		expect(destructorRunCount === 3).true
	})


	// it('sample', () => {
	// 	const a = primitive('a')
	// 	const b = primitive('b')

	// 	let runCount = 0
	// 	let currentMessage = ''

	// 	effect(() => {
	// 		runCount++
	// 		currentMessage = `${sample(a)} ${b.r()}`
	// 	})

	// 	expect(runCount === 1).true
	// 	expect(currentMessage === 'a b').true

	// 	a.s('aa')
	// 	expect(runCount === 1).true
	// 	expect(currentMessage === 'a b').true

	// 	b.s('bb')
	// 	expect(runCount === 2).true
	// 	expect(currentMessage === 'aa bb').true

	// 	a.s('a')
	// 	expect(runCount === 2).true
	// 	expect(currentMessage === 'aa bb').true

	// 	b.s('b')
	// 	expect(runCount === 3).true
	// 	expect(currentMessage === 'a b').true
	// })


	it('nested computations', () => {
		const active = primitive(true)
		const a = primitive('a')
		const b = primitive('b')
		let aRunCount = 0
		let aMessage = ''
		let bRunCount = 0
		let bMessage = ''

		effect(() => {
			if (!active.r()) return
			effect(destroy => {
				aRunCount++
				aMessage = a.r()
				destroy(() => { aMessage = '' })
			})
			effect(destroy => {
				bRunCount++
				bMessage = b.r()
				destroy(() => { bMessage = '' })
			})
		})

		expect(aRunCount === 1).true
		expect(aMessage === 'a').true
		expect(bRunCount === 1).true
		expect(bMessage === 'b').true

		batch(() => { a.s('aa'); b.s('bb') })
		expect(aRunCount === 2).true
		expect(aMessage === 'aa').true
		expect(bRunCount === 2).true
		expect(bMessage === 'bb').true

		active.s(false)
		expect(aRunCount === 2).true
		expect(aMessage === '').true
		expect(bRunCount === 2).true
		expect(bMessage === '').true

		batch(() => { a.s('a'); b.s('b') })
		expect(aRunCount === 2).true
		expect(aMessage === '').true
		expect(bRunCount === 2).true
		expect(bMessage === '').true

		active.s(true)
		expect(aRunCount === 3).true
		expect(aMessage === 'a').true
		expect(bRunCount === 3).true
		expect(bMessage === 'b').true
	})

	it('deep nested computations', () => {
		const active = primitive(true)
		const a = primitive('a')
		const b = primitive('b')
		let aRunCount = 0
		let aDestructorRunCount = 0
		let aMessage = ''
		let bRunCount = 0
		let bDestructorRunCount = 0
		let bMessage = ''

		effect(() => {
			if (!active.r()) return
			effect(destroy => {
				console.log('a effect')
				aRunCount++
				aMessage = a.r()
				destroy(() => { aDestructorRunCount++; aMessage = '' })

				effect(destroy => {
					console.log('b effect')
					bRunCount++
					bMessage = b.r()
					destroy(() => { bDestructorRunCount++; bMessage = '' })
				})
			})
		})

		expect(aRunCount === 1).true
		expect(aDestructorRunCount === 0).true
		expect(aMessage === 'a').true
		expect(bRunCount === 1).true
		expect(bDestructorRunCount === 0).true
		expect(bMessage === 'b').true

		a.s('aa')
		expect(aRunCount === 2).true
		expect(aDestructorRunCount === 1).true
		expect(aMessage === 'aa').true
		expect(bRunCount === 2).true
		expect(bDestructorRunCount === 1).true
		expect(bMessage === 'b').true

		b.s('bb')
		expect(aRunCount === 2).true
		expect(aDestructorRunCount === 1).true
		expect(aMessage === 'aa').true
		expect(bRunCount === 3).true
		expect(bDestructorRunCount === 2).true
		expect(bMessage === 'bb').true

		// batch(() => { a.s('a'); b.s('b') })
		batch(() => { b.s('b'); a.s('a') })
		expect(aRunCount === 3).true
		expect(aDestructorRunCount === 2).true
		expect(aMessage === 'a').true
		expect(bRunCount === 4).true
		expect(bDestructorRunCount === 3).true
		expect(bMessage === 'b').true

		batch(() => { a.s('aaa'); b.s('bbb') })
		expect(aRunCount === 4).true
		expect(aDestructorRunCount === 3).true
		expect(aMessage === 'aaa').true
		expect(bRunCount === 5).true
		expect(bDestructorRunCount === 4).true
		expect(bMessage === 'bbb').true

		active.s(false)
		expect(aRunCount === 4).true
		expect(aDestructorRunCount === 3).true
		expect(aMessage === '').true
		expect(bRunCount === 5).true
		expect(bDestructorRunCount === 4).true
		expect(bMessage === '').true

		batch(() => { a.s('aa'); b.s('bb') })
		expect(aRunCount === 4).true
		expect(aDestructorRunCount === 3).true
		expect(aMessage === '').true
		expect(bRunCount === 5).true
		expect(bDestructorRunCount === 4).true
		expect(bMessage === '').true

		active.s(true)
		expect(aRunCount === 5).true
		expect(aDestructorRunCount === 4).true
		expect(aMessage === 'aa').true
		expect(bRunCount === 6).true
		expect(bDestructorRunCount === 5).true
		expect(bMessage === 'bb').true
	})
})


describe('WatchableWatcher', () => {
	// derived, driftingDerived, computed, driftingComputed

	// it('derived', () => {
	// 	const str = primitive('a')
	// 	expect(str.r() === 'a').true
	// 	assert.same<typeof str, Mutable<string>>(true)
	// 	assert.assignable<keyof typeof str, 'r' | 's'>(true)

	// 	const strLength = derived(str, str => str.length)
	// 	assert.assignable<keyof typeof strLength, 'r'>(true)
	// 	assert.assignable<keyof typeof strLength, 'r' | 's'>(false)
	// 	assert.same<typeof strLength, Immutable<number>>(true)

	// 	expect(str.r() === 'a').true
	// 	expect(strLength.r() === 1).true

	// 	str.s('ab')
	// 	expect(str.r() === 'ab').true
	// 	expect(strLength.r() === 2).true
	// })
	// it('driftingDerived', () => {
	// 	//
	// })
	// // - `multi`: fixed dependencies, and a function that returns multiple things which will each become their own `Watchable`
	// // - `split`: fixed dependency on an object, merely creates `Watchable`s for each field
	// // - `splitTuple`: fixed dependency on a tuple, merely creates `Watchable`s for each field

	it('just computed by itself', () => {
		const str = primitive('a')
		let runCount = 0
		const upper = computed(() => {
			runCount++
			return str.r().toUpperCase()
		})
		assert.same<typeof upper, Mutable<string>>(false)
		assert.same<typeof upper, Immutable<string>>(true)

		expect(upper.r() === 'A').true
		expect(runCount === 1).true

		str.s('b')
		expect(upper.r() === 'B').true
		expect(runCount === 2).true

		str.s('b')
		expect(upper.r() === 'B').true
		expect(runCount === 2).true
	})

	it('only computed diamond', () => {
		const str = primitive('a')
		const evenLetters = computed(() => str.r().length % 2 === 0)
		const upperStr = computed(() => str.r().toUpperCase())

		expect(str.r() === 'a').true
		expect(evenLetters.r() === false).true
		expect(upperStr.r() === 'A').true

		let runCount = 0
		let currentMessage = ''
		effect(() => {
			runCount++
			currentMessage = evenLetters.r() ? `${upperStr.r()} even` : upperStr.r()
		})

		expect(runCount === 1).true
		expect(currentMessage === 'A').true

		str.s('aa')
		expect(runCount === 2).true
		expect(currentMessage === 'AA even').true
	})

	it('complex computed diamond', () => {
		const append = primitive('append')
		const str = primitive('a')

		let evenLettersRunCount = 0
		const evenLetters = computed(() => {
			evenLettersRunCount++
			return str.r().length % 2 === 0
		})
		let transformedStrRunCount = 0
		const transformedStr = computed(() => {
			transformedStrRunCount++
			const app = ` ${append.r()}`
			return evenLetters.r()
				? str.r().toUpperCase() + app
				: str.r() + app
		})

		expect(append.r() === 'append').true
		expect(str.r() === 'a').true
		expect(evenLetters.r() === false).true
		expect(transformedStr.r() === 'a append').true
		expect(evenLettersRunCount === 1).true
		expect(transformedStrRunCount === 1).true

		let runCount = 0
		let currentMessage = ''
		effect(() => {
			runCount++
			currentMessage = evenLetters.r() ? `${transformedStr.r()} even` : transformedStr.r()
		})

		expect(runCount === 1).true
		expect(currentMessage === 'a append').true
		expect(evenLettersRunCount === 1).true
		expect(transformedStrRunCount === 1).true

		str.s('aa')
		expect(runCount === 2).true
		expect(currentMessage === 'AA append even').true
		expect(evenLettersRunCount === 2).true
		expect(transformedStrRunCount === 2).true
	})

	it('computed circular reference', () => {
		const str = primitive('a')
		const upperStr: Immutable<string> = computed(() => {
			return str.r() === str.r().toUpperCase()
				? alreadyUpper.r() ? str.r() : str.r()
				: str.r().toUpperCase()
		})
		const alreadyUpper: Immutable<boolean> = computed(() => {
			return upperStr.r() === str.r()
		})

		expect(() => str.s('A')).throw('circular reference')
	})

	// it('thunk', () => {
	// 	const str = primitive('a')
	// 	let runCount = 0
	// 	const upperStr = thunk(() => {
	// 		runCount++
	// 		return str.r().toUpperCase()
	// 	})

	// 	expect(runCount === 0).true
	// 	expect(upperStr.r() === 'A').true
	// 	expect(runCount === 1).true
	// })

	it('nested computed', () => {
		const active = primitive(true)
		const a = primitive('a')
		const b = primitive('b')

		let aRunCount = 0
		let bRunCount = 0

		effect(() => {
			if (!active.r()) return
			computed(() => {
				aRunCount++
				return a.r()
			})
			computed(() => {
				bRunCount++
				return b.r()
			})
		})

		expect(aRunCount === 1).true
		expect(bRunCount === 1).true

		a.s('aa')
		expect(aRunCount === 2).true
		expect(bRunCount === 1).true
		b.s('bb')
		expect(aRunCount === 2).true
		expect(bRunCount === 2).true

		active.s(false)
		expect(aRunCount === 2).true
		expect(bRunCount === 2).true

		batch(() => { a.s('a'); b.s('b') })
		expect(aRunCount === 2).true
		expect(bRunCount === 2).true

		active.s(true)
		expect(aRunCount === 3).true
		expect(bRunCount === 3).true
	})

	// it('driftingComputed', () => {
	// 	//
	// })
})
