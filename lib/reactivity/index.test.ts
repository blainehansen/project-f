import 'mocha'
import { expect } from 'chai'
import { assert_type as assert, tuple as t } from '@ts-std/types'

import {
	Immutable, Mutable, batch,
	signal, channel, primitive, pointer, distinct, borrow,
	derived, computed, /*thunk,*/
	effect, statefulEffect,
} from './index'


describe('SourceWatchable', () => {
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

		expect(runCount).equal(1)
		expect(currentMessage).equal('1, 2, 3')

		a.s([1])
		expect(runCount).equal(2)
		expect(currentMessage).equal('1')

		a.s([0])
		expect(runCount).equal(3)
		expect(currentMessage).equal('0')
	})

	it('primitive', () => {
		const a = primitive('a')
		expect(a.r()).equal('a')
		a.s('b')
		expect(a.r()).equal('b')

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
		expect(a.r()).equal(arrOne)
		const arrTwo = [1, 2, 3]
		a.s(arrTwo)
		expect(a.r()).equal(arrTwo)
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

		expect(runCount).equal(1)
		expect(currentMessage).equal('0, 0, 0')

		a.s([1])
		expect(runCount).equal(2)
		expect(currentMessage).equal('1')

		a.s([0])
		expect(runCount).equal(2)
		expect(currentMessage).equal('1')
	})

	it('immutable borrow', () => {
		const a = primitive('a')
		const r = borrow(a)
		assert.same<typeof a, Mutable<string>>(true)
		assert.same<typeof r, Mutable<string>>(false)
		assert.same<typeof r, Immutable<string>>(true)

		expect(r.r()).equal('a')

		let runCount = 0
		let currentMessage = ''
		effect(() => {
			runCount++
			currentMessage = r.r()
		})

		expect(runCount).equal(1)
		expect(currentMessage).equal('a')

		a.s('b')
		expect(runCount).equal(2)
		expect(currentMessage).equal('b')

		a.s('b')
		expect(runCount).equal(2)
		expect(currentMessage).equal('b')
	})
})


