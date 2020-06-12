import { ref, value, effect, Mutable, Immutable } from './index'

class BankAccount {
	protected readonly _checking: Mutable<number>
	protected readonly _savings: Mutable<number>
	readonly checking: Immutable<number>
	readonly savings: Immutable<number>
	readonly defaultChecking = value(true)
	constructor() {
		;([this._checking, this.checking] = value.protect(0))
		;([this._savings, this.savings] = value.protect(0))

		effect(() => {
			console.log('== Your accounts ==')
			console.log(`Checking: ${this.checking()}`)
			console.log(`Savings: ${this.savings()}`)
			console.log()
		})
	}

	deposit(amount: number, useChecking = true) {
		const account = useChecking ? this._checking : this._savings
		const balance = account() + amount
		console.log(`made deposit of ${amount} to ${useChecking ? 'checking' : 'savings'}`)
		account(balance)
	}
	withdraw(amount: number, useChecking = true) {
		const { _checking: checking, _savings: savings } = this
		const account = useChecking ? checking : savings
		const current = account()
		if (current >= amount) {
			const balance = current - amount
			console.log(`made withdrawal of ${amount} from ${useChecking ? 'checking' : 'savings'}`)
			account(balance)
			return
		}

		console.log(`unable to withdraw ${amount} from ${useChecking ? 'checking' : 'savings'}`)
	}
}

const me = new BankAccount()
me.deposit(1000)
me.withdraw(50)
me.withdraw(1000)



// type SafeVersions<P, O, F extends Dict<(state: P & O, ...args: any[]) => any>> = {
// 	[K in keyof F]: SafeVersion<P, O, F, K>
// }
// type SafeVersion<P, O, F extends Dict<(state: P & O, ...args: any[]) => any>, K extends keyof F> =
// 	F[K] extends (state: P & O, ...args: infer A) => infer R
// 	? (...args: A) => R
// 	: never

// // we want to include readonly stuff here
// function Actor<A extends any[], P, O, F extends Dict<(state: P & O, ...args: any[]) => any>>(
// 	setup: (...args: A) => [P, O],
// 	functions: F,
// ): (...args: A) => Readonly<O & SafeVersions<P, O, F>>  {
// 	return function(...args: A) {
// 		const [protectedState, openState] = setup(...args)
// 		const internalState = { ...protectedState, ...openState } as P & O

// 		const safeVersions = {} as SafeVersions<P, O, F>
// 		for (const key in functions) {
// 			const fn = functions[key]
// 			safeVersions[key] = ((...fnArgs) => fn(internalState, ...fnArgs)) as SafeVersion<P, O, F, typeof key>
// 		}

// 		return { ...openState, ...safeVersions }
// 	}
// }

// const BankAccount = Actor((initial: number) => {
// 	return [{ _balance: initial }, { balance: initial }]
// }, {
// 	deposit(state, amount: number) {
// 		state._balance += amount
// 		state.balance = state._balance
// 	},
// 	withdraw(state, amount: number) {
// 		if (state._balance < amount) {
// 			console.warn(`not enough! ${state._balance}`)
// 			return undefined
// 		}
// 		state._balance -= amount
// 		state.balance = state._balance
// 		return amount
// 	},
// })

// const me = BankAccount(100)
// console.log(me.balance)
// console.log(me.withdraw(50))
// console.log(me.balance)
// console.log(me.deposit(150))
// console.log(me.balance)
// console.log(me.withdraw(500))
// console.log(me.balance)
