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

const result = await tea(code)
if (result instanceof Error) {
    //  do something with the error
}
const [compiledJS, ast] = result
```

## CLI Usage

### Run Script
```
tea file -src:<input file>
```
### Transpile File
```
tea file -src:<input file> -dest:<dest file>
```
### Transpile Directory
```
tea file -d -src:<input dir> -dest:<dest dir>
```

## TODO
- block regex support
- undecided
    - await/yield in do

## Changelog

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
