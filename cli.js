#!/usr/bin/env node

const fs = require("fs-extra")
const path = require("path")

const glob = require("glob")

const compile = require("./compile.js")

const loadCode = async (args) => {
    const sourceCode = await fs.readFile(args.source, "utf8")
    return await compile(sourceCode, args)
}
const commands = {
    file: async (args) => {
        const [outputCode] = await loadCode(args)
        await fs.outputFile(args.dest, outputCode)
    },
    run: async (args) => {
        const [outputCode] = await loadCode(args)
        const f = new Function(outputCode)
        f()
    },
    dir: async (args) => {
        const root = path.resolve(args.source)
        const destRoot = path.resolve(args.dest)
        const sources = glob.sync("**/*.tea", {cwd: root})
        const ext = args.ext ?? ".js"

        for (const source of sources) {
            const file = path.resolve(root, source)
            const dest = path.resolve(
                destRoot,
                source.replace(/\.tea$/, ext)
            )
            console.log(file)
            const [code] = await loadCode({
                ...args,
                source: file,
            })
            await fs.outputFile(dest, code)
        }
    },
    debug: async (args) => {
        const [code, ast] = await loadCode(args)
        require('util').inspect.defaultOptions.depth = null
        console.log(ast)
        console.log(code)
    }
}

const parseArgs = (args, alias = {}) => {
    const parsed = {}

    parsed._target = args[0]
    parsed._file = args[1]

    for (const arg of args.slice(2)) {
        const info = arg.match(/^\-(?<name>(\w|\d)+)((:|=)(?<value>.+))?$/)
        const {name, value} = info.groups
        const key = alias[name] ?? name
        parsed[key] = value ?? true
    }

    return parsed
}

const pargs = parseArgs(
    process.argv,
    {
        "src": "source",
        "b": "browser",
        "d": "dir",
    }
)

const cmd = (function() {
    if (pargs.debug === true) {
        return "debug"
    }
    if (pargs.dest === undefined) {
        return "run"
    }
    if (pargs.dir === true) {
        return "dir"
    }
    return "file"
}())

commands[cmd](pargs)
