import 'mocha'
import { expect } from 'chai'
import ts = require('typescript')

const sourceFile = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest)
