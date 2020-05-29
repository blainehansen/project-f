import {
	createElementClass as ___createElementClass,
	contentEffect as ___contentEffect,
	joinClass as ___joinClass,
	rangeEffect as ___rangeEffect,
	bindProperty as ___bindProperty,
	ComponentDefinition as ___ComponentDefinition
} from "project-f/runtime"

const ___Component: ___ComponentDefinition<Component> = (___real, ___parent, { maxStars, hasCounter }, { stars }, {}, {}) => {
	const ___div0 = ___createElementClass(___parent, "div", "rating")

	const ___ul0_0 = ___createElementClass(___div0, "ul", "list")
	___contentEffect((___real, ___parent) => {
		const ___eachBlockCollection = starItems.r()
		const ___eachBlockCollectionLength = ___eachBlockCollection.length
		for (let ___eachBlockIndex = 0; ___eachBlockIndex < ___eachBlockCollectionLength; ___eachBlockIndex++) {
			const star = ___eachBlockCollectionLength[___eachBlockIndex]

			const ___li0 = ___createElementClass(___parent, "li", ___joinClass("star", star.active && 'active'))
			___li0.onclick = $event => stars(star.amount)

			___createElementClass(___li0, "i", star.active ? 'fas fa-star' : 'far fa-star')
		}
	}, ___ul0_0)

	___rangeEffect((___real, ___parent) => {
		if (hasCounter.r()) {
			const ___div0 = ___createElementClass(___parent, "div", "counter")

			const ___span0_0 = ___createElementClass(___div0, "span", "score-rating")
			___bindProperty(___span0_0, 'textContent', stars)

			___createElementClass(___div0, "span", "divider")

			const ___span0_2 = ___createElementClass(___div0, "span", "score-max")
			___bindProperty(___span0_2, 'textContent', maxStars)
		}
	}, ___div0)

	return ___div0
}
export default ___Component


import { Args, derived } from 'project-f'

export type Component = {
	props: {
		maxStars: number, hasCounter: boolean,
	},
	syncs: {
		stars: number,
	},
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
