const generateCode = (source) => {
    const topLevel = new Set()
    const token = {
        "array": token => {
            const {items, range, arg, body} = token

            if (items !== undefined) {
                return `[${genJS(items).join(", ")}]`
            }

            topLevel.add("_range")
            const {start, end, by} = range
            if (arg === undefined) {
                return `_range(${genJS(start)}, ${genJS(end)}, ${genJS(by)})`
            }

            const f = `(${arg}) => ${genJS(body)}`
            return `_range(${genJS(start)}, ${genJS(end)}, ${genJS(by)}, ${f})`
        },
        "arrayAccess": token => {
            const {target, value, optional} = token
            const op = optional ? "?." : ""

            topLevel.add("_at")

            return `_at(${genJS(target)},${genJS(value)})`
        },
        "binop": token => {
            const {left, right, op} = token

            return `${genJS(left)} ${op} ${genJS(right)}`
        },
        "call": token => {
            const {target, args, optional} = token
            const op = optional ? "?." : ""

            return `${genJS(target)}${op}(${genJS(args).join(", ")})`
        },
        "dotAccess": token => {
            const {name, target, optional} = token
            const op = optional ? "?." : "."

            return `${genJS(target)}${op}${name}`
        },
        "let": token => {
            const word = token.mutable ? "let" : "const"
            const {name, value} = token

            return `${word} ${name} = ${genJS(value)}`
        },
        "num": token => token.value.toString(),
        "null": () => "null",
        "object": token => {
            const {pairs} = token

            return `{\n${genJS(pairs).join(",\n")}\n}`
        },
        "pair": token => {
            const {key, value} = token

            const simpleKey = (
                key.type === "var"
                || (
                    key.type === "string"
                    && key.value !== undefined
                )
            )
            if(simpleKey) {
                return `${genJS(key)}: ${genJS(value)}`
            }

            const keyExpr = (key.type === "string") ? key : key.expr
            return `[${genJS(keyExpr)}]: ${genJS(value)}`
        },
        "slice": token => {
            const {target, range, optional} = token
            const {start, end} = range
            const op = optional ? "?." : "."

            return `${genJS(target)}${op}slice(${genJS(start)},${genJS(end)})`
        },
        "string": token => {
            const {parts, value} = token

            if (value !== undefined) {
                return `"${value}"`
            }

            const jsParts = parts.map(
                part => (typeof part === "string")
                    ? part
                    : `\${${genJS(part)}}`
            )

            return `\`${jsParts.join("")}\``
        },
        "var": token => token.name,
        "void": () => "undefined",
    }

    const genJS = ast => {
        if (Array.isArray(ast)) {
            return ast.map(
                tok => token[tok.type](tok)
            )
        }
        return token[ast.type](ast)
    }

    return [genJS(source), topLevel]
}

module.exports = generateCode
