// file:///home/blaine/lab/project-f/examples/main.html

import Rating from './Rating.iron'
import { primitive } from '../lib/reactivity'

const parent = document.body
const container = document.createDocumentFragment()
const maxStars = primitive(5)
const hasCounter = primitive(true)
const stars = primitive(3)
Rating(parent, container, { maxStars, hasCounter }, { stars }, {}, {})
parent.appendChild(container)
