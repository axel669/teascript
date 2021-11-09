{
    const tok = (type) =>
        (source) => ({type, ...source})
    const tokenTypes = [
        "arg",
        "array",
        "arrayAccess",
        "arraydest",
        "between",
        "bool",
        "binop",
        "call",
        "computedKey",
        "dotAccess",
        "fn",
        "for",
        "if",
        "import",
        "let",
        "new",
        "num",
        "null",
        "objdest",
        "object",
        "pair",
        "parens",
        "range",
        "regex",
        "return",
        "slice",
        "spread",
        "string",
        "ternary",
        "throw",
        "try",
        "unary",
        "var",
        "void",
    ]
    const binOp = (head, tail) => tail.reduce(
        (left, next) => token.binop({
            left,
            op: next[1],
            right: next[3]
        }),
        head
    )
    const list = (head, tail, n) => tail.reduce(
        (list, item) => [...list, item[n]],
        [head]
    )
    const token = tokenTypes.reduce(
        (toks, type) => {
            toks[type] = tok(type)
            return toks
        },
        {}
    )
}

Program "program"
    = _ exprs:Exprs? _l?
        {return exprs ?? []}
Exprs "expression group"
    = expr:Instruction tail:(_l Instruction)* {
        return [
            expr,
            ...tail.map(i => i[1])
        ]
    }

Instruction "instruction"
    = Return
    / If
    / For
    / VariableDecl
    / Throw
    / Try
    / Import
    / Expr

Expr "expression"
    = String
    / Regex
    / New
    / FunctionDecl
    / Logical
    / Compare
    / Math
    / Unary
    / Ternary
    / Boolean
    / BottomValue
    / Identifier
    / Number
    / Object
    / Array
    / Parens

ComparableValue
    = Math
    / Number
    / String
    / Boolean
    / BottomValue
    / Unary
    / Identifier
    / Parens

MathValue
    = Number
    / Identifier
    / MathUnary
    / Parens

BinaryNumberOp
    = ">>>" / "<<<"
    / ">>" / "<<"
    / "**"
    / "/" / "*" / "%"
    / "-" / "+"
    / "|" / "^"
Math "math operation"
    = head:MathValue tail:(__ BinaryNumberOp __ MathValue)+ {
        const uniqOps = new Set(
            tail.map(t => t[1])
        )
        if (uniqOps.size > 1) {
            error("Cannot mix operators without using parens '()' to group")
        }
        return binOp(head, tail)
    }

ComapreOp
    = ">=" / "<="
    / "==" / "!="
    / ">" / "<"
Compare
    = left:ComparableValue _s op:ComapreOp _s right:ComparableValue {
        return token.binop({
            left,
            op,
            right,
        })
    }

Logical
    = head:(Compare / Parens) tail:(__ ("&&" / "||") __ (Compare / Parens))+ {
        const uniqOps = new Set(
            tail.map(t => t[1])
        )
        if (uniqOps.size > 1) {
            error("Cannot mix operators without using parens '()' to group")
        }
        return binOp(head, tail)
    }

Parens
    = "(" _ value:Expr _ ")" {
        return token.parens({value})
    }

Unary
    = op:("!" / "~") "(" _ expr:Expr _ ")" {
        return token.unary({op, expr, func: true})
    }
    / MathUnary
MathUnary
    = op:"-" "(" _ expr:Expr _ ")" {
        return token.unary({op, expr, func: true})
    }
    / op:("await" / "yield") __s expr:Expr {
        return token.unary({op, expr})
    }

Ternary
    = "?" "(" condition:Expr _l t:Expr _l f:Expr _ ")" {
        return token.ternary({condition, t, f})
    }

Throw
    = "throw" __s expr:Expr {
        return token.throw({expr})
    }

Try
    = "try" __s "{" _l body:Exprs _l handle:Catch _l last:(Finally _l)? "}" {
        return token.try({
            body,
            handle,
            last: last?.[0],
        })
    }
Catch
    = "@catch" __s name:Word __s "{" _l body:Exprs _l "}" {
        return {
            name,
            body,
        }
    }
Finally
    = "@finally" __s "{" _l body:Exprs _l "}" {
        return body
    }

Import
    = source:$("import" __s Word __s "from" __ String) {
        return token.import({source})
    }
    / source:$("import" __s String) {
        return token.import({source})
    }
    / source:$("import" __s "*" __s "as" __s Word __s "from" __s String) {
        return token.import({source})
    }

