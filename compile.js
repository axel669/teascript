const fs = require("fs-extra")
const path = require("path")
const prettier = require("prettier")

const teascript = require("./parser.js")
const generateCode = require("./grammar/gen-js.js")

const {_safe, $safe} = require("./safe.js")

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
            ).then(
                content => content.replace(/^module.+/m, "").trim()
            )
        )
    )
}

const pmax = (a, b) => {
    if (a === null) {
        return b
    }
    if (a.location.start.offset < b.location.start.offset) {
        return b
    }
    return a
}
const nth = (source, find, n) => {
    if (n <= 0) {
        return 0
    }
    let last = 0
    let count = 0

    for (; ;) {
        const next = source.indexOf(find, last)

        if (next === -1) {
            return -1
        }

        count += 1
        if (count === n) {
            return next
        }

        last = next + find.length
    }
}

const formatError = (last, err, sourceCode) => {
    const { line, column } = last.location.start
    const start = nth(sourceCode, "\n", line - 2)
    const end = nth(sourceCode, "\n", line)

    const snippet =
        sourceCode
            .slice(start, end)
            .replace(/^\r?\n|\r?\n?$/g, "")
    const pointer = `${"-".repeat(column - 1)}^`
    const loc = `line ${line}, col ${column}`

    return `${err.message}\n${loc}\n${snippet}\n${pointer}`
}
const errorWith = (err, info) => {
    err.info = info
    return err
}

const compile = async (sourceCode, args = {}) => {
    let last = null
    const tracer = {
        trace: evt => {
            if (evt.type !== "rule.fail") {
                return
            }
            last = pmax(last, evt)
        }
    }
    const ast = _safe(teascript.parse, [sourceCode, { tracer }])
    if (ast instanceof Error) {
        const err = new Error(
            formatError(last, ast, sourceCode)
        )
        return err
    }

    const compiledCode = await $safe(generateCode, [ast])
    if (compiledCode instanceof Error) {
        return errorWith(compiledCode, ast)
    }
    const [js, topLevel] = compiledCode

    const topLevelFuncs = await topLevelTransform(topLevel, args)
    const output = [...topLevelFuncs, ...js].join("\n")

    return [prettier.format(output, prettyOptions), ast]
}

module.exports = compile
