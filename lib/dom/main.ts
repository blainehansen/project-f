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
