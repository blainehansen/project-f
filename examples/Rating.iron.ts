import { createElementClass as ___createElementClass, createElementClasses as ___createElementClasses, contentEffect as ___contentEffect, bindProperty as ___bindProperty, rangeEffect as ___rangeEffect, Args as ___Args, ComponentDefinition as ___ComponentDefinition } from "project-f/runtime"

const ___Component: ___ComponentDefinition<Component> = (___real, ___parent, { maxStars, hasCounter }, { stars }, {}, {}) => {
	const { starItems } = create(({ maxStars, hasCounter, stars } as ___Args<Component>))

	const ___div_0 = ___createElementClass(___parent, "div", "rating")
	const ___div_0fragment = document.createDocumentFragment()

	const ___ul_0_0 = ___createElementClass(___div_0fragment, "ul", "list")
	___contentEffect((___real, ___parent) => {
		const ___eachBlockCollection0 = starItems.r()
		const ___eachBlockCollectionLength0 = ___eachBlockCollection0.length
		for (let ___eachBlockIndex0 = 0; ___eachBlockIndex0 < ___eachBlockCollectionLength0; ___eachBlockIndex0++) {
			const star = ___eachBlockCollection0[___eachBlockIndex0]

			const ___li0_0 = ___createElementClasses(___parent, "li", "star", star.active && 'active')
			___li0_0.onclick = $event => stars.s(star.amount)
			___createElementClasses(___li0_0, "i", star.active ? 'fas fa-star' : 'far fa-star')
		}
	}, ___ul_0_0)

	___rangeEffect((___real, ___parent) => {
		if (hasCounter.r()) {
			const ___div_0 = ___createElementClass(___parent, "div", "counter")
			const ___div_0fragment = document.createDocumentFragment()

			const ___span_0_0 = ___createElementClass(___div_0fragment, "span", "score-rating")
			___bindProperty(___span_0_0, "textContent", stars)

			___createElementClass(___div_0fragment, "span", "divider")

			const ___span_0_2 = ___createElementClass(___div_0fragment, "span", "score-max")
			___bindProperty(___span_0_2, "textContent", maxStars)

			___div_0.appendChild(___div_0fragment)
		}
	}, ___div_0, ___div_0fragment)
	___div_0.appendChild(___div_0fragment)
}
export default ___Component


import { Args, derived } from 'project-f'

export type Component = {
	props: { maxStars: number, hasCounter: boolean },
	syncs: { stars: number },
}

export function create({ maxStars, stars }: Args<Component>) {
	const starItems = derived((stars, maxStars) => {
		const items: { active: boolean, amount: number }[] = []
		for (let starIndex = 0; starIndex <= maxStars; starIndex++)
			items.push({ active: starIndex + 1 <= stars, amount: starIndex + 1 })

		return items
	}, stars, maxStars)

	return { starItems }
}
