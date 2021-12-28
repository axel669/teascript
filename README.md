# TeaScript
For people who don't like coffee.

> This is an updated language idea with brand new syntax that is not compatible
> with the old TeaScript, which is no longer maintained.

## Installation

### Yarn
```bash
yarn add @axel669/teascript
```

### NPM
```bash
npm i @axel669/teascript
```

## API
```javascript
const tea = require("@axel669/teascript")

const result = await tea(
    sourceCode,
    options = {
        target?: "es6" | "browser"
    }
)
if (result instanceof Error) {
    //  do something with the error
}
const { code, ast } = result
```

## CLI Usage

### Run Script
```
tea file <input file> <options>
```
### Transpile File
```
tea file <input file> <dest file> <options>
tea file -c <input file> <options>
```
### Transpile Directory
```
tea file -d <input dir> <dest dir> <options>
```

### CLI Options
```
-c, -compile
Output file will be in the same dir as the source file

-d, -dir
Compile directory with output file structure mirroring source directory

-target=es6|node
Code output target. es6 will use import statements for the built-in functions,
browser will inline the built-in functions, any other value (or omitting) will
insert require calls.
```

## Browser Usage
Include the script `build/browser-tea.js` on the page or use the CDN link.
The browser script adds the `teascript` function to the global scope.

```html
<script src="https://cdn.jsdelivr.net/gh/axel669/teascript@v0.22.9/dist/browser-tea.js"></script>
```

## TODO
See the language ref (in the [ref](/ref) folder) for the future plans.

## Changelog

### 0.22.10
+ add `args` variable to scope in functions
+ reworked cli to function properly

### 0.22.9
+ fix for backticks in template string output

### 0.22.8
+ fix for do expressions

### 0.22.7
+ update exposed API
+ made cli options fit more standard styles
+ add browser support

### 0.22.6
+ fixed bug in multiline comments not parsing
+ pipeline operator fully implemented
+ added await ops (.all, .allSettled, .any, .race)
+ cli changes to make it easier (stole another idea from coffeescript)

### 0.22.5
+ fixed bug where ternary wouldn't parse the long form

### 0.22.4
+ fixed a bug in function args introduced by the change to export/variable decl
+ added debugger keyword
+ assignment using `=` removed, finally decided to not use that
+ assignment arrows are now spaceships `<+` / `+>`

### 0.22.3
+ added `safeguard^`

### 0.22.2
+ added rollup and svelte plugins
+ force brackets on all if statements

### 0.22.1
+ fix publish error where a file was forgotton
+ update README with information about the api

### 0.22.0
+ added safeguard keyword
+ added pipeline operator (Hack version)
+ make guard interchangable with if
+ allow direction of destructuring in var creation to go either way
+ allow spaces around array comprehensions, and newline before "from"
+ require returns at the end of if statements
+ force return to have an expression (void allowed)
+ fix bug in string parsing of "#"
+ (hopefully) improved api error reporting

### 0.21.7
+ changed comments to use `#` instead of `//`
+ fixed bug in parsing computed keys
+ fixed export syntax bug

### 0.21.6
+ changed string interpolation syntax
+ changed mutable from "let mut" to just "mut" on declaration

### 0.21.5
+ bugfix for compiler using browser option
+ bugfix for the builtin funcs to be required/imported correctly

### 0.21.4
+ added es6 compiler option to use import statements instead of require for
    builtin funcs

### 0.21.3
+ added programmatic API
+ comiler defaults to making require statements for built-in functions
    + -b/browser option to have functions inlined

### 0.21.2
+ fixed bug with functions that had no args defined
+ changed cli for transpiling files
+ added cli options to run without saving extra files, and transpile dirs

### 0.21.1
+ quick cli fix

### 0.21.0
+ changed object key to use :
+ changed arrow functions to allow argument list, but no default values
+ changed function args to use @, styled like variable declaration
+ made instance, delete, and typeof into proper ops with neat syntax
+ added reactive label support for svelte
+ added support for BigInt, hex, and binary number literals
+ added support for open ranges in slice syntax
+ added spread to positional arguments
+ added support for named args to use object shorthand keys

### 0.20.0
- redid the whole thing from the ground up

### 0.16.x and earlier
- previous version from 2019, no longer maintained but want to reuse the name
    in npm
