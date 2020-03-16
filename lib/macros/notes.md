https://github.com/cevek/ttypescript
https://github.com/madou/typescript-transformer-handbook/blob/master/translations/en/transformer-handbook.md
https://levelup.gitconnected.com/writing-typescript-custom-ast-transformer-part-1-7585d6916819
https://levelup.gitconnected.com/writing-a-custom-typescript-ast-transformer-731e2b0b66e6
https://github.com/phenomnomnominal/tsquery

Ideally the api would look something like this:

```ts
// macros.ts
function post() {
  //
}

// api.ts
import { post } from macros!('macros')
@post("/user/{id}")
function newUser(id: number, query: Params, body: User) {
  //
}
```

In that above example, the `post` macro would expect the function to have at least as many arguments as `{}` segments and with aligning names, then the remainder would be expected to be named either query or body or headers or whatever.
