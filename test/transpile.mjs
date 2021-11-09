import fs from "fs/promises"
import { inspect } from "util"

import peggy from "peggy"

import generateCode from "../grammar/gen-js.js"

inspect.defaultOptions.depth = null

export default async () => {
    const parser = peggy.generate(
        await fs.readFile("grammar/teascript.peggy", "utf8")
    )
    const code = await fs.readFile("test/code.tea", "utf8")

    const ast = parser.parse(code)
    console.log(ast)

    const [js, topLevel] = generateCode(ast)
    console.log(topLevel)
    const topLevelFuncs = await Promise.all(
        Array.from(
            topLevel,
            (name) => fs.readFile(`funcs/${name}.js`, "utf8")
        )
    )
    const output = [...topLevelFuncs, ...js].join("\n")

    console.log(output)

    return output
}
