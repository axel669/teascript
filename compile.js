const prettier = require("prettier")

const teascript = require("./parser.js")
const generateCode = require("./grammar/gen-js.js")

const prettyOptions = {
    tabWidth: 4,
    arrowParens: "always",
    parser: "babel",
}

const topLevelTransform = async (sources, args) => {
    const {es6, browser} = args
    const src = [...sources]

    if (es6 === true) {
        return src.map(
            src => `import ${src} from "@axel669/teascript/funcs/${src}.js"`
        )
    }

    if (browser !== true) {
        return src.map(
            src => `const ${src} = require("@axel669/teascript/funcs/${src}.js")`
        )
    }

    return await Promise.all(
        src.map(
            (name) => fs.readFile(
                path.resolve(
                    __dirname,
                    `funcs/${name}.js`
                ),
                "utf8"
            )
        )
    )
}
const compile = async (sourceCode, args = {}) => {
    const ast = teascript.parse(sourceCode)
    const [js, topLevel] = generateCode(ast)

    const topLevelFuncs = await topLevelTransform(topLevel, args)
    const output = [...topLevelFuncs, ...js].join("\n")

    return [prettier.format(output, prettyOptions), ast]
}

module.exports = compile