VariableDecl "variable declaration"
    = "let" __s mut:("mut" __s)? name:Var __s "=" __s value:Expr {
        return token.let({
            name,
            value,
            mutable: mut !== null,
        })
    }
    / "let" __s mut:("mut" __s)? value:Expr __ "->" __s name:(ObjDest / ArrayDest) {
        return token.let({
            name,
            value,
            mutable: mut !== null,
        })
    }

ObjDest
    = "{" _ head:Word tail:(_i Word)* rest:(_i Spread)? _ "}" {
        const names = list(head, tail, 1)
        return token.objdest({
            names,
            rest: rest?.[1]
        })
    }
ArrayDest
    = "[" _ head:Word tail:(_i Word)* rest:(_i Spread)? _ "]" {
        const names = list(head, tail, 1)
        return token.arraydest({
            names,
            rest: rest?.[1]
        })
    }

FunctionDecl "function declaration"
    = wait:("async" __s)? "fn" gen:"*"? __ name:(Word __)? "{" args:(_l ArgList)? lines:(_l Exprs)? __ "}" {
        return token.fn({
            name: name?.[0],
            args: args?.[1] ?? [],
            body: lines?.[1] ?? [],
            wait: wait !== null,
            gen: gen !== null,
        })
    }
    / wait:("async" __s)? "fn" gen:"*"? __ arg:Word __ "=>" __ body:Expr {
        return token.fn({
            arg,
            body,
            wait: wait !== null,
            gen: gen !== null,
        })
    }
ArgList
    = "args" __s wat:ArgDest {
        return wat
    }
ArgDest
    = "{" _l head:ArgDef tail:(_l ArgDef)* _l "}" {
        const names = list(head, tail, 1)
        return names
    }
ArgDef
    = name:Word names:(__s "{" WordList _l "}")? {
        return token.arg({
            name,
            names: names?.[2]
        })
    }
    / "{" names:WordList _l "}" {
        return token.arg({
            name: null,
            names
        })
    }
WordList
    = list:(_l Word)+ {
        return list.map(item => item[1])
    }
Return
    = ("return" / "=>") __s expr:Expr {
        return token.return({expr})
    }
    / ("return" / "=>") {
        return token.return({})
    }

If
    = "if" __s condition:(Logical / Compare) _s "{" __ body:Exprs __ "}" {
        return token.if({
            condition,
            body,
        })
    }
    / "if" __s condition:(Logical / Compare) _l "=>" __ expr:Expr {
        return token.if({
            condition,
            expr,
        })
    }

For
    = "for" wait:(__s "await")? __s name:Word __s ":" __s range:Range __s "{" __ body:Exprs __ "}" {
        return token.for({
            name,
            range,
            body,
            wait: wait !== null
        })
    }
    / "for" wait:(__s "await")? __s name:Word __s ":" __s source:Expr __s "{" __ body:Exprs __ "}" {
        return token.for({
            name,
            source,
            body,
            wait: wait !== null
        })
    }
    / "for" __s "ever" __s "{" __ body:Exprs __ "}" {
        return token.for({body})
    }

Array
    = "[" _ "]" {
        return token.array({
            items: []
        })
    }
    / "[" _ head:(Expr / Spread) tail:(_i (Expr / Spread))* _ "]" {
        return token.array({
            items: list(head, tail, 1)
        })
    }
    / "[" range:Range "]" {
        return token.array({
            range
        })
    }
    / "[" body:Expr __s "from" __s arg:Word __s ":" __s range:Range "]" {
        return token.array({
            range,
            arg,
            body
        })
    }

Object
    = "{" _ "}" {
        return token.object({pairs: []})
    }
    / "{" _ pairs:Pairs _ "}" {
        return token.object({pairs})
    }
Pairs
    = head:(Pair / Spread) tail:(_i (Pair / Spread))* {
        return list(head, tail, 1)
    }
Pair
    = key:PairKey __s value: Expr {
        return token.pair({key, value})
    }
PairKey
    = Var
    / name:(String / ComputedKey) {
        return name
    }
ComputedKey
    = "$(" _ expr:Expr _ ")" {
        return token.computedKey({expr})
    }

Spread
    = "..." expr:Expr {
        return token.spread({expr})
    }

