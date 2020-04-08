https://dev.to/grandemayta/javascript-dom-manipulation-to-improve-performance-459a
https://developer.mozilla.org/en-US/docs/Web/API/Document/createDocumentFragment
https://javascript.info/basic-dom-node-properties

https://stackoverflow.com/questions/14048432/create-reusable-document-fragment-from-the-dom


```ts
parentNode.replaceChild(newChild, oldChild)
```


one with one
one with many
many with one
many with many

in the replacing many cases, you can either be replacing the entire contents of a node, or some subsection

- from the beginning to some static point
- from the beginning to some dynamic point
- from some static point to end
- from some dynamic point to end
- from a static point to a static point
- cartesian product of the above
