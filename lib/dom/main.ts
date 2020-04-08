// const svgNS = 'http://www.w3.org/2000/svg' as const
// document.createElementNS

// type SvgName = Parameters<typeof document.createElementNS>[1]
// function createSvg<E extends SvgName>(element: E) {
//     return document.createElementNS(svgNS, element)
// }

// const el = createSvg('circle')

// file:///home/blaine/lab/project-f/lib/dom/main.html

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
