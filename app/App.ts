import App from iron!!('./App')
import { mount } from '../lib/'

import { Ok } from '@ts-std/monads'
console.log(Ok(4))

mount(App, document.body)
