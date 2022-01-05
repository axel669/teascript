const fs = require("fs").promises
const path = require("path")

const prettier = require("prettier")
const babelParser = require("prettier/parser-babel")

const compile = require("./compile.js")

const prettyOptions = {
    parser: "babel",
    tabWidth: 4,
    arrowParens: "always",
    semi: false,
}
const topLevelTransform = async (sources, options) => {
    const { target } = options
    const src = [...sources]

    if (target === "es6") {
        return src.map(
            src => `import ${src} from "@axel669/teascript/funcs/${src}.js"`
        )
    }

    if (target === "browser") {
        return await Promise.all(
            src.map(
                (name) => fs.readFile(
                    path.resolve(
                        __dirname,
                        `funcs/${name}.js`
                    ),
                    "utf8"
                ).then(
                    content => content.replace(/^module.+/m, "").trim()
                )
            )
        )
    }

    return src.map(
        src => `const ${src} = require("@axel669/teascript/funcs/${src}.js")`
    )
}

const teascript = (sourceCode, options) =>
    compile(
        sourceCode,
        topLevelTransform,
        {
            ...options,
            format: (code) => prettier.format(code, prettyOptions)
        }
    )

module.exports = teascript
