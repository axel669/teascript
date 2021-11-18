const builtin = {
    bitfunc: [
        "bitor",
        "bitand",
        "bitxor",
        "bitsl",
        "bitsr",
        "bitslf",
        "bitsrf",
        "delete",
        "typeof",
    ]
}
const realOp = {
    "==": "===",
    "!=": "!==",
    "<-": "=",
}
const generateCode = (source) => {
    const topLevel = new Set()

    const argLine = (token, index) => {
        const { type, name, value } = token
        if (type === "var") {
            return `const ${name} = _args[${index}]`
        }

        if (name.type === "var") {
            return `const ${name.name} = _args[${index}] ?? ${genJS(value)}`
        }

        const array = (name.type === "arraydest")
        const def = array ? "[]" : "{}"
        const source = `const ${value.name} = _args[${index}] ?? ${def}`
        const names = genJS(name.names).join(", ")
        const des = array ? `[${names}]` : `{${names}}`
        return `${source}\nconst ${des} = ${value.name}`
    }
    const tokenf = {
        "arg": (token, pos) => {
            const argList =
                token.args
                    .map(argLine)
                    .join("\n")
            return argList
        },
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
        "arraydest": token => {
            const { names, rest } = token

            const named = genJS(names)
            const parts = rest === undefined
                ? named
                : [
                    ...named,
                    genJS(rest)
                ]

            return `[${parts.join(", ")}]`
        },
        "as": token => `${token.source}: ${token.name}`,
        "assign": token => {
            const {left, right, op, dest} = token

            if (left.type === "arrayAccess") {
                topLevel.add("_set")

                const target = genJS(left.target)
                const key = genJS(left.value)
                const value = genJS(right)
                return `_set(${target}, ${key}, ${value})`
            }

            const l = genJS(left)
            const r = genJS(right)
            if (dest === true) {
                return `;(${l} = ${r});`
            }

            return `${l} = ${r}`
        },
        "binop": token => {
            const {left, right, op} = token

            const actualOp = realOp[op] ?? op

            return `${genJS(left)} ${actualOp} ${genJS(right)}`
        },
        "bool": token => token.value.toString(),
        "call": token => {
            const {target, args, optional} = token
            const op = optional ? "?." : ""

            // console.log(
            //     target.type === "var"
            //     && builtin.bitfunc.includes(target.name)
            // )

            return `${genJS(target)}${op}(${genJS(args).join(", ")})`
        },
        "delete": token => {
            const {expr} = token

            if (expr.type === "arrayAccess") {
                const {optional, target, value} = expr
                const opt = optional ? "?." : ""
                return `delete(${genJS(target)}${opt}[${genJS(value)}])`
            }
            return `delete(${genJS(expr)})`
        },
        "do": token => {
            const {body} = token

            return `(function(){${genJS(body).join("\n")}}())`
        },
        "dotAccess": token => {
            const {name, target, optional} = token
            const op = optional ? "?." : "."

            return `${genJS(target)}${op}${name}`
        },
        "export": token => {
            const {def, expr} = token

            const mod = def ? "default " : ""
            return `export ${mod}${genJS(expr)}`
        },
        "fn": token => {
            const {name, args, body, wait, gen, short} = token
            const sync = wait ? "async " : ""
            const generate = gen ? "*" : ""
            const funcName = `${sync}function${generate} ${name ?? ""}`.trim()

            if (short === true) {
                const argList = genJS(args).join(", ")
                return `${funcName}(${argList}){return ${genJS(body)}}`
            }

            const argList = genJS(args)
            const bodyCode = genJS(body).join("\n")
            const funcBody = [argList, bodyCode].join("\n").trim()

            return `${funcName} (..._args) {\n${funcBody}\n}`
        },
        "for": token => {
            const {name, body, source, range, wait} = token

            const loopBody = genJS(body).join("\n")
            if (name === undefined) {
                return `for (;;) {\n${loopBody}\n}`
            }

            const sync = wait ? "await " : ""
            if (source !== undefined) {
                const expr = genJS(source)
                return `for ${sync}(const ${name} of ${expr}){\n${loopBody}\n}`
            }

            const {start, end, by} = range
            const init =
                [
                    `let _pos = ${genJS(start)}`,
                    `_end = ${genJS(end)}`,
                    `_start = _pos`,
                    `_inc = ${genJS(by)}`
                ]
                .join(", ")
            const cond = `(_end < _start ? _pos > _end : _pos < _end)`
            const incr = `(_end < _start ? _pos -= _inc : _pos += _inc)`

            const loopVars = `const ${name} = _pos`

            return `for (${init};${cond};${incr}) {\n${loopVars}\n${loopBody}\n}`
        },
        "if": token => {
            const {condition, body, expr} = token

            const cond = genJS(condition)

            if (expr !== undefined) {
                return `if (${cond}) {\nreturn ${genJS(expr)}\n}`
            }

            const ifBody = genJS(body).join("\n")
            return `if (${cond}) {\n${ifBody}\n}`
        },
        "import": token => token.source,
        "instance": token =>
            `(${genJS(token.expr)} instanceof ${genJS(token.target)})`,
        "let": token => {
            const word = token.mutable ? "let" : "const"
            const {name, value} = token

            return `${word} ${genJS(name)} = ${genJS(value)}`
        },
        "new": token => `new ${genJS(token.expr)}`,
        "num": token => `${token.value}${token.big ?? ""}`,
        "null": () => "null",
        "objdest": token => {
            const { names, rest } = token

            const named = genJS(names)
            const parts = rest === undefined
                ? named
                : [
                    ...named,
                    genJS(rest)
                ]

            return `{${parts.join(", ")}}`
        },
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
        "parens": token => `(${genJS(token.value)})`,
        "reactive": token => `$: ${genJS(token.expr)}`,
        "regex": token => {
            return token.def
        },
        "return": token => `return ${genJS(token.expr)}`,
        "shorthand": token => token.name,
        "slice": token => {
            const {target, range, optional} = token
            const {start, end} = range
            const op = optional ? "?." : "."

            const args = [start ?? {type: "num", value: 0}, end]
                .filter(arg => arg !== undefined)
                .map(arg => genJS(arg))
                .join(", ")

            return `${genJS(target)}${op}slice(${args})`
        },
        "spread": token => `...${genJS(token.expr)}`,
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
        "ternary": token => {
            const {condition, t, f} = token
            const cond = genJS(condition)
            const tru = genJS(t)
            const fals = genJS(f)

            return `(${cond} ? ${tru} : ${fals})`
        },
        "throw": token => `throw ${genJS(token.expr)}`,
        "try": token => {
            const {body, handle, last} = token
            const tblock = genJS(body).join("\n")
            const cblock = genJS(handle.body).join("\n")
            const fblock = last ? genJS(last).join("\n") : null

            const tryPart = `try {\n${tblock}\n}`
            const catchPart = `catch (${handle.name}) {\n${cblock}\n}`
            const finalPart = fblock ? `finally {\n${fblock}\n}` : ""

            return [tryPart, catchPart, finalPart].join("\n")
        },
        "typeof": token => `typeof(${genJS(token.expr)})`,
        "unary": token => {
            const {op, expr, func} = token

            if (func === true) {
            }

            return `${op} ${genJS(expr)}`
        },
        "var": token => token.name,
        "void": () => "undefined",
    }

    const genJS = ast => {
        if (Array.isArray(ast)) {
            return ast.map(
                (tok, pos) => tokenf[tok.type](tok, pos)
            )
        }
        return tokenf[ast.type](ast)
    }

    return [genJS(source), topLevel]
}

module.exports = generateCode