LValue "lvalue"
    = head:Var tail:LValueAccess* {
        // const tok = token.var({name: head})
        if (tail === null) {
            return head
        }

        return tail.reduce(
            (target, next) => next.type({
                target,
                ...next.item
            }),
            head
        )
    }
LValueAccess
    = _ "." name:Word {
        return {
            type: token.dotAccess,
            item: {
                name,
                optional: false,
            }
        }
    }
    / "[" _ value:Expr _ "]" {
        return {
            type: token.arrayAccess,
            item: {
                value,
                optional: false,
            }
        }
    }

Identifier "identifier"
    = head:(Parens / Array / Var) tail:IdentifierAccess+ {
        return tail.reduce(
            (target, next) => next.type({
                target,
                ...next.item
            }),
            head
        )
    }
    / Var
IdentifierAccess
    = _ optional:"?"? "." name:Word {
        return {
            type: token.dotAccess,
            item: {
                name,
                optional: optional !== null,
            }
        }
    }
    / optional:"?"? "[" _ value:Expr _ "]" {
        return {
            type: token.arrayAccess,
            item: {
                value,
                optional: optional !== null,
            }
        }
    }
    / optional:"?"? "(" _ args:Args? _ ")" {
        return {
            type: token.call,
            item: {
                args: args ?? [],
                optional: optional !== null,
            }
        }
    }
    / optional:"?"? "[" range:Range "]" {
        return {
            type: token.slice,
            item: {
                range,
                optional: optional !== null,
            }
        }
    }
Args
    = pos:PositionalArgs _i named:NamedArgs {
        return [...pos, named]
    }
    / named:NamedArgs {
        return [named]
    }
    / PositionalArgs
PositionalArgs
    = head:Expr tail:(_i Expr)* {
        return list(head, tail, 1)
    }
NamedArgs
    = head:NamedArg tail:(_i NamedArg)* {
        return token.object({
            pairs: list(head, tail, 1)
        })
    }
NamedArg
    = ":" key:Word _s value:Expr {
        return token.pair({
            key: token.var({name: key}),
            value
        })
    }

New
    = "&" expr:Expr {
        return token.new({expr})
    }

Number "number"
    = num:$("-"? Digit+) {
        return token.num({
            value: parseInt(num, 10)
        })
    }
    / num:$("-"? Digit+ "." Digit+)
String "string"
    = value:$('""') {
        return token.string({value})
    }
    / '"' parts:(Interpolation / StringPart)+ '"' {
        if (parts.length === 1 && typeof(parts[0]) === "string") {
            return token.string({
                value: parts[0]
            })
        }
        return token.string({parts})
    }
Interpolation
    = "{" _ expr:Expr _ "}" {
        return expr
    }
StringPart
    = part:$(EscapeSeq / [^"\{])+ {
        return part
            .replace(/\x7b(\x7b)/g, "$1")
            .replace(/\x7d(\x7d)/g, "$1")
            .replace(/(\$\x7b)/g, "\\$1")
    }
EscapeSeq
    = "\\" ("u" Hex Hex Hex Hex)
    / "\\" ("u" Hex? Hex? Hex?) {
        error("Invalid unicode escape sequence")
    }
    / "\\" .
    / "{{"
    / "}}"

Regex
    = def:$("/" (EscapeSeq / [^\\/])+ "/" [a-z]*) {
        return token.regex({def})
    }

Range
    = start:Expr _ "->" _ end:Expr inc:(__ "by" __ Expr)? {
        return token.range({
            start,
            end,
            by: inc ? inc[3] : token.num({value: 1})
        })
    }

Boolean
    = value:("true" / "false") {
        return token.bool({value})
    }
BottomValue
    = "null" {return token.null()}
    / "void" {return token.void()}

Var
    = name:Word {
        return token.var({name})
    }

Comment
    = $("/*" (!"*/" .)* "*/")
    / $("//" (!"\n" .)*)

Word
    = $([a-zA-Z] [a-zA-Z0-9_\$]*)

Hex "hex"
    = [a-fA-F0-9]
Digit "decimal"
    = [0-9]

_i "item separator"
    = "," _
    / _l

__ "whitespace"
    = ([ \t\n\r]+ / Comment)+
_ "whitespace"
    = ([ \t\n\r]+ / Comment)*
_s "space"
    = [ \t]* Comment?
__s "required space"
    = [ \t]+ Comment?
_l "newline"
    = (_s ([\n\r]+ / Comment)+ _s)+