describe('SinkWatcher', () => {
	it('signal effect', () => {
		const s = signal()
		let runCount = 0
		effect(() => {
			s.r()
			runCount++
		})

		expect(runCount).equal(1)
		s.s()
		expect(runCount).equal(2)
		s.s()
		expect(runCount).equal(3)
	})

	it('simple effect', () => {
		const a = primitive('a')
		let runCount = 0
		let currentMessage = ''
		effect(() => {
			runCount++
			currentMessage = a.r()
		})

		expect(currentMessage).equal('a')
		expect(runCount).equal(1)

		a.s('b')
		expect(currentMessage).equal('b')
		expect(runCount).equal(2)

		// checking for non repetition
		a.s('b')
		expect(currentMessage).equal('b')
		expect(runCount).equal(2)

		a.s('c')
		expect(currentMessage).equal('c')
		expect(runCount).equal(3)
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

		expect(n).equal(0)
		expect(runCount).equal(1)
		expect(destructorRunCount).equal(0)

		a.s(0)
		expect(a.r()).equal(0)
		expect(n).equal(1)
		expect(runCount).equal(2)
		expect(destructorRunCount).equal(1)

		a.s(0)
		expect(a.r()).equal(0)
		expect(n).equal(2)
		expect(runCount).equal(3)
		expect(destructorRunCount).equal(2)

		a.s(1)
		expect(a.r()).equal(1)
		expect(n).equal(4)
		expect(runCount).equal(4)
		expect(destructorRunCount).equal(3)

		stop()
		expect(a.r()).equal(1)
		expect(n).equal(0)
		expect(runCount).equal(4)
		expect(destructorRunCount).equal(4)
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

		expect(runCount).equal(1)
		expect(currentMessage).equal('initial')

		shouldRepeat.s(false)
		expect(runCount).equal(2)
		expect(currentMessage).equal('message')

		// deregistered signals
		count.s(2)
		expect(runCount).equal(2)
		expect(currentMessage).equal('message')

		shouldRepeat.s(true)
		expect(runCount).equal(3)
		expect(currentMessage).equal('initialinitial')

		count.s(1)
		expect(runCount).equal(4)
		expect(currentMessage).equal('initial')
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

		expect(runCount).equal(1)
		expect(currentMessage).equal('initial')

		batch(() => {
			count.s(4)
			expect(count.r()).equal(1)
			expect(runCount).equal(1)
			expect(currentMessage).equal('initial')

			str.s('blah')
			expect(str.r()).equal('initial')
			expect(runCount).equal(1)
			expect(currentMessage).equal('initial')
		})

		expect(runCount).equal(2)
		expect(currentMessage).equal('blahblahblahblah')
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

		expect(runCount).equal(1)
		expect(totalRunCount).equal(1)
		expect(destructorRunCount).equal(0)

		s.s(false)
		expect(runCount).equal(1)
		expect(totalRunCount).equal(2)
		expect(destructorRunCount).equal(1)

		s.s(true)
		expect(runCount).equal(1)
		expect(totalRunCount).equal(3)
		expect(destructorRunCount).equal(2)

		stop()
		expect(runCount).equal(0)
		expect(totalRunCount).equal(3)
		expect(destructorRunCount).equal(3)

		// all watching should have stopped
		s.s(false)
		expect(runCount).equal(0)
		expect(totalRunCount).equal(3)
		expect(destructorRunCount).equal(3)

		s.s(true)
		expect(runCount).equal(0)
		expect(totalRunCount).equal(3)
		expect(destructorRunCount).equal(3)
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

	// 	expect).equal(=== 1)
	// 	expect).equal(=== 'a b')

	// 	a.s('aa')
	// 	expect).equal(=== 1)
	// 	expect).equal(=== 'a b')

	// 	b.s('bb')
	// 	expect).equal(=== 2)
	// 	expect).equal(=== 'aa bb')

	// 	a.s('a')
	// 	expect).equal(=== 2)
	// 	expect).equal(=== 'aa bb')

	// 	b.s('b')
	// 	expect).equal(=== 3)
	// 	expect).equal(=== 'a b')
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

		expect(aRunCount).equal(1)
		expect(aMessage).equal('a')
		expect(bRunCount).equal(1)
		expect(bMessage).equal('b')

		batch(() => { a.s('aa'); b.s('bb') })
		expect(aRunCount).equal(2)
		expect(aMessage).equal('aa')
		expect(bRunCount).equal(2)
		expect(bMessage).equal('bb')

		active.s(false)
		expect(aRunCount).equal(2)
		expect(aMessage).equal('')
		expect(bRunCount).equal(2)
		expect(bMessage).equal('')

		batch(() => { a.s('a'); b.s('b') })
		expect(aRunCount).equal(2)
		expect(aMessage).equal('')
		expect(bRunCount).equal(2)
		expect(bMessage).equal('')

		active.s(true)
		expect(aRunCount).equal(3)
		expect(aMessage).equal('a')
		expect(bRunCount).equal(3)
		expect(bMessage).equal('b')
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
				aRunCount++
				aMessage = a.r()
				destroy(() => { aDestructorRunCount++; aMessage = '' })

				effect(destroy => {
					bRunCount++
					bMessage = b.r()
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

		a.s('aa')
		expect(aRunCount).equal(2)
		expect(aDestructorRunCount).equal(1)
		expect(aMessage).equal('aa')
		expect(bRunCount).equal(2)
		expect(bDestructorRunCount).equal(1)
		expect(bMessage).equal('b')

		b.s('bb')
		expect(aRunCount).equal(2)
		expect(aDestructorRunCount).equal(1)
		expect(aMessage).equal('aa')
		expect(bRunCount).equal(3)
		expect(bDestructorRunCount).equal(2)
		expect(bMessage).equal('bb')

		batch(() => { b.s('b'); a.s('a') })
		expect(aRunCount).equal(3)
		expect(aDestructorRunCount).equal(2)
		expect(aMessage).equal('a')
		expect(bRunCount).equal(4)
		expect(bDestructorRunCount).equal(3)
		expect(bMessage).equal('b')

		batch(() => { a.s('aaa'); b.s('bbb') })
		expect(aRunCount).equal(4)
		expect(aDestructorRunCount).equal(3)
		expect(aMessage).equal('aaa')
		expect(bRunCount).equal(5)
		expect(bDestructorRunCount).equal(4)
		expect(bMessage).equal('bbb')

		active.s(false)
		expect(aRunCount).equal(4)
		expect(aDestructorRunCount).equal(4)
		expect(aMessage).equal('')
		expect(bRunCount).equal(5)
		expect(bDestructorRunCount).equal(5)
		expect(bMessage).equal('')

		batch(() => { a.s('aa'); b.s('bb') })
		expect(aRunCount).equal(4)
		expect(aDestructorRunCount).equal(4)
		expect(aMessage).equal('')
		expect(bRunCount).equal(5)
		expect(bDestructorRunCount).equal(5)
		expect(bMessage).equal('')

		active.s(true)
		expect(aRunCount).equal(5)
		expect(aDestructorRunCount).equal(4)
		expect(aMessage).equal('aa')
		expect(bRunCount).equal(6)
		expect(bDestructorRunCount).equal(5)
		expect(bMessage).equal('bb')
	})
})


describe('ReactivePipe', () => {
	it('derived', () => {
		const str = primitive('a')
		assert.same<typeof str, Mutable<string>>(true)
		assert.assignable<keyof typeof str, 'r' | 's'>(true)

		// const strLength = derived(str, str => str.length)
		const strLength = derived(str => str.length, str)
		assert.assignable<keyof typeof strLength, 'r'>(true)
		assert.assignable<keyof typeof strLength, 'r' | 's'>(false)
		assert.same<typeof strLength, Immutable<number>>(true)

		expect(str.r()).equal('a')
		expect(strLength.r()).equal(1)

		str.s('ab')
		expect(str.r()).equal('ab')
		expect(strLength.r()).equal(2)
	})
	// // - `split`: fixed dependency on an object, merely creates `Watchable`s for each field
	// // - `splitComputed`: fixed dependencies, and a function that returns multiple things which will each become their own `Watchable`
	// // - `splitTuple`: fixed dependency on a tuple, merely creates `Watchable`s for each field

	it('computed', () => {
		const str = primitive('a')
		let runCount = 0
		const upper = computed(() => {
			runCount++
			return str.r().toUpperCase()
		})
		assert.same<typeof upper, Mutable<string>>(false)
		assert.same<typeof upper, Immutable<string>>(true)

		expect(upper.r()).equal('A')
		expect(runCount).equal(1)

		str.s('b')
		expect(upper.r()).equal('B')
		expect(runCount).equal(2)

		str.s('b')
		expect(upper.r()).equal('B')
		expect(runCount).equal(2)
	})

	it('computed diamond', () => {
		const str = primitive('a')
		const evenLetters = computed(() => str.r().length % 2 === 0)
		const upperStr = computed(() => str.r().toUpperCase())

		expect(str.r()).equal('a')
		expect(evenLetters.r()).equal(false)
		expect(upperStr.r()).equal('A')

		let runCount = 0
		let currentMessage = ''
		effect(() => {
			runCount++
			currentMessage = evenLetters.r() ? `${upperStr.r()} even` : upperStr.r()
		})

		expect(runCount).equal(1)
		expect(currentMessage).equal('A')

		str.s('aa')
		expect(runCount).equal(2)
		expect(currentMessage).equal('AA even')
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

		expect(append.r()).equal('append')
		expect(str.r()).equal('a')
		expect(evenLetters.r()).equal(false)
		expect(transformedStr.r()).equal('a append')
		expect(evenLettersRunCount).equal(1)
		expect(transformedStrRunCount).equal(1)

		let runCount = 0
		let currentMessage = ''
		effect(() => {
			runCount++
			currentMessage = evenLetters.r() ? `${transformedStr.r()} even` : transformedStr.r()
		})

		expect(runCount).equal(1)
		expect(currentMessage).equal('a append')
		expect(evenLettersRunCount).equal(1)
		expect(transformedStrRunCount).equal(1)

		str.s('aa')
		expect(runCount).equal(2)
		expect(currentMessage).equal('AA append even')
		expect(evenLettersRunCount).equal(2)
		expect(transformedStrRunCount).equal(2)
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

	it('computed chain race', () => {
		const base = primitive('')
		let oneRunCount = 0
		const one = computed(() => {
			oneRunCount++
			return base.r() + 'a'
		})
		let twoRunCount = 0
		const two = computed(() => {
			twoRunCount++
			return one.r() + 'a'
		})
		let threeRunCount = 0
		const three = computed(() => {
			threeRunCount++
			return two.r() + 'a'
		})
		const head = primitive('b')
		let fourRunCount = 0
		const four = computed(() => {
			fourRunCount++
			return three.r() + head.r()
		})

		expect(oneRunCount).equal(1)
		expect(twoRunCount).equal(1)
		expect(threeRunCount).equal(1)
		expect(fourRunCount).equal(1)
		expect(one.r()).equal('a')
		expect(two.r()).equal('aa')
		expect(three.r()).equal('aaa')
		expect(four.r()).equal('aaab')

		batch(() => { head.s('c'); base.s('b') })
		expect(oneRunCount).equal(2)
		expect(twoRunCount).equal(2)
		expect(threeRunCount).equal(2)
		expect(fourRunCount).equal(2)
		expect(one.r()).equal('ba')
		expect(two.r()).equal('baa')
		expect(three.r()).equal('baaa')
		expect(four.r()).equal('baaac')

		batch(() => { base.s('x'); head.s('y') })
		expect(oneRunCount).equal(3)
		expect(twoRunCount).equal(3)
		expect(threeRunCount).equal(3)
		expect(fourRunCount).equal(3)
		expect(one.r()).equal('xa')
		expect(two.r()).equal('xaa')
		expect(three.r()).equal('xaaa')
		expect(four.r()).equal('xaaay')
	})

	// it('thunk', () => {
	// 	const str = primitive('a')
	// 	let runCount = 0
	// 	const upperStr = thunk(() => {
	// 		runCount++
	// 		return str.r().toUpperCase()
	// 	})

	// 	expect).equal(=== 0)
	// 	expect).equal(r() === 'A')
	// 	expect).equal(=== 1)
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

		expect(aRunCount).equal(1)
		expect(bRunCount).equal(1)

		a.s('aa')
		expect(aRunCount).equal(2)
		expect(bRunCount).equal(1)
		b.s('bb')
		expect(aRunCount).equal(2)
		expect(bRunCount).equal(2)

		active.s(false)
		expect(aRunCount).equal(2)
		expect(bRunCount).equal(2)

		batch(() => { a.s('a'); b.s('b') })
		expect(aRunCount).equal(2)
		expect(bRunCount).equal(2)

		active.s(true)
		expect(aRunCount).equal(3)
		expect(bRunCount).equal(3)
	})

	// it('driftingComputed', () => {
	// 	//
	// })
})
