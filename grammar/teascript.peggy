{
    const tok = (type) =>
        (source) => ({type, ...source})
    const tokenTypes = [
        "arg",
        "array",
        "arrayAccess",
        "arraydest",
        "as",
        "assign",
        "between",
        "bool",
        "binop",
        "call",
        "computedKey",
        "delete",
        "do",
        "dotAccess",
        "export",
        "fn",
        "for",
        "if",
        "import",
        "instance",
        "let",
        "new",
        "num",
        "null",
        "objdest",
        "object",
        "pair",
        "parens",
        "range",
        "reactive",
        "regex",
        "return",
        "shorthand",
        "slice",
        "spread",
        "string",
        "ternary",
        "throw",
        "try",
        "typeof",
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

Program "top level"
    = _ expr:(Reactive / Statement) tail:(_l (Reactive / Statement))* _ {
        return [
            expr,
            ...tail.map(i => i[1])
        ]
    }
    / _ {
        return []
    }
Exprs "expression group"
    = expr:Statement tail:(_l Statement)* {
        return [
            expr,
            ...tail.map(i => i[1])
        ]
    }

Statement "statement"
    = Return
    / If
    / For
    / VariableDecl
    / Throw
    / Try
    / Import
    / Export
    / Assignment
    / Delete
    / Expr

Expr "expression"
    = Regex
    / New
    / FunctionDecl
    / Logical
    / Compare
    / Math
    / StatusOp
    // / Pipeline
    / Unary
    / Ternary
    / NullCoalesce
    / Boolean
    / BottomValue
    / Do
    / Identifier
    / String
    / Number
    / Object
    / Array
    / Parens

ComparableValue
    = Math
    / Number
    / Boolean
    / BottomValue
    / Unary
    / StatusOp
    / Identifier
    / String
    / Parens

MathValue
    = Number
    / Identifier
    / MathUnary
    / Parens

Reactive
    = "$:" __s expr:Statement {
        return token.reactive({expr})
    }

StatusOp
    = "typeof" "{" _ expr:Expr _ "}" {
        return token.typeof({expr})
    }
    / "instance" "<" target:Identifier ">" "{" _ expr:Expr _ "}" {
        return token.instance({expr, target})
    }
Delete
    = "delete" "{" _ expr:Expr _ "}" {
        return token.delete({expr})
    }

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

// Pipeline
//     = "(" _ expr:Expr

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
    = "?" "(" _ condition:Expr _ ")" __ t:TrueCase {
        return token.ternary({
            condition,
            t,
            f: token.null(),
        })
    }
    / "?" "(" _ condition:Expr _ ")" __ f:FalseCase {
        return token.ternary({
            condition,
            f,
            t: token.null(),
        })
    }
    / "?" "(" _ condition:Expr _ ")" __ t:TrueCase __ f:FalseCase {
        return token.ternary({condition, t, f})
    }
    / "?" "(" _ condition:Expr _ ")" __ f:FalseCase __ t:TrueCase {
        return token.ternary({condition, t, f})
    }
TrueCase
    = "=" __s value:Expr {return value}
FalseCase
    = ":" __s value:Expr {return value}

NullCoalesce
    = "??" "(" _ left:Expr __ ":" __ right:Expr _ ")" {
        return token.binop({
            left,
            right,
            op: "??",
        })
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
    = source:$("import" __s Word (_ "," __s Destruct)? __s "from" __s String) {
        return token.import({source})
    }
    / source:$("import" __s Destruct __s "from" __s String) {
        return token.import({source})
    }
    / source:$("import" __s String) {
        return token.import({source})
    }
    / source:$("import" __s "*" __s "as" __s Word __s "from" __s String) {
        return token.import({source})
    }

Export
    = "export" __s expr:(VariableDecl / FunctionDecl / Object) {
        return token.export({expr})
    }
    / "export" __s "default" __s expr:Expr {
        return token.export({
            def: true,
            expr,
        })
    }

VariableCreation
    = name:Var __s ("=" / "<-") __s value:Expr {
        return {name, value}
    }
    / value:Expr __ "->" __s name:(ObjDest / ArrayDest) {
        return {name, value}
    }

VariableDecl "variable declaration"
    = "let" __s mut:("mut" __s)? info:VariableCreation {
        return token.let({
            ...info,
            mutable: mut !== null,
        })
    }

Destruct
    = "{" _ head:(As / Var) tail:(_i (As / Var))* rest:(_i Spread)? _ "}" {
        const names = list(head, tail, 1)
        return token.objdest({
            names,
            rest: rest?.[1]
        })
    }
As
    = source:Word __s "as" __s name:Word {
        return token.as({source, name})
    }
ObjDest
    = "{" _ head:ObjDestructEntry tail:(_i ObjDestructEntry)* rest:(_i Spread)? _ "}" {
        const names = list(head, tail, 1)
        return token.objdest({
            names,
            rest: rest?.[1]
        })
    }
ObjDestructEntry
    = left:As __s op:("=" / "<-") __s right:Expr {
        return token.assign({left, right, op})
    }
    / left:Var __s op:("=" / "<-") __s right:Expr {
        return token.assign({left, right, op})
    }
    / As
    / Var

ArrayDest
    = "[" _ head:ArrayDestructEntry tail:(_i ArrayDestructEntry)* rest:(_i Spread)? _ "]" {
        const names = list(head, tail, 1)
        return token.arraydest({
            names,
            rest: rest?.[1]
        })
    }
ArrayDestructEntry
    = left:Var __s op:"=" __s right:Expr {
        return token.assign({left, right, op})
    }
    / Var

FunctionDecl "function declaration"
    = wait:("async" __s)? "fn" gen:"*"? __ name:(Word __)? "{" args:ArgList? lines:(_l Exprs)? __ "}" {
        return token.fn({
            args: args ?? [],
            name: name?.[0],
            body: lines?.[1] ?? [],
            wait: wait !== null,
            gen: gen !== null,
        })
    }
    / wait:("async" __s)? "fn" gen:"*"? args:ShortArgList? __ "=>" __ body:Expr {
        return token.fn({
            short: true,
            args: args ?? [],
            body,
            wait: wait !== null,
            gen: gen !== null,
        })
    }

ArgList
    = args:(_l "@" (VariableCreation / Var))+ {
        return token.arg({
            args: args.map(arg => arg[2])
        })
    }
ShortArgList
    = "{" _ head:Var tail:("," _ Var)* _ "}" {
        return list(head, tail, 2)
    }

Do
    = "do" __s "{" _ body:Exprs _ "}" {
        return token.do({body})
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
    = head:(Pair / Spread / Shorthand) tail:(_i (Pair / Spread / Shorthand))* {
        return list(head, tail, 1)
    }
Pair
    = key:PairKey __s value: Expr {
        return token.pair({key, value})
    }
PairKey
    = ":" name:Var {
        return name
    }
    / ":" name:(String / ComputedKey) {
        return name
    }
ComputedKey
    = ":(" _ expr:Expr _ ")" {
        return token.computedKey({expr})
    }

Spread
    = "..." expr:Expr {
        return token.spread({expr})
    }

Shorthand
    = "." name:Word {
        return token.shorthand({name})
    }

AssignmentOp
    = "="
    / "<-"
    // / "+=" / "-="
    // / "*=" / "/=" / "%="
    // / "**="
    // / "<<=" / ">>="
    // / "<<<=" / ">>>="
Assignment
    = left:LValue __s op:AssignmentOp __s right:Expr {
        return token.assign({left, right, op})
    }
    / left:(ArrayDest / ObjDest) __s op:("=" / "<-") __s right:Expr {
        return token.assign({
            dest:true,
            left,
            right,
            op,
        })
    }
LValue "lvalue"
    = head:Var tail:LValueAccess* {
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
    = head:(Array / Var / String) tail:IdentifierAccess+ {
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
    / optional:"?"? "[" _ range:SliceRange _ "]" {
        return {
            type: token.slice,
            item: {
                range,
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
Args
    = pos:PositionalArgs _i named:NamedArgs {
        return [...pos, named]
    }
    / named:NamedArgs {
        return [named]
    }
    / PositionalArgs
PositionalArgs
    = head:(Expr / Spread) tail:(_i (Expr / Spread))* {
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
    / ":" key:Word {
        return token.var({name: key})
    }

New
    = "&" expr:Expr {
        return token.new({expr})
    }

Number "number"
    = num:$("-"? Digit+) "n" {
        return token.num({
            value: BigInt(num),
            big: "n",
        })
    }
    / num:$("-"? Digit+ ("." Digit+)? ("e" ("+" / "-")? Digit+)?) {
        return token.num({
            value: parseFloat(num, 10)
        })
    }
    / "0x" num:$(Hex+) {
        return token.num({
            value: parseInt(num, 16)
        })
    }
    / "0b" num:$(("0" / "1")+) {
        return token.num({
            value: parseInt(num, 2)
        })
    }
String "string"
    = value:$('""') {
        return token.string({value: ""})
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
    = start:Expr __ "->" __ end:Expr inc:(__ "by" __ Expr)? {
        return token.range({
            start,
            end,
            by: inc ? inc[3] : token.num({value: 1})
        })
    }
SliceRange
    = start:Expr __ "->" __ end:Expr {
        return token.range({
            start,
            end,
        })
    }
    / start:Expr __ "->" {
        return token.range({
            start,
        })
    }
    / "->" __ end:Expr {
        return token.range({
            end,
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
    = $([a-zA-Z\$] [a-zA-Z0-9_\$]*)

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