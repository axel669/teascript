import fs from "fs"
import path from "path"

import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"
import { entryCodeInjector } from 'rollup-plugin-entry-code-injector'

const root = path.resolve(__dirname, "..", "funcs")
const preload = fs.readdirSync(root)
    .reduce(
        (p, file) => {
            p[file.slice(0, -3)] = fs
                .readFileSync(
                    path.resolve(root, file),
                    "utf8"
                )
                //  remove the module.exports but that is used in the cli
                .replace(/^module\.exports.+$/m, "")
                .trim()
            return p
        },
        {}
    )

export default {
    input: "./browser/main.js",
    output: {
        file: "dist/browser-tea.js",
        format: "iife",
        name: "teascript"
    },
    plugins: [
        commonjs(),
        resolve(),
        entryCodeInjector({
            prepend: `const builtinFuncs = ${JSON.stringify(preload)};`
        })
    ]
}
