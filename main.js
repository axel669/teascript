const fs = require("fs")
require('util').inspect.defaultOptions.depth = null

const peggy = require("peggy")

const generateCode = require("./gen-js.js")

try {
    const parser = peggy.generate(
        fs.readFileSync("lang.peggy", "utf8")
    )

    const code = fs.readFileSync("code.tea", "utf8")
    const ast = parser.parse(code)
    console.log(ast)

    const [js, topLevel] = generateCode(ast)

    console.log(topLevel)

    const topLevelFuncs = Array.from(
        topLevel,
        (name) => fs.readFileSync(`funcs/${name}.js`)
    )
    const output = [...topLevelFuncs, ...js].join("\n")

    console.log(output)

    fs.writeFileSync("tea.js", output)
}
catch (err) {
    console.error(
        // new Error(err)
        err
    )
    if (err.location !== undefined) {
        console.log(err.location)
    }
    // throw err
    // if (err.location === undefined) {
    //     console.error(err)
    //     process.exit(0)
    // }
    // console.log(
    //     `${err.message}\nline: ${err.location.start.line}, col: ${err.location.start.column}`
    // )
}
