#!/usr/bin/env node

const fs = require("fs-extra")
const path = require("path")

const prettier = require("prettier")

const teascript = require("./parser.js")
const generateCode = require("./grammar/gen-js.js")

const prettyOptions = {
    tabWidth: 4,
    arrowParens: "always",
    parser: "babel",
}

const transpile = async (source) => {
    const ast = teascript.parse(source)
    const [js, topLevel] = generateCode(ast)

    const topLevelFuncs = await Promise.all(
        Array.from(
            topLevel,
            (name) => fs.readFile(
                path.resolve(
                    __dirname,
                    `funcs/${name}.js`
                ),
                "utf8"
            )
        )
    )
    const output = [...topLevelFuncs, ...js].join("\n")

    return prettier.format(output, prettyOptions)
}

const commands = {
    file: async (source, target) => {
        const sourceCode = await fs.readFile(source, "utf8")
        const outputCode = await transpile(sourceCode)
        await fs.outputFile(target, outputCode)
    }
}

const [, , type, source, target] = process.argv

commands[type](source, target)
