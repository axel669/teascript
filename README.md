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

## Usage
Currently only basic command line usage for transpiling one file at a time.

```
tea file <input file> <output file>
```

## TODO
- add dir transpiling to cli
- add pipeline operator
- undecided
    - await/yield in do
    - turn builtin into requires (probably make as cli flag)

## Changelog

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
