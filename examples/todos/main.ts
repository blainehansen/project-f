import router from './router'

(window as any).main = function() {
	const app = router()
	document.body.appendChild(app)
}
