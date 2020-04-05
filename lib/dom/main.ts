// const svgNS = 'http://www.w3.org/2000/svg' as const
// document.createElementNS

// type SvgName = Parameters<typeof document.createElementNS>[1]
// function createSvg<E extends SvgName>(element: E) {
//     return document.createElementNS(svgNS, element)
// }

// const el = createSvg('circle')

// file:///home/blaine/lab/project-f/lib/dom/main.html

(window as any).main = function() {
	const div = document.createElement('div')
	div.textContent = 'yo yo yo'

	document.body.appendChild(div)
}
