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


// type ActorVisitor<A extends any[], R> = (state, ...args: A) => R

// type ActorInterface<S, P> = {}

// export function Actor<C extends any[], S, P>(
// 	protectedState: P,
// 	setup: (state, ...args: C) => S,
// ) {
// 	//
// }

const me = new BankAccount()
me.deposit(1000)
me.withdraw(50)
me.withdraw(1000)

// type SafeVersions<P, O, F extends Dict<(state: P & O, ...args: any[]) => any>> = {
// 	[K in keyof F]: F[K] extends (state: P & O, ...args: infer A) => infer R
// 		? (...args: A) => R
// 		: never
// }

// export function Actor<A extends any[], P, O, F extends Dict<(P & O, ...args: any[]) => any> = {}>(
// 	setup: (...args: A) => [P, O],
// 	functions: F = {},
// ): (...args: A) => O & SafeVersions<F> {
// 	return function(...args: A) {
// 		const [protectedState, openState] = setup(...args)
// 		const internalState = { ...protectedState, ...openState } as P & O

// 		const safeVersions = {} as SafeVersions<F>
// 		for (const key in functions) {
// 			const fn = functions[key]
// 			safeVersions[key] = (...fnArgs) => fn(internalState, ...fnArgs)
// 		}

// 		return { ...openState, ...safeVersions }
// 	}
// }
