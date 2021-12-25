#!/usr/bin/env node

const fs = require("fs-extra")
const path = require("path")

const glob = require("glob")

const compile = require("./compile.js")
const {$safe} = require("./safe.js")

const topLevelTransform = async (sources, options) => {
    const { target, browser } = options
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
const loadCode = async (info) => {
    const sourceCode = await fs.readFile(info.args[0], "utf8")
    return await compile(sourceCode, topLevelTransform, info.options)
}
const commands = {
    file: async (info) => {
        const compileResult = await $safe(loadCode, [info])
        if (compileResult instanceof Error) {
            console.error(compileResult)
            return
        }
        const {code} = compileResult
        const destFile = (info.options.compile === true)
            ? info.args[0].replace(/\.tea$/, `.${info.options.ext ?? "js"}`)
            : info.args[1]
        await fs.outputFile(destFile, code)
    },
    run: async (info) => {
        const compileResult = await $safe(loadCode, [info])
        if (compileResult instanceof Error) {
            console.error(compileResult)
            return
        }
        const [outputCode] = compileResult
        const f = new Function(outputCode)
        f()
    },
    dir: async (info) => {
        const {args, options} = info
        if (args.length === 0) {
            console.error("Need to specify input and output directories")
            return
        }
        if (args.length === 1) {
            console.error("Need to specify output directory")
            return
        }
        const root = path.resolve(args[0])
        const destRoot = path.resolve(args[1])
        const sources = glob.sync("**/*.tea", {cwd: root})
        const ext = options.ext ?? "js"

        for (const source of sources) {
            const file = path.resolve(root, source)
            const dest = path.resolve(
                destRoot,
                source.replace(/\.tea$/, `.${ext}`)
            )
            console.log(file)
            const compileArgs = {
                ...info,
                args: [file]
            }
            const compileResult = await $safe(loadCode, [compileArgs])
            if (compileResult instanceof Error) {
                console.error(compileResult)
                return
            }

            const {code} = compileResult
            await fs.outputFile(dest, code)
        }
    },
    debug: async (info) => {
        require('util').inspect.defaultOptions.depth = null

        const compileResult = await $safe(loadCode, [info])
        if (compileResult instanceof Error) {
            console.error(compileResult)
            return
        }

        const {code, ast} = compileResult
        console.log(ast)
        console.log(code)
    }
}

const parseArg = (current, arg, alias) => {
    if (arg.startsWith("-") === true) {
        const info = arg.match(/^\-(?<name>(\w|\d)+)((:|=)(?<value>.+))?$/)
        const {name, value = true} = info.groups
        const key = alias[name] ?? name
        return {
            ...current,
            options: {
                ...current.options,
                [key]: value
            }
        }
    }
    return {
        ...current,
        args:  [...current.args, arg],
    }
}
const parseArgs = (args, alias = {}) => {
    let parsed = {
        _target: args[0],
        _file: args[1],
        args: [],
        options: {}
    }

    for (const arg of args.slice(2)) {
        parsed = parseArg(parsed, arg, alias)
    }

    return parsed
}

const pargs = parseArgs(
    process.argv,
    {
        "b": "browser",
        "d": "dir",
        "c": "compile",
    }
)

const cmd = (function() {
    if (pargs.options.debug === true) {
        return "debug"
    }
    if (pargs.options.dir === true) {
        return "dir"
    }
    if (pargs.args.length === 1 && pargs.options.compile !== true) {
        return "run"
    }
    return "file"
}())

const main = async () => {
    try {
        await commands[cmd](pargs)
    }
    catch (err) {
        console.error(err)
    }
}

main()
