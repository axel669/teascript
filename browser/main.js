import compile from "../compile.js"

const topLevelTransform = async (sources, options) => {
    const { target, browser } = options
    const src = [...sources]

    if (target === "es6") {
        return src.map(
            src => `import ${src} from "@axel669/teascript/funcs/${src}.js"`
        )
    }

    if (target === "browser") {
        return src.map(
            src => builtinFuncs[src]
        )
    }

    return src.map(
        src => `const ${src} = require("@axel669/teascript/funcs/${src}.js")`
    )
}

const browserCompile = (source, options = {}) =>
    compile(source, topLevelTransform, options)

export default browserCompile
