// https://mattallan.me/posts/modern-javascript-without-a-bundler/
// file:///home/blaine/lab/project-f/lib/dom/main.html

import { CheckboxIfElseBlock, TextInput, BasicEach, IfThenEach, EachThenIf } from './main.spec'


const parent = document.body
const container = document.createDocumentFragment()
// BasicEach(parent, container)
// IfThenEach(parent, container)
EachThenIf(parent, container)
parent.appendChild(container)

