// file:///home/blaine/lab/project-f/lib/dom/main.html

// import { ContentState, Displayable, replaceContent, Range, RangeType, replaceRange } from './index'
import { Immutable, Mutable, effect, statefulEffect, data, value, channel, computed, thunk, sample } from '../reactivity'

function reactiveText() {
	//
}

(window as any).main = function() {
	const button = document.createElement('button')
	button.textContent = 'yoyo'
	button.onclick = () => {
		console.log('it works')
	}

	document.body.appendChild(button)
	// const range = document.createRange()
	// const
}
