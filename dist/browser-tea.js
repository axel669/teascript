var teascript = (function () {
  'use strict';

  function peg$subclass(child, parent) {
    function C() { this.constructor = child; }
    C.prototype = parent.prototype;
    child.prototype = new C();
  }

  function peg$SyntaxError(message, expected, found, location) {
    var self = Error.call(this, message);
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(self, peg$SyntaxError.prototype);
    }
    self.expected = expected;
    self.found = found;
    self.location = location;
    self.name = "SyntaxError";
    return self;
  }

  peg$subclass(peg$SyntaxError, Error);

  function peg$padEnd(str, targetLength, padString) {
    padString = padString || " ";
    if (str.length > targetLength) { return str; }
    targetLength -= str.length;
    padString += padString.repeat(targetLength);
    return str + padString.slice(0, targetLength);
  }

  peg$SyntaxError.prototype.format = function(sources) {
    var str = "Error: " + this.message;
    if (this.location) {
      var src = null;
      var k;
      for (k = 0; k < sources.length; k++) {
        if (sources[k].source === this.location.source) {
          src = sources[k].text.split(/\r\n|\n|\r/g);
          break;
        }
      }
      var s = this.location.start;
      var loc = this.location.source + ":" + s.line + ":" + s.column;
      if (src) {
        var e = this.location.end;
        var filler = peg$padEnd("", s.line.toString().length);
        var line = src[s.line - 1];
        var last = s.line === e.line ? e.column : line.length + 1;
        str += "\n --> " + loc + "\n"
            + filler + " |\n"
            + s.line + " | " + line + "\n"
            + filler + " | " + peg$padEnd("", s.column - 1)
            + peg$padEnd("", last - s.column, "^");
      } else {
        str += "\n at " + loc;
      }
    }
    return str;
  };

  peg$SyntaxError.buildMessage = function(expected, found) {
    var DESCRIBE_EXPECTATION_FNS = {
      literal: function(expectation) {
        return "\"" + literalEscape(expectation.text) + "\"";
      },

      class: function(expectation) {
        var escapedParts = expectation.parts.map(function(part) {
          return Array.isArray(part)
            ? classEscape(part[0]) + "-" + classEscape(part[1])
            : classEscape(part);
        });

        return "[" + (expectation.inverted ? "^" : "") + escapedParts + "]";
      },

      any: function() {
        return "any character";
      },

      end: function() {
        return "end of input";
      },

      other: function(expectation) {
        return expectation.description;
      }
    };

    function hex(ch) {
      return ch.charCodeAt(0).toString(16).toUpperCase();
    }

    function literalEscape(s) {
      return s
        .replace(/\\/g, "\\\\")
        .replace(/"/g,  "\\\"")
        .replace(/\0/g, "\\0")
        .replace(/\t/g, "\\t")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/[\x00-\x0F]/g,          function(ch) { return "\\x0" + hex(ch); })
        .replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) { return "\\x"  + hex(ch); });
    }

    function classEscape(s) {
      return s
        .replace(/\\/g, "\\\\")
        .replace(/\]/g, "\\]")
        .replace(/\^/g, "\\^")
        .replace(/-/g,  "\\-")
        .replace(/\0/g, "\\0")
        .replace(/\t/g, "\\t")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/[\x00-\x0F]/g,          function(ch) { return "\\x0" + hex(ch); })
        .replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) { return "\\x"  + hex(ch); });
    }

    function describeExpectation(expectation) {
      return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);
    }

    function describeExpected(expected) {
      var descriptions = expected.map(describeExpectation);
      var i, j;

      descriptions.sort();

      if (descriptions.length > 0) {
        for (i = 1, j = 1; i < descriptions.length; i++) {
          if (descriptions[i - 1] !== descriptions[i]) {
            descriptions[j] = descriptions[i];
            j++;
          }
        }
        descriptions.length = j;
      }

      switch (descriptions.length) {
        case 1:
          return descriptions[0];

        case 2:
          return descriptions[0] + " or " + descriptions[1];

        default:
          return descriptions.slice(0, -1).join(", ")
            + ", or "
            + descriptions[descriptions.length - 1];
      }
    }

    function describeFound(found) {
      return found ? "\"" + literalEscape(found) + "\"" : "end of input";
    }

    return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
  };

  function peg$DefaultTracer() {
    this.indentLevel = 0;
  }

  peg$DefaultTracer.prototype.trace = function(event) {
    var that = this;

    function log(event) {
      function repeat(string, n) {
         var result = "", i;

         for (i = 0; i < n; i++) {
           result += string;
         }

         return result;
      }

      function pad(string, length) {
        return string + repeat(" ", length - string.length);
      }

      if (typeof console === "object") {
        console.log(
          event.location.start.line + ":" + event.location.start.column + "-"
            + event.location.end.line + ":" + event.location.end.column + " "
            + pad(event.type, 10) + " "
            + repeat("  ", that.indentLevel) + event.rule
        );
      }
    }

    switch (event.type) {
      case "rule.enter":
        log(event);
        this.indentLevel++;
        break;

      case "rule.match":
        this.indentLevel--;
        log(event);
        break;

      case "rule.fail":
        this.indentLevel--;
        log(event);
        break;

      default:
        throw new Error("Invalid event type: " + event.type + ".");
    }
  };

  function peg$parse(input, options) {
    options = options !== undefined ? options : {};

    var peg$FAILED = {};
    var peg$source = options.grammarSource;

    var peg$startRuleFunctions = { Program: peg$parseProgram };
    var peg$startRuleFunction = peg$parseProgram;

    var peg$c0 = "debugger";
    var peg$c1 = "$:";
    var peg$c2 = "typeof";
    var peg$c3 = "{";
    var peg$c4 = "}";
    var peg$c5 = "instance";
    var peg$c6 = "<";
    var peg$c7 = ">";
    var peg$c8 = "delete";
    var peg$c9 = ">>>";
    var peg$c10 = "<<<";
    var peg$c11 = ">>";
    var peg$c12 = "<<";
    var peg$c13 = "**";
    var peg$c14 = "/";
    var peg$c15 = "*";
    var peg$c16 = "%";
    var peg$c17 = "-";
    var peg$c18 = "+";
    var peg$c19 = "|";
    var peg$c20 = "^";
    var peg$c21 = "&";
    var peg$c22 = ">=";
    var peg$c23 = "<=";
    var peg$c24 = "==";
    var peg$c25 = "!=";
    var peg$c26 = "&&";
    var peg$c27 = "||";
    var peg$c28 = "|>";
    var peg$c29 = "(";
    var peg$c30 = ":";
    var peg$c31 = ")";
    var peg$c32 = "!";
    var peg$c33 = "~";
    var peg$c34 = "await";
    var peg$c35 = ".";
    var peg$c36 = "allSettled";
    var peg$c37 = "all";
    var peg$c38 = "race";
    var peg$c39 = "any";
    var peg$c40 = "yield";
    var peg$c41 = "?";
    var peg$c42 = "=";
    var peg$c43 = "??";
    var peg$c44 = "throw";
    var peg$c45 = "safeguard";
    var peg$c46 = "safeguard^";
    var peg$c47 = "try";
    var peg$c48 = "@catch";
    var peg$c49 = "@finally";
    var peg$c50 = "import";
    var peg$c51 = ",";
    var peg$c52 = "from";
    var peg$c53 = "as";
    var peg$c54 = "export";
    var peg$c55 = "default";
    var peg$c56 = "<+";
    var peg$c57 = "+>";
    var peg$c58 = "let";
    var peg$c59 = "mut";
    var peg$c60 = "[";
    var peg$c61 = "]";
    var peg$c62 = "async";
    var peg$c63 = "fn";
    var peg$c64 = "=>";
    var peg$c65 = "@";
    var peg$c66 = "do";
    var peg$c67 = "if";
    var peg$c68 = "guard";
    var peg$c69 = "for";
    var peg$c70 = "ever";
    var peg$c71 = ":(";
    var peg$c72 = "...";
    var peg$c73 = "`";
    var peg$c74 = "n";
    var peg$c75 = "e";
    var peg$c76 = "0x";
    var peg$c77 = "0b";
    var peg$c78 = "0";
    var peg$c79 = "1";
    var peg$c80 = "\"\"";
    var peg$c81 = "\"";
    var peg$c82 = "\\#";
    var peg$c83 = "\\";
    var peg$c84 = "u";
    var peg$c85 = "#{";
    var peg$c86 = "#";
    var peg$c87 = "->";
    var peg$c88 = "by";
    var peg$c89 = "true";
    var peg$c90 = "false";
    var peg$c91 = "null";
    var peg$c92 = "void";
    var peg$c93 = "###";
    var peg$c94 = "\n";
    var peg$c95 = "\r";

    var peg$r0 = /^[^"\\#]/;
    var peg$r1 = /^[^\\\/]/;
    var peg$r2 = /^[a-z]/;
    var peg$r3 = /^[a-zA-Z$]/;
    var peg$r4 = /^[a-zA-Z0-9_$]/;
    var peg$r5 = /^[a-fA-F0-9]/;
    var peg$r6 = /^[0-9]/;
    var peg$r7 = /^[ \t\n\r]/;
    var peg$r8 = /^[ \t]/;
    var peg$r9 = /^[\n\r]/;

    var peg$e0 = peg$otherExpectation("top level");
    var peg$e1 = peg$otherExpectation("expression group");
    var peg$e2 = peg$otherExpectation("statement");
    var peg$e3 = peg$otherExpectation("expression");
    var peg$e4 = peg$literalExpectation("debugger", false);
    var peg$e5 = peg$literalExpectation("$:", false);
    var peg$e6 = peg$literalExpectation("typeof", false);
    var peg$e7 = peg$literalExpectation("{", false);
    var peg$e8 = peg$literalExpectation("}", false);
    var peg$e9 = peg$literalExpectation("instance", false);
    var peg$e10 = peg$literalExpectation("<", false);
    var peg$e11 = peg$literalExpectation(">", false);
    var peg$e12 = peg$literalExpectation("delete", false);
    var peg$e13 = peg$literalExpectation(">>>", false);
    var peg$e14 = peg$literalExpectation("<<<", false);
    var peg$e15 = peg$literalExpectation(">>", false);
    var peg$e16 = peg$literalExpectation("<<", false);
    var peg$e17 = peg$literalExpectation("**", false);
    var peg$e18 = peg$literalExpectation("/", false);
    var peg$e19 = peg$literalExpectation("*", false);
    var peg$e20 = peg$literalExpectation("%", false);
    var peg$e21 = peg$literalExpectation("-", false);
    var peg$e22 = peg$literalExpectation("+", false);
    var peg$e23 = peg$literalExpectation("|", false);
    var peg$e24 = peg$literalExpectation("^", false);
    var peg$e25 = peg$literalExpectation("&", false);
    var peg$e26 = peg$otherExpectation("math operation");
    var peg$e27 = peg$literalExpectation(">=", false);
    var peg$e28 = peg$literalExpectation("<=", false);
    var peg$e29 = peg$literalExpectation("==", false);
    var peg$e30 = peg$literalExpectation("!=", false);
    var peg$e31 = peg$literalExpectation("&&", false);
    var peg$e32 = peg$literalExpectation("||", false);
    var peg$e33 = peg$literalExpectation("|>", false);
    var peg$e34 = peg$literalExpectation("(", false);
    var peg$e35 = peg$literalExpectation(":", false);
    var peg$e36 = peg$literalExpectation(")", false);
    var peg$e37 = peg$literalExpectation("!", false);
    var peg$e38 = peg$literalExpectation("~", false);
    var peg$e39 = peg$literalExpectation("await", false);
    var peg$e40 = peg$literalExpectation(".", false);
    var peg$e41 = peg$literalExpectation("allSettled", false);
    var peg$e42 = peg$literalExpectation("all", false);
    var peg$e43 = peg$literalExpectation("race", false);
    var peg$e44 = peg$literalExpectation("any", false);
    var peg$e45 = peg$literalExpectation("yield", false);
    var peg$e46 = peg$literalExpectation("?", false);
    var peg$e47 = peg$literalExpectation("=", false);
    var peg$e48 = peg$literalExpectation("??", false);
    var peg$e49 = peg$literalExpectation("throw", false);
    var peg$e50 = peg$literalExpectation("safeguard", false);
    var peg$e51 = peg$literalExpectation("safeguard^", false);
    var peg$e52 = peg$literalExpectation("try", false);
    var peg$e53 = peg$literalExpectation("@catch", false);
    var peg$e54 = peg$literalExpectation("@finally", false);
    var peg$e55 = peg$literalExpectation("import", false);
    var peg$e56 = peg$literalExpectation(",", false);
    var peg$e57 = peg$literalExpectation("from", false);
    var peg$e58 = peg$literalExpectation("as", false);
    var peg$e59 = peg$literalExpectation("export", false);
    var peg$e60 = peg$literalExpectation("default", false);
    var peg$e61 = peg$literalExpectation("<+", false);
    var peg$e62 = peg$literalExpectation("+>", false);
    var peg$e63 = peg$otherExpectation("variable declaration");
    var peg$e64 = peg$literalExpectation("let", false);
    var peg$e65 = peg$literalExpectation("mut", false);
    var peg$e66 = peg$literalExpectation("[", false);
    var peg$e67 = peg$literalExpectation("]", false);
    var peg$e68 = peg$otherExpectation("function declaration");
    var peg$e69 = peg$literalExpectation("async", false);
    var peg$e70 = peg$literalExpectation("fn", false);
    var peg$e71 = peg$literalExpectation("=>", false);
    var peg$e72 = peg$literalExpectation("@", false);
    var peg$e73 = peg$literalExpectation("do", false);
    var peg$e74 = peg$literalExpectation("if", false);
    var peg$e75 = peg$literalExpectation("guard", false);
    var peg$e76 = peg$literalExpectation("for", false);
    var peg$e77 = peg$literalExpectation("ever", false);
    var peg$e78 = peg$literalExpectation(":(", false);
    var peg$e79 = peg$literalExpectation("...", false);
    var peg$e80 = peg$otherExpectation("lvalue");
    var peg$e81 = peg$otherExpectation("identifier");
    var peg$e82 = peg$literalExpectation("`", false);
    var peg$e83 = peg$otherExpectation("number");
    var peg$e84 = peg$literalExpectation("n", false);
    var peg$e85 = peg$literalExpectation("e", false);
    var peg$e86 = peg$literalExpectation("0x", false);
    var peg$e87 = peg$literalExpectation("0b", false);
    var peg$e88 = peg$literalExpectation("0", false);
    var peg$e89 = peg$literalExpectation("1", false);
    var peg$e90 = peg$otherExpectation("string");
    var peg$e91 = peg$literalExpectation("\"\"", false);
    var peg$e92 = peg$literalExpectation("\"", false);
    var peg$e93 = peg$literalExpectation("\\#", false);
    var peg$e94 = peg$literalExpectation("\\", false);
    var peg$e95 = peg$literalExpectation("u", false);
    var peg$e96 = peg$anyExpectation();
    var peg$e97 = peg$literalExpectation("#{", false);
    var peg$e98 = peg$classExpectation(["\"", "\\", "#"], true, false);
    var peg$e99 = peg$literalExpectation("#", false);
    var peg$e100 = peg$classExpectation(["\\", "/"], true, false);
    var peg$e101 = peg$classExpectation([["a", "z"]], false, false);
    var peg$e102 = peg$literalExpectation("->", false);
    var peg$e103 = peg$literalExpectation("by", false);
    var peg$e104 = peg$literalExpectation("true", false);
    var peg$e105 = peg$literalExpectation("false", false);
    var peg$e106 = peg$literalExpectation("null", false);
    var peg$e107 = peg$literalExpectation("void", false);
    var peg$e108 = peg$literalExpectation("###", false);
    var peg$e109 = peg$literalExpectation("\n", false);
    var peg$e110 = peg$literalExpectation("\r", false);
    var peg$e111 = peg$classExpectation([["a", "z"], ["A", "Z"], "$"], false, false);
    var peg$e112 = peg$classExpectation([["a", "z"], ["A", "Z"], ["0", "9"], "_", "$"], false, false);
    var peg$e113 = peg$otherExpectation("hex");
    var peg$e114 = peg$classExpectation([["a", "f"], ["A", "F"], ["0", "9"]], false, false);
    var peg$e115 = peg$otherExpectation("decimal");
    var peg$e116 = peg$classExpectation([["0", "9"]], false, false);
    var peg$e117 = peg$otherExpectation("item separator");
    var peg$e118 = peg$otherExpectation("whitespace");
    var peg$e119 = peg$classExpectation([" ", "\t", "\n", "\r"], false, false);
    var peg$e120 = peg$otherExpectation("space");
    var peg$e121 = peg$classExpectation([" ", "\t"], false, false);
    var peg$e122 = peg$otherExpectation("required space");
    var peg$e123 = peg$otherExpectation("newline");
    var peg$e124 = peg$classExpectation(["\n", "\r"], false, false);

    var peg$f0 = function(expr, tail) {
            return [
                expr,
                ...tail.map(i => i[1])
            ]
        };
    var peg$f1 = function() {
            return []
        };
    var peg$f2 = function() {return token.debugger()};
    var peg$f3 = function(expr) {
            return token.reactive({expr})
        };
    var peg$f4 = function(expr) {
            return token.typeof({expr})
        };
    var peg$f5 = function(target, expr) {
            return token.instance({expr, target})
        };
    var peg$f6 = function(expr) {
            return token.delete({expr})
        };
    var peg$f7 = function(head, tail) {
            const uniqOps = new Set(
                tail.map(t => t[1])
            );
            if (uniqOps.size > 1) {
                error("Cannot mix operators without using parens '()' to group");
            }
            return binOp(head, tail)
        };
    var peg$f8 = function(left, op, right) {
            return token.binop({
                left,
                op,
                right,
            })
        };
    var peg$f9 = function(head, tail) {
            return token.pipe({
                list: listMap(
                    head,
                    tail,
                    item => ({
                        binding: item[4],
                        expr: item[7]
                    })
                )
            })
        };
    var peg$f10 = function(value) {
            return token.parens({value})
        };
    var peg$f11 = function(op, expr) {
            return token.unary({op, expr, func: true})
        };
    var peg$f12 = function(op, mode, expr) {
            return token.unary({op, expr, mode})
        };
    var peg$f13 = function(op, expr) {
            return token.unary({op, expr})
        };
    var peg$f14 = function(condition, t, f) {
            return token.ternary({condition, t, f})
        };
    var peg$f15 = function(condition, f, t) {
            return token.ternary({condition, t, f})
        };
    var peg$f16 = function(condition, t) {
            return token.ternary({
                condition,
                t,
                f: token.null(),
            })
        };
    var peg$f17 = function(condition, f) {
            return token.ternary({
                condition,
                f,
                t: token.null(),
            })
        };
    var peg$f18 = function(value) {return value};
    var peg$f19 = function(left, right) {
            return token.binop({
                left,
                right,
                op: "??",
            })
        };
    var peg$f20 = function(expr) {
            return token.throw({expr})
        };
    var peg$f21 = function(expr, body, value) {
            return token.safeguard({
                wait: true,
                body: body?.[1] ?? [],
                expr,
                value,
            })
        };
    var peg$f22 = function(expr, body, value) {
            return token.safeguard({
                wait: false,
                body: body?.[1] ?? [],
                expr,
                value,
            })
        };
    var peg$f23 = function(expr) {
            return token.safeguard({
                wait: true,
                body: [],
                expr,
                value: token.return({
                    expr: token.var({name: "error"})
                }),
            })
        };
    var peg$f24 = function(expr) {
            return token.safeguard({
                wait: false,
                body: [],
                expr,
                value: token.return({
                    expr: token.var({name: "error"})
                }),
            })
        };
    var peg$f25 = function(body, handle, last) {
            return token.try({
                body,
                handle,
                last: last?.[0],
            })
        };
    var peg$f26 = function(name, body) {
            return {
                name,
                body,
            }
        };
    var peg$f27 = function(body) {
            return body
        };
    var peg$f28 = function(source) {
            return token.import({source})
        };
    var peg$f29 = function(expr) {
            return token.export({expr})
        };
    var peg$f30 = function(items) {
            return token.export({items})
        };
    var peg$f31 = function(expr) {
            return token.export({
                def: true,
                expr,
            })
        };
    var peg$f32 = function(head, tail) {
            return list(head, tail, 1)
        };
    var peg$f33 = function(source, name) {
            return {source, name}
        };
    var peg$f34 = function(source) {
            return {source}
        };
    var peg$f35 = function(name, value) {
            return {name, value}
        };
    var peg$f36 = function(value, name) {
            return {
                name,
                value,
            }
        };
    var peg$f37 = function(mut, name, guard) {
            return token.let({
                mutable: mut === "mut",
                name,
                guard,
            })
        };
    var peg$f38 = function(mut, name, guard) {
            return token.let({
                mutable: mut === "mut",
                name,
                guard,
                destruct: true,
            })
        };
    var peg$f39 = function(mut, info) {
            return token.let({
                ...info,
                mutable: mut === "mut",
            })
        };
    var peg$f40 = function(mut, dest) {
            return token.let({
                mutable: mut === "mut",
                ...dest
            })
        };
    var peg$f41 = function(mut, name, value) {
            return token.let({
                mutable: mut === "mut",
                name,
                value,
            })
        };
    var peg$f42 = function(head, tail, rest) {
            const names = list(head, tail, 1);
            return token.objdest({
                names,
                rest: rest?.[1]
            })
        };
    var peg$f43 = function(source, name) {
            return token.as({source, name})
        };
    var peg$f44 = function(left, right) {
            return token.assign({left, right, op: "="})
        };
    var peg$f45 = function(head, tail, rest) {
            const names = list(head, tail, 1);
            return token.arraydest({
                names,
                rest: rest?.[1]
            })
        };
    var peg$f46 = function(wait, gen, name, args, lines, value) {
            return token.fn({
                args: args ?? [],
                name: name?.[0],
                body: lines?.[1] ?? [],
                value: value?.[1],
                wait: wait !== null,
                gen: gen !== null,
            })
        };
    var peg$f47 = function(wait, gen, args, body) {
            return token.fn({
                short: true,
                args: args ?? [],
                body,
                wait: wait !== null,
                gen: gen !== null,
            })
        };
    var peg$f48 = function(args) {
            return token.arg({
                args: args.map(arg => arg[2])
            })
        };
    var peg$f49 = function(head, tail) {
            return list(head, tail, 2)
        };
    var peg$f50 = function(body, value) {
            return token.do({body, value})
        };
    var peg$f51 = function(expr) {
            return token.return({expr})
        };
    var peg$f52 = function() {
            error("Return must have a expression");
        };
    var peg$f53 = function(condition, body, value) {
            return token.if({
                condition,
                body,
                value,
            })
        };
    var peg$f54 = function(condition, value) {
            return token.if({
                condition,
                value,
                body: [],
            })
        };
    var peg$f55 = function(wait, name, range, body) {
            return token.for({
                name,
                range,
                body,
                wait: wait !== null
            })
        };
    var peg$f56 = function(wait, name, source, body) {
            return token.for({
                name,
                source,
                body,
                wait: wait !== null
            })
        };
    var peg$f57 = function(body) {
            return token.for({body})
        };
    var peg$f58 = function() {
            return token.array({
                items: []
            })
        };
    var peg$f59 = function(head, tail) {
            return token.array({
                items: list(head, tail, 1)
            })
        };
    var peg$f60 = function(range) {
            return token.array({
                range
            })
        };
    var peg$f61 = function(body, arg, range) {
            return token.array({
                range,
                arg,
                body
            })
        };
    var peg$f62 = function() {
            return token.object({pairs: []})
        };
    var peg$f63 = function(pairs) {
            return token.object({pairs})
        };
    var peg$f64 = function(key, value) {
            return token.pair({key, value})
        };
    var peg$f65 = function(name) {
            return name
        };
    var peg$f66 = function(expr) {
            return token.computedKey({expr})
        };
    var peg$f67 = function(expr) {
            return token.spread({expr})
        };
    var peg$f68 = function(name) {
            return token.shorthand({name})
        };
    var peg$f69 = function(left, right) {
            return token.assign({
                dest:true,
                left,
                right,
                op: "=",
            })
        };
    var peg$f70 = function(head, tail) {
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
        };
    var peg$f71 = function(name) {
            return {
                type: token.dotAccess,
                item: {
                    name,
                    optional: false,
                }
            }
        };
    var peg$f72 = function(value) {
            return {
                type: token.arrayAccess,
                item: {
                    value,
                    optional: false,
                }
            }
        };
    var peg$f73 = function(head, tail) {
            return tail.reduce(
                (target, next) => next.type({
                    target,
                    ...next.item
                }),
                head
            )
        };
    var peg$f74 = function(optional, name) {
            return {
                type: token.dotAccess,
                item: {
                    name,
                    optional: optional !== null,
                }
            }
        };
    var peg$f75 = function(optional, range) {
            return {
                type: token.slice,
                item: {
                    range,
                    optional: optional !== null,
                }
            }
        };
    var peg$f76 = function(optional, value) {
            return {
                type: token.arrayAccess,
                item: {
                    value,
                    optional: optional !== null,
                }
            }
        };
    var peg$f77 = function(optional, args) {
            return {
                type: token.call,
                item: {
                    args: args ?? [],
                    optional: optional !== null,
                }
            }
        };
    var peg$f78 = function(str) {
            return {
                type: token.tag,
                item: {str}
            }
        };
    var peg$f79 = function(pos, named) {
            return [...pos, named]
        };
    var peg$f80 = function(named) {
            return [named]
        };
    var peg$f81 = function(head, tail) {
            return token.object({
                pairs: list(head, tail, 1)
            })
        };
    var peg$f82 = function(key, value) {
            return token.pair({
                key: token.var({name: key}),
                value
            })
        };
    var peg$f83 = function(key) {
            return token.var({name: key})
        };
    var peg$f84 = function(expr) {
            return token.new({expr})
        };
    var peg$f85 = function(num) {
            return token.num({
                value: BigInt(num),
                big: "n",
            })
        };
    var peg$f86 = function(num) {
            return token.num({
                value: parseFloat(num, 10)
            })
        };
    var peg$f87 = function(num) {
            return token.num({
                value: parseInt(num, 16)
            })
        };
    var peg$f88 = function(num) {
            return token.num({
                value: parseInt(num, 2)
            })
        };
    var peg$f89 = function(value) {
            return token.string({value: ""})
        };
    var peg$f90 = function(parts) {
            const simple = (
                parts.length === 1
                && typeof(parts[0]) === "string"
                && parts[0].indexOf("\n") === -1
            );
            if (simple === true) {
                return token.string({
                    value: parts[0]
                })
            }
            return token.string({parts})
        };
    var peg$f91 = function() {return "#"};
    var peg$f92 = function() {
            error("Invalid unicode escape sequence");
        };
    var peg$f93 = function(expr) {
            return expr
        };
    var peg$f94 = function(text) {
            return text.replace(/\$/g, "\\$")
        };
    var peg$f95 = function(def) {
            return token.regex({def})
        };
    var peg$f96 = function(start, end, inc) {
            return token.range({
                start,
                end,
                by: inc ? inc[3] : token.num({value: 1})
            })
        };
    var peg$f97 = function(start, end) {
            return token.range({
                start,
                end,
            })
        };
    var peg$f98 = function(start) {
            return token.range({
                start,
            })
        };
    var peg$f99 = function(end) {
            return token.range({
                end,
            })
        };
    var peg$f100 = function(value) {
            return token.bool({value})
        };
    var peg$f101 = function() {return token.null()};
    var peg$f102 = function() {return token.void()};
    var peg$f103 = function(name) {
            return token.var({name})
        };
    var peg$f104 = function() {return null};

    var peg$currPos = 0;
    var peg$savedPos = 0;
    var peg$posDetailsCache = [{ line: 1, column: 1 }];
    var peg$maxFailPos = 0;
    var peg$maxFailExpected = [];
    var peg$silentFails = 0;

    var peg$resultsCache = {};

    var peg$tracer = "tracer" in options ? options.tracer : new peg$DefaultTracer();

    var peg$result;

    if ("startRule" in options) {
      if (!(options.startRule in peg$startRuleFunctions)) {
        throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
      }

      peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
    }

    function error(message, location) {
      location = location !== undefined
        ? location
        : peg$computeLocation(peg$savedPos, peg$currPos);

      throw peg$buildSimpleError(message, location);
    }

    function peg$literalExpectation(text, ignoreCase) {
      return { type: "literal", text: text, ignoreCase: ignoreCase };
    }

    function peg$classExpectation(parts, inverted, ignoreCase) {
      return { type: "class", parts: parts, inverted: inverted, ignoreCase: ignoreCase };
    }

    function peg$anyExpectation() {
      return { type: "any" };
    }

    function peg$endExpectation() {
      return { type: "end" };
    }

    function peg$otherExpectation(description) {
      return { type: "other", description: description };
    }

    function peg$computePosDetails(pos) {
      var details = peg$posDetailsCache[pos];
      var p;

      if (details) {
        return details;
      } else {
        p = pos - 1;
        while (!peg$posDetailsCache[p]) {
          p--;
        }

        details = peg$posDetailsCache[p];
        details = {
          line: details.line,
          column: details.column
        };

        while (p < pos) {
          if (input.charCodeAt(p) === 10) {
            details.line++;
            details.column = 1;
          } else {
            details.column++;
          }

          p++;
        }

        peg$posDetailsCache[pos] = details;

        return details;
      }
    }

    function peg$computeLocation(startPos, endPos) {
      var startPosDetails = peg$computePosDetails(startPos);
      var endPosDetails = peg$computePosDetails(endPos);

      return {
        source: peg$source,
        start: {
          offset: startPos,
          line: startPosDetails.line,
          column: startPosDetails.column
        },
        end: {
          offset: endPos,
          line: endPosDetails.line,
          column: endPosDetails.column
        }
      };
    }

    function peg$fail(expected) {
      if (peg$currPos < peg$maxFailPos) { return; }

      if (peg$currPos > peg$maxFailPos) {
        peg$maxFailPos = peg$currPos;
        peg$maxFailExpected = [];
      }

      peg$maxFailExpected.push(expected);
    }

    function peg$buildSimpleError(message, location) {
      return new peg$SyntaxError(message, null, null, location);
    }

    function peg$buildStructuredError(expected, found, location) {
      return new peg$SyntaxError(
        peg$SyntaxError.buildMessage(expected, found),
        expected,
        found,
        location
      );
    }

    function peg$parseProgram() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5, s6;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Program",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 0;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Program",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Program",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      peg$silentFails++;
      s0 = peg$currPos;
      s1 = peg$parse_();
      s2 = peg$parseReactive();
      if (s2 === peg$FAILED) {
        s2 = peg$parseStatement();
      }
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$currPos;
        s5 = peg$parse_l();
        if (s5 !== peg$FAILED) {
          s6 = peg$parseReactive();
          if (s6 === peg$FAILED) {
            s6 = peg$parseStatement();
          }
          if (s6 !== peg$FAILED) {
            s5 = [s5, s6];
            s4 = s5;
          } else {
            peg$currPos = s4;
            s4 = peg$FAILED;
          }
        } else {
          peg$currPos = s4;
          s4 = peg$FAILED;
        }
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = peg$currPos;
          s5 = peg$parse_l();
          if (s5 !== peg$FAILED) {
            s6 = peg$parseReactive();
            if (s6 === peg$FAILED) {
              s6 = peg$parseStatement();
            }
            if (s6 !== peg$FAILED) {
              s5 = [s5, s6];
              s4 = s5;
            } else {
              peg$currPos = s4;
              s4 = peg$FAILED;
            }
          } else {
            peg$currPos = s4;
            s4 = peg$FAILED;
          }
        }
        s4 = peg$parse_();
        peg$savedPos = s0;
        s0 = peg$f0(s2, s3);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parse_();
        peg$savedPos = s0;
        s1 = peg$f1();
        s0 = s1;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e0); }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Program",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Program",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseExprs() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Exprs",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 1;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Exprs",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Exprs",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      peg$silentFails++;
      s0 = peg$currPos;
      s1 = peg$parseStatement();
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse_l();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseStatement();
          if (s5 !== peg$FAILED) {
            s4 = [s4, s5];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$parse_l();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseStatement();
            if (s5 !== peg$FAILED) {
              s4 = [s4, s5];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        }
        peg$savedPos = s0;
        s0 = peg$f0(s1, s2);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e1); }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Exprs",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Exprs",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseStatement() {
      var startPos = peg$currPos;
      var s0;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Statement",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 2;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Statement",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Statement",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      peg$silentFails++;
      s0 = peg$parseIf();
      if (s0 === peg$FAILED) {
        s0 = peg$parseFor();
        if (s0 === peg$FAILED) {
          s0 = peg$parseDebugger();
          if (s0 === peg$FAILED) {
            s0 = peg$parseVariableDecl();
            if (s0 === peg$FAILED) {
              s0 = peg$parseThrow();
              if (s0 === peg$FAILED) {
                s0 = peg$parseTry();
                if (s0 === peg$FAILED) {
                  s0 = peg$parseImport();
                  if (s0 === peg$FAILED) {
                    s0 = peg$parseExport();
                    if (s0 === peg$FAILED) {
                      s0 = peg$parseAssignment();
                      if (s0 === peg$FAILED) {
                        s0 = peg$parseDelete();
                        if (s0 === peg$FAILED) {
                          s0 = peg$parseExpr();
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        if (peg$silentFails === 0) { peg$fail(peg$e2); }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Statement",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Statement",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseExpr() {
      var startPos = peg$currPos;
      var s0;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Expr",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 3;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Expr",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Expr",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      peg$silentFails++;
      s0 = peg$parseRegex();
      if (s0 === peg$FAILED) {
        s0 = peg$parseNew();
        if (s0 === peg$FAILED) {
          s0 = peg$parseFunctionDecl();
          if (s0 === peg$FAILED) {
            s0 = peg$parsePipeline();
            if (s0 === peg$FAILED) {
              s0 = peg$parseLogical();
              if (s0 === peg$FAILED) {
                s0 = peg$parseCompare();
                if (s0 === peg$FAILED) {
                  s0 = peg$parseMath();
                  if (s0 === peg$FAILED) {
                    s0 = peg$parseStatusOp();
                    if (s0 === peg$FAILED) {
                      s0 = peg$parseUnary();
                      if (s0 === peg$FAILED) {
                        s0 = peg$parseTernary();
                        if (s0 === peg$FAILED) {
                          s0 = peg$parseNullCoalesce();
                          if (s0 === peg$FAILED) {
                            s0 = peg$parseBoolean();
                            if (s0 === peg$FAILED) {
                              s0 = peg$parseBottomValue();
                              if (s0 === peg$FAILED) {
                                s0 = peg$parseDo();
                                if (s0 === peg$FAILED) {
                                  s0 = peg$parseIdentifier();
                                  if (s0 === peg$FAILED) {
                                    s0 = peg$parseString();
                                    if (s0 === peg$FAILED) {
                                      s0 = peg$parseNumber();
                                      if (s0 === peg$FAILED) {
                                        s0 = peg$parseObject();
                                        if (s0 === peg$FAILED) {
                                          s0 = peg$parseArray();
                                          if (s0 === peg$FAILED) {
                                            s0 = peg$parseParens();
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        if (peg$silentFails === 0) { peg$fail(peg$e3); }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Expr",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Expr",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseComparableValue() {
      var startPos = peg$currPos;
      var s0;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "ComparableValue",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 4;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "ComparableValue",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "ComparableValue",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$parseMath();
      if (s0 === peg$FAILED) {
        s0 = peg$parseNumber();
        if (s0 === peg$FAILED) {
          s0 = peg$parseBoolean();
          if (s0 === peg$FAILED) {
            s0 = peg$parseBottomValue();
            if (s0 === peg$FAILED) {
              s0 = peg$parseUnary();
              if (s0 === peg$FAILED) {
                s0 = peg$parseStatusOp();
                if (s0 === peg$FAILED) {
                  s0 = peg$parseIdentifier();
                  if (s0 === peg$FAILED) {
                    s0 = peg$parseString();
                    if (s0 === peg$FAILED) {
                      s0 = peg$parseParens();
                    }
                  }
                }
              }
            }
          }
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "ComparableValue",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "ComparableValue",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseMathValue() {
      var startPos = peg$currPos;
      var s0;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "MathValue",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 5;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "MathValue",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "MathValue",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$parseNumber();
      if (s0 === peg$FAILED) {
        s0 = peg$parseIdentifier();
        if (s0 === peg$FAILED) {
          s0 = peg$parseMathUnary();
          if (s0 === peg$FAILED) {
            s0 = peg$parseParens();
          }
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "MathValue",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "MathValue",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseDebugger() {
      var startPos = peg$currPos;
      var s0, s1;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Debugger",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 7;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Debugger",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Debugger",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 8) === peg$c0) {
        s1 = peg$c0;
        peg$currPos += 8;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e4); }
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$f2();
      }
      s0 = s1;

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Debugger",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Debugger",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseReactive() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Reactive",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 8;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Reactive",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Reactive",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c1) {
        s1 = peg$c1;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e5); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__s();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseStatement();
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f3(s3);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Reactive",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Reactive",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseStatusOp() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5, s6, s7, s9;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "StatusOp",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 9;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "StatusOp",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "StatusOp",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 6) === peg$c2) {
        s1 = peg$c2;
        peg$currPos += 6;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e6); }
      }
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 123) {
          s2 = peg$c3;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e7); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          s4 = peg$parseExpr();
          if (s4 !== peg$FAILED) {
            s5 = peg$parse_();
            if (input.charCodeAt(peg$currPos) === 125) {
              s6 = peg$c4;
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e8); }
            }
            if (s6 !== peg$FAILED) {
              peg$savedPos = s0;
              s0 = peg$f4(s4);
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 8) === peg$c5) {
          s1 = peg$c5;
          peg$currPos += 8;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e9); }
        }
        if (s1 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 60) {
            s2 = peg$c6;
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e10); }
          }
          if (s2 !== peg$FAILED) {
            s3 = peg$parseIdentifier();
            if (s3 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 62) {
                s4 = peg$c7;
                peg$currPos++;
              } else {
                s4 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e11); }
              }
              if (s4 !== peg$FAILED) {
                if (input.charCodeAt(peg$currPos) === 123) {
                  s5 = peg$c3;
                  peg$currPos++;
                } else {
                  s5 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$e7); }
                }
                if (s5 !== peg$FAILED) {
                  s6 = peg$parse_();
                  s7 = peg$parseExpr();
                  if (s7 !== peg$FAILED) {
                    peg$parse_();
                    if (input.charCodeAt(peg$currPos) === 125) {
                      s9 = peg$c4;
                      peg$currPos++;
                    } else {
                      s9 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$e8); }
                    }
                    if (s9 !== peg$FAILED) {
                      peg$savedPos = s0;
                      s0 = peg$f5(s3, s7);
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "StatusOp",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "StatusOp",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseDelete() {
      var startPos = peg$currPos;
      var s0, s1, s2, s4, s6;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Delete",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 10;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Delete",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Delete",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 6) === peg$c8) {
        s1 = peg$c8;
        peg$currPos += 6;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e12); }
      }
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 123) {
          s2 = peg$c3;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e7); }
        }
        if (s2 !== peg$FAILED) {
          peg$parse_();
          s4 = peg$parseExpr();
          if (s4 !== peg$FAILED) {
            peg$parse_();
            if (input.charCodeAt(peg$currPos) === 125) {
              s6 = peg$c4;
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e8); }
            }
            if (s6 !== peg$FAILED) {
              peg$savedPos = s0;
              s0 = peg$f6(s4);
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Delete",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Delete",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseBinaryNumberOp() {
      var startPos = peg$currPos;
      var s0;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "BinaryNumberOp",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 11;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "BinaryNumberOp",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "BinaryNumberOp",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      if (input.substr(peg$currPos, 3) === peg$c9) {
        s0 = peg$c9;
        peg$currPos += 3;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e13); }
      }
      if (s0 === peg$FAILED) {
        if (input.substr(peg$currPos, 3) === peg$c10) {
          s0 = peg$c10;
          peg$currPos += 3;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e14); }
        }
        if (s0 === peg$FAILED) {
          if (input.substr(peg$currPos, 2) === peg$c11) {
            s0 = peg$c11;
            peg$currPos += 2;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e15); }
          }
          if (s0 === peg$FAILED) {
            if (input.substr(peg$currPos, 2) === peg$c12) {
              s0 = peg$c12;
              peg$currPos += 2;
            } else {
              s0 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e16); }
            }
            if (s0 === peg$FAILED) {
              if (input.substr(peg$currPos, 2) === peg$c13) {
                s0 = peg$c13;
                peg$currPos += 2;
              } else {
                s0 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e17); }
              }
              if (s0 === peg$FAILED) {
                if (input.charCodeAt(peg$currPos) === 47) {
                  s0 = peg$c14;
                  peg$currPos++;
                } else {
                  s0 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$e18); }
                }
                if (s0 === peg$FAILED) {
                  if (input.charCodeAt(peg$currPos) === 42) {
                    s0 = peg$c15;
                    peg$currPos++;
                  } else {
                    s0 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$e19); }
                  }
                  if (s0 === peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 37) {
                      s0 = peg$c16;
                      peg$currPos++;
                    } else {
                      s0 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$e20); }
                    }
                    if (s0 === peg$FAILED) {
                      if (input.charCodeAt(peg$currPos) === 45) {
                        s0 = peg$c17;
                        peg$currPos++;
                      } else {
                        s0 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$e21); }
                      }
                      if (s0 === peg$FAILED) {
                        if (input.charCodeAt(peg$currPos) === 43) {
                          s0 = peg$c18;
                          peg$currPos++;
                        } else {
                          s0 = peg$FAILED;
                          if (peg$silentFails === 0) { peg$fail(peg$e22); }
                        }
                        if (s0 === peg$FAILED) {
                          if (input.charCodeAt(peg$currPos) === 124) {
                            s0 = peg$c19;
                            peg$currPos++;
                          } else {
                            s0 = peg$FAILED;
                            if (peg$silentFails === 0) { peg$fail(peg$e23); }
                          }
                          if (s0 === peg$FAILED) {
                            if (input.charCodeAt(peg$currPos) === 94) {
                              s0 = peg$c20;
                              peg$currPos++;
                            } else {
                              s0 = peg$FAILED;
                              if (peg$silentFails === 0) { peg$fail(peg$e24); }
                            }
                            if (s0 === peg$FAILED) {
                              if (input.charCodeAt(peg$currPos) === 38) {
                                s0 = peg$c21;
                                peg$currPos++;
                              } else {
                                s0 = peg$FAILED;
                                if (peg$silentFails === 0) { peg$fail(peg$e25); }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "BinaryNumberOp",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "BinaryNumberOp",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseMath() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5, s6, s7;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Math",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 12;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Math",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Math",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      peg$silentFails++;
      s0 = peg$currPos;
      s1 = peg$parseMathValue();
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseBinaryNumberOp();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse__();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseMathValue();
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            s3 = peg$currPos;
            s4 = peg$parse__();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseBinaryNumberOp();
              if (s5 !== peg$FAILED) {
                s6 = peg$parse__();
                if (s6 !== peg$FAILED) {
                  s7 = peg$parseMathValue();
                  if (s7 !== peg$FAILED) {
                    s4 = [s4, s5, s6, s7];
                    s3 = s4;
                  } else {
                    peg$currPos = s3;
                    s3 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s3;
                  s3 = peg$FAILED;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          }
        } else {
          s2 = peg$FAILED;
        }
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f7(s1, s2);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e26); }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Math",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Math",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseComapreOp() {
      var startPos = peg$currPos;
      var s0;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "ComapreOp",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 13;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "ComapreOp",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "ComapreOp",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      if (input.substr(peg$currPos, 2) === peg$c22) {
        s0 = peg$c22;
        peg$currPos += 2;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e27); }
      }
      if (s0 === peg$FAILED) {
        if (input.substr(peg$currPos, 2) === peg$c23) {
          s0 = peg$c23;
          peg$currPos += 2;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e28); }
        }
        if (s0 === peg$FAILED) {
          if (input.substr(peg$currPos, 2) === peg$c24) {
            s0 = peg$c24;
            peg$currPos += 2;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e29); }
          }
          if (s0 === peg$FAILED) {
            if (input.substr(peg$currPos, 2) === peg$c25) {
              s0 = peg$c25;
              peg$currPos += 2;
            } else {
              s0 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e30); }
            }
            if (s0 === peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 62) {
                s0 = peg$c7;
                peg$currPos++;
              } else {
                s0 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e11); }
              }
              if (s0 === peg$FAILED) {
                if (input.charCodeAt(peg$currPos) === 60) {
                  s0 = peg$c6;
                  peg$currPos++;
                } else {
                  s0 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$e10); }
                }
              }
            }
          }
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "ComapreOp",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "ComapreOp",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseCompare() {
      var startPos = peg$currPos;
      var s0, s1, s3, s5;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Compare",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 14;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Compare",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Compare",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$parseComparableValue();
      if (s1 !== peg$FAILED) {
        peg$parse_s();
        s3 = peg$parseComapreOp();
        if (s3 !== peg$FAILED) {
          peg$parse_s();
          s5 = peg$parseComparableValue();
          if (s5 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f8(s1, s3, s5);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Compare",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Compare",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseLogical() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5, s6, s7;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Logical",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 15;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Logical",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Logical",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$parseCompare();
      if (s1 === peg$FAILED) {
        s1 = peg$parseParens();
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          if (input.substr(peg$currPos, 2) === peg$c26) {
            s5 = peg$c26;
            peg$currPos += 2;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e31); }
          }
          if (s5 === peg$FAILED) {
            if (input.substr(peg$currPos, 2) === peg$c27) {
              s5 = peg$c27;
              peg$currPos += 2;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e32); }
            }
          }
          if (s5 !== peg$FAILED) {
            s6 = peg$parse__();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseCompare();
              if (s7 === peg$FAILED) {
                s7 = peg$parseParens();
              }
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            s3 = peg$currPos;
            s4 = peg$parse__();
            if (s4 !== peg$FAILED) {
              if (input.substr(peg$currPos, 2) === peg$c26) {
                s5 = peg$c26;
                peg$currPos += 2;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e31); }
              }
              if (s5 === peg$FAILED) {
                if (input.substr(peg$currPos, 2) === peg$c27) {
                  s5 = peg$c27;
                  peg$currPos += 2;
                } else {
                  s5 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$e32); }
                }
              }
              if (s5 !== peg$FAILED) {
                s6 = peg$parse__();
                if (s6 !== peg$FAILED) {
                  s7 = peg$parseCompare();
                  if (s7 === peg$FAILED) {
                    s7 = peg$parseParens();
                  }
                  if (s7 !== peg$FAILED) {
                    s4 = [s4, s5, s6, s7];
                    s3 = s4;
                  } else {
                    peg$currPos = s3;
                    s3 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s3;
                  s3 = peg$FAILED;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          }
        } else {
          s2 = peg$FAILED;
        }
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f7(s1, s2);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Logical",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Logical",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parsePipeline() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Pipeline",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 16;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Pipeline",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Pipeline",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$parseComparableValue();
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          if (input.substr(peg$currPos, 2) === peg$c28) {
            s5 = peg$c28;
            peg$currPos += 2;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e33); }
          }
          if (s5 !== peg$FAILED) {
            s6 = peg$parse__s();
            if (s6 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 40) {
                s7 = peg$c29;
                peg$currPos++;
              } else {
                s7 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e34); }
              }
              if (s7 !== peg$FAILED) {
                s8 = peg$parseWord();
                if (s8 !== peg$FAILED) {
                  if (input.charCodeAt(peg$currPos) === 58) {
                    s9 = peg$c30;
                    peg$currPos++;
                  } else {
                    s9 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$e35); }
                  }
                  if (s9 !== peg$FAILED) {
                    s10 = peg$parse__s();
                    if (s10 !== peg$FAILED) {
                      s11 = peg$parseExpr();
                      if (s11 !== peg$FAILED) {
                        s12 = peg$parse_();
                        if (input.charCodeAt(peg$currPos) === 41) {
                          s13 = peg$c31;
                          peg$currPos++;
                        } else {
                          s13 = peg$FAILED;
                          if (peg$silentFails === 0) { peg$fail(peg$e36); }
                        }
                        if (s13 !== peg$FAILED) {
                          s4 = [s4, s5, s6, s7, s8, s9, s10, s11, s12, s13];
                          s3 = s4;
                        } else {
                          peg$currPos = s3;
                          s3 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s3;
                        s3 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s3;
                      s3 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s3;
                    s3 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s3;
                  s3 = peg$FAILED;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            s3 = peg$currPos;
            s4 = peg$parse__();
            if (s4 !== peg$FAILED) {
              if (input.substr(peg$currPos, 2) === peg$c28) {
                s5 = peg$c28;
                peg$currPos += 2;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e33); }
              }
              if (s5 !== peg$FAILED) {
                s6 = peg$parse__s();
                if (s6 !== peg$FAILED) {
                  if (input.charCodeAt(peg$currPos) === 40) {
                    s7 = peg$c29;
                    peg$currPos++;
                  } else {
                    s7 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$e34); }
                  }
                  if (s7 !== peg$FAILED) {
                    s8 = peg$parseWord();
                    if (s8 !== peg$FAILED) {
                      if (input.charCodeAt(peg$currPos) === 58) {
                        s9 = peg$c30;
                        peg$currPos++;
                      } else {
                        s9 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$e35); }
                      }
                      if (s9 !== peg$FAILED) {
                        s10 = peg$parse__s();
                        if (s10 !== peg$FAILED) {
                          s11 = peg$parseExpr();
                          if (s11 !== peg$FAILED) {
                            s12 = peg$parse_();
                            if (input.charCodeAt(peg$currPos) === 41) {
                              s13 = peg$c31;
                              peg$currPos++;
                            } else {
                              s13 = peg$FAILED;
                              if (peg$silentFails === 0) { peg$fail(peg$e36); }
                            }
                            if (s13 !== peg$FAILED) {
                              s4 = [s4, s5, s6, s7, s8, s9, s10, s11, s12, s13];
                              s3 = s4;
                            } else {
                              peg$currPos = s3;
                              s3 = peg$FAILED;
                            }
                          } else {
                            peg$currPos = s3;
                            s3 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s3;
                          s3 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s3;
                        s3 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s3;
                      s3 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s3;
                    s3 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s3;
                  s3 = peg$FAILED;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          }
        } else {
          s2 = peg$FAILED;
        }
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f9(s1, s2);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Pipeline",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Pipeline",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseParens() {
      var startPos = peg$currPos;
      var s0, s1, s3, s5;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Parens",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 17;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Parens",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Parens",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 40) {
        s1 = peg$c29;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e34); }
      }
      if (s1 !== peg$FAILED) {
        peg$parse_();
        s3 = peg$parseExpr();
        if (s3 !== peg$FAILED) {
          peg$parse_();
          if (input.charCodeAt(peg$currPos) === 41) {
            s5 = peg$c31;
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e36); }
          }
          if (s5 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f10(s3);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Parens",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Parens",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseUnary() {
      var startPos = peg$currPos;
      var s0, s1, s2, s4, s6;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Unary",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 18;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Unary",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Unary",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 33) {
        s1 = peg$c32;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e37); }
      }
      if (s1 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 126) {
          s1 = peg$c33;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e38); }
        }
      }
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 40) {
          s2 = peg$c29;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e34); }
        }
        if (s2 !== peg$FAILED) {
          peg$parse_();
          s4 = peg$parseExpr();
          if (s4 !== peg$FAILED) {
            peg$parse_();
            if (input.charCodeAt(peg$currPos) === 41) {
              s6 = peg$c31;
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e36); }
            }
            if (s6 !== peg$FAILED) {
              peg$savedPos = s0;
              s0 = peg$f11(s1, s4);
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseMathUnary();
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Unary",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Unary",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseMathUnary() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5, s6;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "MathUnary",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 19;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "MathUnary",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "MathUnary",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 45) {
        s1 = peg$c17;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e21); }
      }
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 40) {
          s2 = peg$c29;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e34); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          s4 = peg$parseExpr();
          if (s4 !== peg$FAILED) {
            s5 = peg$parse_();
            if (input.charCodeAt(peg$currPos) === 41) {
              s6 = peg$c31;
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e36); }
            }
            if (s6 !== peg$FAILED) {
              peg$savedPos = s0;
              s0 = peg$f11(s1, s4);
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 5) === peg$c34) {
          s1 = peg$c34;
          peg$currPos += 5;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e39); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$currPos;
          s3 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 46) {
            s4 = peg$c35;
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e40); }
          }
          if (s4 !== peg$FAILED) {
            if (input.substr(peg$currPos, 10) === peg$c36) {
              s5 = peg$c36;
              peg$currPos += 10;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e41); }
            }
            if (s5 === peg$FAILED) {
              if (input.substr(peg$currPos, 3) === peg$c37) {
                s5 = peg$c37;
                peg$currPos += 3;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e42); }
              }
              if (s5 === peg$FAILED) {
                if (input.substr(peg$currPos, 4) === peg$c38) {
                  s5 = peg$c38;
                  peg$currPos += 4;
                } else {
                  s5 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$e43); }
                }
                if (s5 === peg$FAILED) {
                  if (input.substr(peg$currPos, 3) === peg$c39) {
                    s5 = peg$c39;
                    peg$currPos += 3;
                  } else {
                    s5 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$e44); }
                  }
                }
              }
            }
            if (s5 !== peg$FAILED) {
              s4 = [s4, s5];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
          if (s3 !== peg$FAILED) {
            s2 = input.substring(s2, peg$currPos);
          } else {
            s2 = s3;
          }
          if (s2 !== peg$FAILED) {
            s3 = peg$parse__s();
            if (s3 !== peg$FAILED) {
              s4 = peg$parseExpr();
              if (s4 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f12(s1, s2, s4);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 5) === peg$c34) {
            s1 = peg$c34;
            peg$currPos += 5;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e39); }
          }
          if (s1 === peg$FAILED) {
            if (input.substr(peg$currPos, 5) === peg$c40) {
              s1 = peg$c40;
              peg$currPos += 5;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e45); }
            }
          }
          if (s1 !== peg$FAILED) {
            s2 = peg$parse__s();
            if (s2 !== peg$FAILED) {
              s3 = peg$parseExpr();
              if (s3 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f13(s1, s3);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "MathUnary",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "MathUnary",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseTernary() {
      var startPos = peg$currPos;
      var s0, s1, s2, s4, s6, s7, s8, s9, s10;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Ternary",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 20;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Ternary",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Ternary",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 63) {
        s1 = peg$c41;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e46); }
      }
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 40) {
          s2 = peg$c29;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e34); }
        }
        if (s2 !== peg$FAILED) {
          peg$parse_();
          s4 = peg$parseExpr();
          if (s4 !== peg$FAILED) {
            peg$parse_();
            if (input.charCodeAt(peg$currPos) === 41) {
              s6 = peg$c31;
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e36); }
            }
            if (s6 !== peg$FAILED) {
              s7 = peg$parse__();
              if (s7 !== peg$FAILED) {
                s8 = peg$parseTrueCase();
                if (s8 !== peg$FAILED) {
                  s9 = peg$parse__();
                  if (s9 !== peg$FAILED) {
                    s10 = peg$parseFalseCase();
                    if (s10 !== peg$FAILED) {
                      peg$savedPos = s0;
                      s0 = peg$f14(s4, s8, s10);
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 63) {
          s1 = peg$c41;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e46); }
        }
        if (s1 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 40) {
            s2 = peg$c29;
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e34); }
          }
          if (s2 !== peg$FAILED) {
            peg$parse_();
            s4 = peg$parseExpr();
            if (s4 !== peg$FAILED) {
              peg$parse_();
              if (input.charCodeAt(peg$currPos) === 41) {
                s6 = peg$c31;
                peg$currPos++;
              } else {
                s6 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e36); }
              }
              if (s6 !== peg$FAILED) {
                s7 = peg$parse__();
                if (s7 !== peg$FAILED) {
                  s8 = peg$parseFalseCase();
                  if (s8 !== peg$FAILED) {
                    s9 = peg$parse__();
                    if (s9 !== peg$FAILED) {
                      s10 = peg$parseTrueCase();
                      if (s10 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s0 = peg$f15(s4, s8, s10);
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 63) {
            s1 = peg$c41;
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e46); }
          }
          if (s1 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 40) {
              s2 = peg$c29;
              peg$currPos++;
            } else {
              s2 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e34); }
            }
            if (s2 !== peg$FAILED) {
              peg$parse_();
              s4 = peg$parseExpr();
              if (s4 !== peg$FAILED) {
                peg$parse_();
                if (input.charCodeAt(peg$currPos) === 41) {
                  s6 = peg$c31;
                  peg$currPos++;
                } else {
                  s6 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$e36); }
                }
                if (s6 !== peg$FAILED) {
                  s7 = peg$parse__();
                  if (s7 !== peg$FAILED) {
                    s8 = peg$parseTrueCase();
                    if (s8 !== peg$FAILED) {
                      peg$savedPos = s0;
                      s0 = peg$f16(s4, s8);
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 63) {
              s1 = peg$c41;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e46); }
            }
            if (s1 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 40) {
                s2 = peg$c29;
                peg$currPos++;
              } else {
                s2 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e34); }
              }
              if (s2 !== peg$FAILED) {
                peg$parse_();
                s4 = peg$parseExpr();
                if (s4 !== peg$FAILED) {
                  peg$parse_();
                  if (input.charCodeAt(peg$currPos) === 41) {
                    s6 = peg$c31;
                    peg$currPos++;
                  } else {
                    s6 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$e36); }
                  }
                  if (s6 !== peg$FAILED) {
                    s7 = peg$parse__();
                    if (s7 !== peg$FAILED) {
                      s8 = peg$parseFalseCase();
                      if (s8 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s0 = peg$f17(s4, s8);
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          }
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Ternary",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Ternary",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseTrueCase() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "TrueCase",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 21;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "TrueCase",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "TrueCase",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 61) {
        s1 = peg$c42;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e47); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__s();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseExpr();
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f18(s3);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "TrueCase",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "TrueCase",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseFalseCase() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "FalseCase",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 22;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "FalseCase",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "FalseCase",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 58) {
        s1 = peg$c30;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e35); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__s();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseExpr();
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f18(s3);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "FalseCase",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "FalseCase",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseNullCoalesce() {
      var startPos = peg$currPos;
      var s0, s1, s2, s4, s5, s6, s7, s8, s10;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "NullCoalesce",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 23;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "NullCoalesce",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "NullCoalesce",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c43) {
        s1 = peg$c43;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e48); }
      }
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 40) {
          s2 = peg$c29;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e34); }
        }
        if (s2 !== peg$FAILED) {
          peg$parse_();
          s4 = peg$parseExpr();
          if (s4 !== peg$FAILED) {
            s5 = peg$parse__();
            if (s5 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 58) {
                s6 = peg$c30;
                peg$currPos++;
              } else {
                s6 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e35); }
              }
              if (s6 !== peg$FAILED) {
                s7 = peg$parse__();
                if (s7 !== peg$FAILED) {
                  s8 = peg$parseExpr();
                  if (s8 !== peg$FAILED) {
                    peg$parse_();
                    if (input.charCodeAt(peg$currPos) === 41) {
                      s10 = peg$c31;
                      peg$currPos++;
                    } else {
                      s10 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$e36); }
                    }
                    if (s10 !== peg$FAILED) {
                      peg$savedPos = s0;
                      s0 = peg$f19(s4, s8);
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "NullCoalesce",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "NullCoalesce",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseThrow() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Throw",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 24;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Throw",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Throw",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 5) === peg$c44) {
        s1 = peg$c44;
        peg$currPos += 5;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e49); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__s();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseExpr();
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f20(s3);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Throw",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Throw",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseSafeguard() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Safeguard",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 25;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Safeguard",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Safeguard",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 9) === peg$c45) {
        s1 = peg$c45;
        peg$currPos += 9;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e50); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__s();
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 5) === peg$c34) {
            s3 = peg$c34;
            peg$currPos += 5;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e39); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__s();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseExpr();
              if (s5 !== peg$FAILED) {
                s6 = peg$parse__s();
                if (s6 !== peg$FAILED) {
                  if (input.charCodeAt(peg$currPos) === 123) {
                    s7 = peg$c3;
                    peg$currPos++;
                  } else {
                    s7 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$e7); }
                  }
                  if (s7 !== peg$FAILED) {
                    s8 = peg$currPos;
                    s9 = peg$parse_l();
                    if (s9 !== peg$FAILED) {
                      s10 = peg$parseExprs();
                      if (s10 !== peg$FAILED) {
                        s9 = [s9, s10];
                        s8 = s9;
                      } else {
                        peg$currPos = s8;
                        s8 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s8;
                      s8 = peg$FAILED;
                    }
                    if (s8 === peg$FAILED) {
                      s8 = null;
                    }
                    s9 = peg$parse_l();
                    if (s9 !== peg$FAILED) {
                      s10 = peg$parseReturn();
                      if (s10 !== peg$FAILED) {
                        s11 = peg$parse__();
                        if (s11 !== peg$FAILED) {
                          if (input.charCodeAt(peg$currPos) === 125) {
                            s12 = peg$c4;
                            peg$currPos++;
                          } else {
                            s12 = peg$FAILED;
                            if (peg$silentFails === 0) { peg$fail(peg$e8); }
                          }
                          if (s12 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s0 = peg$f21(s5, s8, s10);
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 9) === peg$c45) {
          s1 = peg$c45;
          peg$currPos += 9;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e50); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parse__s();
          if (s2 !== peg$FAILED) {
            s3 = peg$parseExpr();
            if (s3 !== peg$FAILED) {
              s4 = peg$parse__s();
              if (s4 !== peg$FAILED) {
                if (input.charCodeAt(peg$currPos) === 123) {
                  s5 = peg$c3;
                  peg$currPos++;
                } else {
                  s5 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$e7); }
                }
                if (s5 !== peg$FAILED) {
                  s6 = peg$currPos;
                  s7 = peg$parse_l();
                  if (s7 !== peg$FAILED) {
                    s8 = peg$parseExprs();
                    if (s8 !== peg$FAILED) {
                      s7 = [s7, s8];
                      s6 = s7;
                    } else {
                      peg$currPos = s6;
                      s6 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s6;
                    s6 = peg$FAILED;
                  }
                  if (s6 === peg$FAILED) {
                    s6 = null;
                  }
                  s7 = peg$parse_l();
                  if (s7 !== peg$FAILED) {
                    s8 = peg$parseReturn();
                    if (s8 !== peg$FAILED) {
                      s9 = peg$parse__();
                      if (s9 !== peg$FAILED) {
                        if (input.charCodeAt(peg$currPos) === 125) {
                          s10 = peg$c4;
                          peg$currPos++;
                        } else {
                          s10 = peg$FAILED;
                          if (peg$silentFails === 0) { peg$fail(peg$e8); }
                        }
                        if (s10 !== peg$FAILED) {
                          peg$savedPos = s0;
                          s0 = peg$f22(s3, s6, s8);
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 10) === peg$c46) {
            s1 = peg$c46;
            peg$currPos += 10;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e51); }
          }
          if (s1 !== peg$FAILED) {
            s2 = peg$parse__s();
            if (s2 !== peg$FAILED) {
              if (input.substr(peg$currPos, 5) === peg$c34) {
                s3 = peg$c34;
                peg$currPos += 5;
              } else {
                s3 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e39); }
              }
              if (s3 !== peg$FAILED) {
                s4 = peg$parse__s();
                if (s4 !== peg$FAILED) {
                  s5 = peg$parseExpr();
                  if (s5 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s0 = peg$f23(s5);
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.substr(peg$currPos, 10) === peg$c46) {
              s1 = peg$c46;
              peg$currPos += 10;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e51); }
            }
            if (s1 !== peg$FAILED) {
              s2 = peg$parse__s();
              if (s2 !== peg$FAILED) {
                s3 = peg$parseExpr();
                if (s3 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s0 = peg$f24(s3);
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          }
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Safeguard",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Safeguard",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseTry() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Try",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 26;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Try",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Try",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 3) === peg$c47) {
        s1 = peg$c47;
        peg$currPos += 3;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e52); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__s();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 123) {
            s3 = peg$c3;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e7); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_l();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseExprs();
              if (s5 !== peg$FAILED) {
                s6 = peg$parse_l();
                if (s6 !== peg$FAILED) {
                  s7 = peg$parseCatch();
                  if (s7 !== peg$FAILED) {
                    s8 = peg$parse_l();
                    if (s8 !== peg$FAILED) {
                      s9 = peg$currPos;
                      s10 = peg$parseFinally();
                      if (s10 !== peg$FAILED) {
                        s11 = peg$parse_l();
                        if (s11 !== peg$FAILED) {
                          s10 = [s10, s11];
                          s9 = s10;
                        } else {
                          peg$currPos = s9;
                          s9 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s9;
                        s9 = peg$FAILED;
                      }
                      if (s9 === peg$FAILED) {
                        s9 = null;
                      }
                      if (input.charCodeAt(peg$currPos) === 125) {
                        s10 = peg$c4;
                        peg$currPos++;
                      } else {
                        s10 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$e8); }
                      }
                      if (s10 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s0 = peg$f25(s5, s7, s9);
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Try",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Try",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseCatch() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Catch",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 27;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Catch",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Catch",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 6) === peg$c48) {
        s1 = peg$c48;
        peg$currPos += 6;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e53); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__s();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseWord();
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__s();
            if (s4 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 123) {
                s5 = peg$c3;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e7); }
              }
              if (s5 !== peg$FAILED) {
                s6 = peg$parse_l();
                if (s6 !== peg$FAILED) {
                  s7 = peg$parseExprs();
                  if (s7 !== peg$FAILED) {
                    s8 = peg$parse_l();
                    if (s8 !== peg$FAILED) {
                      if (input.charCodeAt(peg$currPos) === 125) {
                        s9 = peg$c4;
                        peg$currPos++;
                      } else {
                        s9 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$e8); }
                      }
                      if (s9 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s0 = peg$f26(s3, s7);
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Catch",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Catch",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseFinally() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5, s6, s7;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Finally",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 28;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Finally",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Finally",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 8) === peg$c49) {
        s1 = peg$c49;
        peg$currPos += 8;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e54); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__s();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 123) {
            s3 = peg$c3;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e7); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_l();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseExprs();
              if (s5 !== peg$FAILED) {
                s6 = peg$parse_l();
                if (s6 !== peg$FAILED) {
                  if (input.charCodeAt(peg$currPos) === 125) {
                    s7 = peg$c4;
                    peg$currPos++;
                  } else {
                    s7 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$e8); }
                  }
                  if (s7 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s0 = peg$f27(s5);
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Finally",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Finally",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseImport() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Import",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 29;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Import",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Import",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$currPos;
      s2 = peg$currPos;
      if (input.substr(peg$currPos, 6) === peg$c50) {
        s3 = peg$c50;
        peg$currPos += 6;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e55); }
      }
      if (s3 !== peg$FAILED) {
        s4 = peg$parse__s();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseWord();
          if (s5 !== peg$FAILED) {
            s6 = peg$currPos;
            s7 = peg$parse_();
            if (input.charCodeAt(peg$currPos) === 44) {
              s8 = peg$c51;
              peg$currPos++;
            } else {
              s8 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e56); }
            }
            if (s8 !== peg$FAILED) {
              s9 = peg$parse__s();
              if (s9 !== peg$FAILED) {
                s10 = peg$parseDestruct();
                if (s10 !== peg$FAILED) {
                  s7 = [s7, s8, s9, s10];
                  s6 = s7;
                } else {
                  peg$currPos = s6;
                  s6 = peg$FAILED;
                }
              } else {
                peg$currPos = s6;
                s6 = peg$FAILED;
              }
            } else {
              peg$currPos = s6;
              s6 = peg$FAILED;
            }
            if (s6 === peg$FAILED) {
              s6 = null;
            }
            s7 = peg$parse__s();
            if (s7 !== peg$FAILED) {
              if (input.substr(peg$currPos, 4) === peg$c52) {
                s8 = peg$c52;
                peg$currPos += 4;
              } else {
                s8 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e57); }
              }
              if (s8 !== peg$FAILED) {
                s9 = peg$parse__s();
                if (s9 !== peg$FAILED) {
                  s10 = peg$parseString();
                  if (s10 !== peg$FAILED) {
                    s3 = [s3, s4, s5, s6, s7, s8, s9, s10];
                    s2 = s3;
                  } else {
                    peg$currPos = s2;
                    s2 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s2;
                  s2 = peg$FAILED;
                }
              } else {
                peg$currPos = s2;
                s2 = peg$FAILED;
              }
            } else {
              peg$currPos = s2;
              s2 = peg$FAILED;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = input.substring(s1, peg$currPos);
      } else {
        s1 = s2;
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$f28(s1);
      }
      s0 = s1;
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$currPos;
        s2 = peg$currPos;
        if (input.substr(peg$currPos, 6) === peg$c50) {
          s3 = peg$c50;
          peg$currPos += 6;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e55); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parse__s();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseDestruct();
            if (s5 !== peg$FAILED) {
              s6 = peg$parse__s();
              if (s6 !== peg$FAILED) {
                if (input.substr(peg$currPos, 4) === peg$c52) {
                  s7 = peg$c52;
                  peg$currPos += 4;
                } else {
                  s7 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$e57); }
                }
                if (s7 !== peg$FAILED) {
                  s8 = peg$parse__s();
                  if (s8 !== peg$FAILED) {
                    s9 = peg$parseString();
                    if (s9 !== peg$FAILED) {
                      s3 = [s3, s4, s5, s6, s7, s8, s9];
                      s2 = s3;
                    } else {
                      peg$currPos = s2;
                      s2 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s2;
                    s2 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s2;
                  s2 = peg$FAILED;
                }
              } else {
                peg$currPos = s2;
                s2 = peg$FAILED;
              }
            } else {
              peg$currPos = s2;
              s2 = peg$FAILED;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
        if (s2 !== peg$FAILED) {
          s1 = input.substring(s1, peg$currPos);
        } else {
          s1 = s2;
        }
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$f28(s1);
        }
        s0 = s1;
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          s1 = peg$currPos;
          s2 = peg$currPos;
          if (input.substr(peg$currPos, 6) === peg$c50) {
            s3 = peg$c50;
            peg$currPos += 6;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e55); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__s();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseString();
              if (s5 !== peg$FAILED) {
                s3 = [s3, s4, s5];
                s2 = s3;
              } else {
                peg$currPos = s2;
                s2 = peg$FAILED;
              }
            } else {
              peg$currPos = s2;
              s2 = peg$FAILED;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
          if (s2 !== peg$FAILED) {
            s1 = input.substring(s1, peg$currPos);
          } else {
            s1 = s2;
          }
          if (s1 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$f28(s1);
          }
          s0 = s1;
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            s1 = peg$currPos;
            s2 = peg$currPos;
            if (input.substr(peg$currPos, 6) === peg$c50) {
              s3 = peg$c50;
              peg$currPos += 6;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e55); }
            }
            if (s3 !== peg$FAILED) {
              s4 = peg$parse__s();
              if (s4 !== peg$FAILED) {
                if (input.charCodeAt(peg$currPos) === 42) {
                  s5 = peg$c15;
                  peg$currPos++;
                } else {
                  s5 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$e19); }
                }
                if (s5 !== peg$FAILED) {
                  s6 = peg$parse__s();
                  if (s6 !== peg$FAILED) {
                    if (input.substr(peg$currPos, 2) === peg$c53) {
                      s7 = peg$c53;
                      peg$currPos += 2;
                    } else {
                      s7 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$e58); }
                    }
                    if (s7 !== peg$FAILED) {
                      s8 = peg$parse__s();
                      if (s8 !== peg$FAILED) {
                        s9 = peg$parseWord();
                        if (s9 !== peg$FAILED) {
                          s10 = peg$parse__s();
                          if (s10 !== peg$FAILED) {
                            if (input.substr(peg$currPos, 4) === peg$c52) {
                              s11 = peg$c52;
                              peg$currPos += 4;
                            } else {
                              s11 = peg$FAILED;
                              if (peg$silentFails === 0) { peg$fail(peg$e57); }
                            }
                            if (s11 !== peg$FAILED) {
                              s12 = peg$parse__s();
                              if (s12 !== peg$FAILED) {
                                s13 = peg$parseString();
                                if (s13 !== peg$FAILED) {
                                  s3 = [s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13];
                                  s2 = s3;
                                } else {
                                  peg$currPos = s2;
                                  s2 = peg$FAILED;
                                }
                              } else {
                                peg$currPos = s2;
                                s2 = peg$FAILED;
                              }
                            } else {
                              peg$currPos = s2;
                              s2 = peg$FAILED;
                            }
                          } else {
                            peg$currPos = s2;
                            s2 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s2;
                          s2 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s2;
                        s2 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s2;
                      s2 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s2;
                    s2 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s2;
                  s2 = peg$FAILED;
                }
              } else {
                peg$currPos = s2;
                s2 = peg$FAILED;
              }
            } else {
              peg$currPos = s2;
              s2 = peg$FAILED;
            }
            if (s2 !== peg$FAILED) {
              s1 = input.substring(s1, peg$currPos);
            } else {
              s1 = s2;
            }
            if (s1 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$f28(s1);
            }
            s0 = s1;
          }
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Import",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Import",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseExport() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Export",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 30;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Export",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Export",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 6) === peg$c54) {
        s1 = peg$c54;
        peg$currPos += 6;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e59); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__s();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseVariableDecl();
          if (s3 === peg$FAILED) {
            s3 = peg$parseFunctionDecl();
          }
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f29(s3);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 6) === peg$c54) {
          s1 = peg$c54;
          peg$currPos += 6;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e59); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parse__s();
          if (s2 !== peg$FAILED) {
            s3 = peg$parseMultiExport();
            if (s3 !== peg$FAILED) {
              peg$savedPos = s0;
              s0 = peg$f30(s3);
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 6) === peg$c54) {
            s1 = peg$c54;
            peg$currPos += 6;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e59); }
          }
          if (s1 !== peg$FAILED) {
            s2 = peg$parse__s();
            if (s2 !== peg$FAILED) {
              if (input.substr(peg$currPos, 7) === peg$c55) {
                s3 = peg$c55;
                peg$currPos += 7;
              } else {
                s3 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e60); }
              }
              if (s3 !== peg$FAILED) {
                s4 = peg$parse__s();
                if (s4 !== peg$FAILED) {
                  s5 = peg$parseExpr();
                  if (s5 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s0 = peg$f31(s5);
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Export",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Export",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseMultiExport() {
      var startPos = peg$currPos;
      var s0, s1, s3, s4, s5, s6, s7;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "MultiExport",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 31;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "MultiExport",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "MultiExport",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 123) {
        s1 = peg$c3;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e7); }
      }
      if (s1 !== peg$FAILED) {
        peg$parse_();
        s3 = peg$parseExportItem();
        if (s3 !== peg$FAILED) {
          s4 = [];
          s5 = peg$currPos;
          s6 = peg$parse_i();
          if (s6 !== peg$FAILED) {
            s7 = peg$parseExportItem();
            if (s7 !== peg$FAILED) {
              s6 = [s6, s7];
              s5 = s6;
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
          } else {
            peg$currPos = s5;
            s5 = peg$FAILED;
          }
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            s5 = peg$currPos;
            s6 = peg$parse_i();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseExportItem();
              if (s7 !== peg$FAILED) {
                s6 = [s6, s7];
                s5 = s6;
              } else {
                peg$currPos = s5;
                s5 = peg$FAILED;
              }
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
          }
          s5 = peg$parse_();
          if (input.charCodeAt(peg$currPos) === 125) {
            s6 = peg$c4;
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e8); }
          }
          if (s6 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f32(s3, s4);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "MultiExport",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "MultiExport",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseExportItem() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "ExportItem",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 32;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "ExportItem",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "ExportItem",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$parseVar();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__s();
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 2) === peg$c53) {
            s3 = peg$c53;
            peg$currPos += 2;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e58); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__s();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseVar();
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f33(s1, s5);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseVar();
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$f34(s1);
        }
        s0 = s1;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "ExportItem",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "ExportItem",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseVariableCreation() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "VariableCreation",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 33;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "VariableCreation",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "VariableCreation",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$parseVar();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__s();
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 2) === peg$c56) {
            s3 = peg$c56;
            peg$currPos += 2;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e61); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__s();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseExpr();
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f35(s1, s5);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "VariableCreation",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "VariableCreation",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseVariableDestruct() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "VariableDestruct",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 34;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "VariableDestruct",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "VariableDestruct",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$parseExpr();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__s();
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 2) === peg$c57) {
            s3 = peg$c57;
            peg$currPos += 2;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e62); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__s();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseObjDest();
              if (s5 === peg$FAILED) {
                s5 = peg$parseArrayDest();
              }
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f36(s1, s5);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "VariableDestruct",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "VariableDestruct",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseVariableDecl() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5, s6, s7;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "VariableDecl",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 35;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "VariableDecl",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "VariableDecl",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      peg$silentFails++;
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 3) === peg$c58) {
        s1 = peg$c58;
        peg$currPos += 3;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e64); }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 3) === peg$c59) {
          s1 = peg$c59;
          peg$currPos += 3;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e65); }
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__s();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseVar();
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__s();
            if (s4 !== peg$FAILED) {
              if (input.substr(peg$currPos, 2) === peg$c56) {
                s5 = peg$c56;
                peg$currPos += 2;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e61); }
              }
              if (s5 !== peg$FAILED) {
                s6 = peg$parse__s();
                if (s6 !== peg$FAILED) {
                  s7 = peg$parseSafeguard();
                  if (s7 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s0 = peg$f37(s1, s3, s7);
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 3) === peg$c58) {
          s1 = peg$c58;
          peg$currPos += 3;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e64); }
        }
        if (s1 === peg$FAILED) {
          if (input.substr(peg$currPos, 3) === peg$c59) {
            s1 = peg$c59;
            peg$currPos += 3;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e65); }
          }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parse__s();
          if (s2 !== peg$FAILED) {
            s3 = peg$parseObjDest();
            if (s3 === peg$FAILED) {
              s3 = peg$parseArrayDest();
            }
            if (s3 !== peg$FAILED) {
              s4 = peg$parse__s();
              if (s4 !== peg$FAILED) {
                if (input.substr(peg$currPos, 2) === peg$c56) {
                  s5 = peg$c56;
                  peg$currPos += 2;
                } else {
                  s5 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$e61); }
                }
                if (s5 !== peg$FAILED) {
                  s6 = peg$parse__s();
                  if (s6 !== peg$FAILED) {
                    s7 = peg$parseSafeguard();
                    if (s7 !== peg$FAILED) {
                      peg$savedPos = s0;
                      s0 = peg$f38(s1, s3, s7);
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 3) === peg$c58) {
            s1 = peg$c58;
            peg$currPos += 3;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e64); }
          }
          if (s1 === peg$FAILED) {
            if (input.substr(peg$currPos, 3) === peg$c59) {
              s1 = peg$c59;
              peg$currPos += 3;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e65); }
            }
          }
          if (s1 !== peg$FAILED) {
            s2 = peg$parse__s();
            if (s2 !== peg$FAILED) {
              s3 = peg$parseVariableCreation();
              if (s3 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f39(s1, s3);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.substr(peg$currPos, 3) === peg$c58) {
              s1 = peg$c58;
              peg$currPos += 3;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e64); }
            }
            if (s1 === peg$FAILED) {
              if (input.substr(peg$currPos, 3) === peg$c59) {
                s1 = peg$c59;
                peg$currPos += 3;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e65); }
              }
            }
            if (s1 !== peg$FAILED) {
              s2 = peg$parse__s();
              if (s2 !== peg$FAILED) {
                s3 = peg$parseVariableDestruct();
                if (s3 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s0 = peg$f40(s1, s3);
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              if (input.substr(peg$currPos, 3) === peg$c58) {
                s1 = peg$c58;
                peg$currPos += 3;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e64); }
              }
              if (s1 === peg$FAILED) {
                if (input.substr(peg$currPos, 3) === peg$c59) {
                  s1 = peg$c59;
                  peg$currPos += 3;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$e65); }
                }
              }
              if (s1 !== peg$FAILED) {
                s2 = peg$parse__s();
                if (s2 !== peg$FAILED) {
                  s3 = peg$parseObjDest();
                  if (s3 === peg$FAILED) {
                    s3 = peg$parseArrayDest();
                  }
                  if (s3 !== peg$FAILED) {
                    s4 = peg$parse__s();
                    if (s4 !== peg$FAILED) {
                      if (input.substr(peg$currPos, 2) === peg$c56) {
                        s5 = peg$c56;
                        peg$currPos += 2;
                      } else {
                        s5 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$e61); }
                      }
                      if (s5 !== peg$FAILED) {
                        s6 = peg$parse__s();
                        if (s6 !== peg$FAILED) {
                          s7 = peg$parseExpr();
                          if (s7 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s0 = peg$f41(s1, s3, s7);
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            }
          }
        }
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e63); }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "VariableDecl",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "VariableDecl",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseDestruct() {
      var startPos = peg$currPos;
      var s0, s1, s3, s4, s5, s6, s7;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Destruct",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 36;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Destruct",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Destruct",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 123) {
        s1 = peg$c3;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e7); }
      }
      if (s1 !== peg$FAILED) {
        peg$parse_();
        s3 = peg$parseAs();
        if (s3 === peg$FAILED) {
          s3 = peg$parseVar();
        }
        if (s3 !== peg$FAILED) {
          s4 = [];
          s5 = peg$currPos;
          s6 = peg$parse_i();
          if (s6 !== peg$FAILED) {
            s7 = peg$parseAs();
            if (s7 === peg$FAILED) {
              s7 = peg$parseVar();
            }
            if (s7 !== peg$FAILED) {
              s6 = [s6, s7];
              s5 = s6;
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
          } else {
            peg$currPos = s5;
            s5 = peg$FAILED;
          }
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            s5 = peg$currPos;
            s6 = peg$parse_i();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseAs();
              if (s7 === peg$FAILED) {
                s7 = peg$parseVar();
              }
              if (s7 !== peg$FAILED) {
                s6 = [s6, s7];
                s5 = s6;
              } else {
                peg$currPos = s5;
                s5 = peg$FAILED;
              }
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
          }
          s5 = peg$currPos;
          s6 = peg$parse_i();
          if (s6 !== peg$FAILED) {
            s7 = peg$parseSpread();
            if (s7 !== peg$FAILED) {
              s6 = [s6, s7];
              s5 = s6;
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
          } else {
            peg$currPos = s5;
            s5 = peg$FAILED;
          }
          if (s5 === peg$FAILED) {
            s5 = null;
          }
          s6 = peg$parse_();
          if (input.charCodeAt(peg$currPos) === 125) {
            s7 = peg$c4;
            peg$currPos++;
          } else {
            s7 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e8); }
          }
          if (s7 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f42(s3, s4, s5);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Destruct",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Destruct",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseAs() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "As",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 37;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "As",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "As",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$parseWord();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__s();
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 2) === peg$c53) {
            s3 = peg$c53;
            peg$currPos += 2;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e58); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__s();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseWord();
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f43(s1, s5);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "As",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "As",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseObjDest() {
      var startPos = peg$currPos;
      var s0, s1, s3, s4, s5, s6, s7;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "ObjDest",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 38;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "ObjDest",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "ObjDest",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 123) {
        s1 = peg$c3;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e7); }
      }
      if (s1 !== peg$FAILED) {
        peg$parse_();
        s3 = peg$parseObjDestructEntry();
        if (s3 !== peg$FAILED) {
          s4 = [];
          s5 = peg$currPos;
          s6 = peg$parse_i();
          if (s6 !== peg$FAILED) {
            s7 = peg$parseObjDestructEntry();
            if (s7 !== peg$FAILED) {
              s6 = [s6, s7];
              s5 = s6;
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
          } else {
            peg$currPos = s5;
            s5 = peg$FAILED;
          }
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            s5 = peg$currPos;
            s6 = peg$parse_i();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseObjDestructEntry();
              if (s7 !== peg$FAILED) {
                s6 = [s6, s7];
                s5 = s6;
              } else {
                peg$currPos = s5;
                s5 = peg$FAILED;
              }
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
          }
          s5 = peg$currPos;
          s6 = peg$parse_i();
          if (s6 !== peg$FAILED) {
            s7 = peg$parseSpread();
            if (s7 !== peg$FAILED) {
              s6 = [s6, s7];
              s5 = s6;
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
          } else {
            peg$currPos = s5;
            s5 = peg$FAILED;
          }
          if (s5 === peg$FAILED) {
            s5 = null;
          }
          s6 = peg$parse_();
          if (input.charCodeAt(peg$currPos) === 125) {
            s7 = peg$c4;
            peg$currPos++;
          } else {
            s7 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e8); }
          }
          if (s7 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f42(s3, s4, s5);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "ObjDest",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "ObjDest",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseObjDestructEntry() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "ObjDestructEntry",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 39;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "ObjDestructEntry",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "ObjDestructEntry",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$parseAs();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__s();
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 2) === peg$c56) {
            s3 = peg$c56;
            peg$currPos += 2;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e61); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__s();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseExpr();
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f44(s1, s5);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseVar();
        if (s1 !== peg$FAILED) {
          s2 = peg$parse__s();
          if (s2 !== peg$FAILED) {
            if (input.substr(peg$currPos, 2) === peg$c56) {
              s3 = peg$c56;
              peg$currPos += 2;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e61); }
            }
            if (s3 !== peg$FAILED) {
              s4 = peg$parse__s();
              if (s4 !== peg$FAILED) {
                s5 = peg$parseExpr();
                if (s5 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s0 = peg$f44(s1, s5);
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$parseAs();
          if (s0 === peg$FAILED) {
            s0 = peg$parseVar();
          }
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "ObjDestructEntry",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "ObjDestructEntry",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseArrayDest() {
      var startPos = peg$currPos;
      var s0, s1, s3, s4, s5, s6, s7;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "ArrayDest",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 40;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "ArrayDest",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "ArrayDest",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 91) {
        s1 = peg$c60;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e66); }
      }
      if (s1 !== peg$FAILED) {
        peg$parse_();
        s3 = peg$parseArrayDestructEntry();
        if (s3 !== peg$FAILED) {
          s4 = [];
          s5 = peg$currPos;
          s6 = peg$parse_i();
          if (s6 !== peg$FAILED) {
            s7 = peg$parseArrayDestructEntry();
            if (s7 !== peg$FAILED) {
              s6 = [s6, s7];
              s5 = s6;
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
          } else {
            peg$currPos = s5;
            s5 = peg$FAILED;
          }
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            s5 = peg$currPos;
            s6 = peg$parse_i();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseArrayDestructEntry();
              if (s7 !== peg$FAILED) {
                s6 = [s6, s7];
                s5 = s6;
              } else {
                peg$currPos = s5;
                s5 = peg$FAILED;
              }
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
          }
          s5 = peg$currPos;
          s6 = peg$parse_i();
          if (s6 !== peg$FAILED) {
            s7 = peg$parseSpread();
            if (s7 !== peg$FAILED) {
              s6 = [s6, s7];
              s5 = s6;
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
          } else {
            peg$currPos = s5;
            s5 = peg$FAILED;
          }
          if (s5 === peg$FAILED) {
            s5 = null;
          }
          s6 = peg$parse_();
          if (input.charCodeAt(peg$currPos) === 93) {
            s7 = peg$c61;
            peg$currPos++;
          } else {
            s7 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e67); }
          }
          if (s7 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f45(s3, s4, s5);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "ArrayDest",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "ArrayDest",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseArrayDestructEntry() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "ArrayDestructEntry",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 41;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "ArrayDestructEntry",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "ArrayDestructEntry",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$parseVar();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__s();
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 2) === peg$c56) {
            s3 = peg$c56;
            peg$currPos += 2;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e61); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__s();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseExpr();
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f44(s1, s5);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseVar();
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "ArrayDestructEntry",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "ArrayDestructEntry",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseFunctionDecl() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "FunctionDecl",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 42;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "FunctionDecl",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "FunctionDecl",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      peg$silentFails++;
      s0 = peg$currPos;
      s1 = peg$currPos;
      if (input.substr(peg$currPos, 5) === peg$c62) {
        s2 = peg$c62;
        peg$currPos += 5;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e69); }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parse__s();
        if (s3 !== peg$FAILED) {
          s2 = [s2, s3];
          s1 = s2;
        } else {
          peg$currPos = s1;
          s1 = peg$FAILED;
        }
      } else {
        peg$currPos = s1;
        s1 = peg$FAILED;
      }
      if (s1 === peg$FAILED) {
        s1 = null;
      }
      if (input.substr(peg$currPos, 2) === peg$c63) {
        s2 = peg$c63;
        peg$currPos += 2;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e70); }
      }
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 42) {
          s3 = peg$c15;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e19); }
        }
        if (s3 === peg$FAILED) {
          s3 = null;
        }
        s4 = peg$parse__();
        if (s4 !== peg$FAILED) {
          s5 = peg$currPos;
          s6 = peg$parseWord();
          if (s6 !== peg$FAILED) {
            s7 = peg$parse__();
            if (s7 !== peg$FAILED) {
              s6 = [s6, s7];
              s5 = s6;
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
          } else {
            peg$currPos = s5;
            s5 = peg$FAILED;
          }
          if (s5 === peg$FAILED) {
            s5 = null;
          }
          if (input.charCodeAt(peg$currPos) === 123) {
            s6 = peg$c3;
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e7); }
          }
          if (s6 !== peg$FAILED) {
            s7 = peg$parseArgList();
            if (s7 === peg$FAILED) {
              s7 = null;
            }
            s8 = peg$currPos;
            s9 = peg$parse_l();
            if (s9 !== peg$FAILED) {
              s10 = peg$parseExprs();
              if (s10 !== peg$FAILED) {
                s9 = [s9, s10];
                s8 = s9;
              } else {
                peg$currPos = s8;
                s8 = peg$FAILED;
              }
            } else {
              peg$currPos = s8;
              s8 = peg$FAILED;
            }
            if (s8 === peg$FAILED) {
              s8 = null;
            }
            s9 = peg$currPos;
            s10 = peg$parse_l();
            if (s10 !== peg$FAILED) {
              s11 = peg$parseReturn();
              if (s11 !== peg$FAILED) {
                s10 = [s10, s11];
                s9 = s10;
              } else {
                peg$currPos = s9;
                s9 = peg$FAILED;
              }
            } else {
              peg$currPos = s9;
              s9 = peg$FAILED;
            }
            if (s9 === peg$FAILED) {
              s9 = null;
            }
            s10 = peg$parse__();
            if (s10 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 125) {
                s11 = peg$c4;
                peg$currPos++;
              } else {
                s11 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e8); }
              }
              if (s11 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f46(s1, s3, s5, s7, s8, s9);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$currPos;
        if (input.substr(peg$currPos, 5) === peg$c62) {
          s2 = peg$c62;
          peg$currPos += 5;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e69); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse__s();
          if (s3 !== peg$FAILED) {
            s2 = [s2, s3];
            s1 = s2;
          } else {
            peg$currPos = s1;
            s1 = peg$FAILED;
          }
        } else {
          peg$currPos = s1;
          s1 = peg$FAILED;
        }
        if (s1 === peg$FAILED) {
          s1 = null;
        }
        if (input.substr(peg$currPos, 2) === peg$c63) {
          s2 = peg$c63;
          peg$currPos += 2;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e70); }
        }
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 42) {
            s3 = peg$c15;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e19); }
          }
          if (s3 === peg$FAILED) {
            s3 = null;
          }
          s4 = peg$parseShortArgList();
          if (s4 === peg$FAILED) {
            s4 = null;
          }
          s5 = peg$parse__();
          if (s5 !== peg$FAILED) {
            if (input.substr(peg$currPos, 2) === peg$c64) {
              s6 = peg$c64;
              peg$currPos += 2;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e71); }
            }
            if (s6 !== peg$FAILED) {
              s7 = peg$parse__();
              if (s7 !== peg$FAILED) {
                s8 = peg$parseExpr();
                if (s8 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s0 = peg$f47(s1, s3, s4, s8);
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e68); }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "FunctionDecl",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "FunctionDecl",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseArgList() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "ArgList",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 43;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "ArgList",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "ArgList",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = [];
      s2 = peg$currPos;
      s3 = peg$parse_l();
      if (s3 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 64) {
          s4 = peg$c65;
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e72); }
        }
        if (s4 !== peg$FAILED) {
          s5 = peg$parseVariableCreation();
          if (s5 === peg$FAILED) {
            s5 = peg$parseVariableDestruct();
            if (s5 === peg$FAILED) {
              s5 = peg$parseVar();
            }
          }
          if (s5 !== peg$FAILED) {
            s3 = [s3, s4, s5];
            s2 = s3;
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          s2 = peg$currPos;
          s3 = peg$parse_l();
          if (s3 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 64) {
              s4 = peg$c65;
              peg$currPos++;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e72); }
            }
            if (s4 !== peg$FAILED) {
              s5 = peg$parseVariableCreation();
              if (s5 === peg$FAILED) {
                s5 = peg$parseVariableDestruct();
                if (s5 === peg$FAILED) {
                  s5 = peg$parseVar();
                }
              }
              if (s5 !== peg$FAILED) {
                s3 = [s3, s4, s5];
                s2 = s3;
              } else {
                peg$currPos = s2;
                s2 = peg$FAILED;
              }
            } else {
              peg$currPos = s2;
              s2 = peg$FAILED;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
        }
      } else {
        s1 = peg$FAILED;
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$f48(s1);
      }
      s0 = s1;

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "ArgList",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "ArgList",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseShortArgList() {
      var startPos = peg$currPos;
      var s0, s1, s3, s4, s5, s6, s7, s8;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "ShortArgList",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 44;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "ShortArgList",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "ShortArgList",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 123) {
        s1 = peg$c3;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e7); }
      }
      if (s1 !== peg$FAILED) {
        peg$parse_();
        s3 = peg$parseVar();
        if (s3 !== peg$FAILED) {
          s4 = [];
          s5 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 44) {
            s6 = peg$c51;
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e56); }
          }
          if (s6 !== peg$FAILED) {
            s7 = peg$parse_();
            s8 = peg$parseVar();
            if (s8 !== peg$FAILED) {
              s6 = [s6, s7, s8];
              s5 = s6;
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
          } else {
            peg$currPos = s5;
            s5 = peg$FAILED;
          }
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            s5 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 44) {
              s6 = peg$c51;
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e56); }
            }
            if (s6 !== peg$FAILED) {
              s7 = peg$parse_();
              s8 = peg$parseVar();
              if (s8 !== peg$FAILED) {
                s6 = [s6, s7, s8];
                s5 = s6;
              } else {
                peg$currPos = s5;
                s5 = peg$FAILED;
              }
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
          }
          s5 = peg$parse_();
          if (input.charCodeAt(peg$currPos) === 125) {
            s6 = peg$c4;
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e8); }
          }
          if (s6 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f49(s3, s4);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "ShortArgList",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "ShortArgList",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseDo() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s5, s6, s7, s9;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Do",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 45;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Do",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Do",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c66) {
        s1 = peg$c66;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e73); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__s();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 123) {
            s3 = peg$c3;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e7); }
          }
          if (s3 !== peg$FAILED) {
            peg$parse_();
            s5 = peg$parseExprs();
            if (s5 !== peg$FAILED) {
              s6 = peg$parse__();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseReturn();
                if (s7 !== peg$FAILED) {
                  peg$parse_();
                  if (input.charCodeAt(peg$currPos) === 125) {
                    s9 = peg$c4;
                    peg$currPos++;
                  } else {
                    s9 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$e8); }
                  }
                  if (s9 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s0 = peg$f50(s5, s7);
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Do",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Do",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseReturn() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Return",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 46;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Return",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Return",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c64) {
        s1 = peg$c64;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e71); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__s();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseExpr();
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f51(s3);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 2) === peg$c64) {
          s1 = peg$c64;
          peg$currPos += 2;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e71); }
        }
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$f52();
        }
        s0 = s1;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Return",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Return",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseIf() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s5, s6, s7, s8, s9, s10, s11;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "If",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 47;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "If",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "If",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c67) {
        s1 = peg$c67;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e74); }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 5) === peg$c68) {
          s1 = peg$c68;
          peg$currPos += 5;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e75); }
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__s();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseLogical();
          if (s3 === peg$FAILED) {
            s3 = peg$parseCompare();
          }
          if (s3 !== peg$FAILED) {
            peg$parse_s();
            if (input.charCodeAt(peg$currPos) === 123) {
              s5 = peg$c3;
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e7); }
            }
            if (s5 !== peg$FAILED) {
              s6 = peg$parse__();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseExprs();
                if (s7 !== peg$FAILED) {
                  s8 = peg$parse_l();
                  if (s8 !== peg$FAILED) {
                    s9 = peg$parseReturn();
                    if (s9 !== peg$FAILED) {
                      s10 = peg$parse__();
                      if (s10 !== peg$FAILED) {
                        if (input.charCodeAt(peg$currPos) === 125) {
                          s11 = peg$c4;
                          peg$currPos++;
                        } else {
                          s11 = peg$FAILED;
                          if (peg$silentFails === 0) { peg$fail(peg$e8); }
                        }
                        if (s11 !== peg$FAILED) {
                          peg$savedPos = s0;
                          s0 = peg$f53(s3, s7, s9);
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 2) === peg$c67) {
          s1 = peg$c67;
          peg$currPos += 2;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e74); }
        }
        if (s1 === peg$FAILED) {
          if (input.substr(peg$currPos, 5) === peg$c68) {
            s1 = peg$c68;
            peg$currPos += 5;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e75); }
          }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parse__s();
          if (s2 !== peg$FAILED) {
            s3 = peg$parseLogical();
            if (s3 === peg$FAILED) {
              s3 = peg$parseCompare();
            }
            if (s3 !== peg$FAILED) {
              peg$parse_s();
              if (input.charCodeAt(peg$currPos) === 123) {
                s5 = peg$c3;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e7); }
              }
              if (s5 !== peg$FAILED) {
                s6 = peg$parse_l();
                if (s6 !== peg$FAILED) {
                  s7 = peg$parseReturn();
                  if (s7 !== peg$FAILED) {
                    s8 = peg$parse__();
                    if (s8 !== peg$FAILED) {
                      if (input.charCodeAt(peg$currPos) === 125) {
                        s9 = peg$c4;
                        peg$currPos++;
                      } else {
                        s9 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$e8); }
                      }
                      if (s9 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s0 = peg$f54(s3, s7);
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "If",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "If",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseFor() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "For",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 48;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "For",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "For",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 3) === peg$c69) {
        s1 = peg$c69;
        peg$currPos += 3;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e76); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$currPos;
        s3 = peg$parse__s();
        if (s3 !== peg$FAILED) {
          if (input.substr(peg$currPos, 5) === peg$c34) {
            s4 = peg$c34;
            peg$currPos += 5;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e39); }
          }
          if (s4 !== peg$FAILED) {
            s3 = [s3, s4];
            s2 = s3;
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
        if (s2 === peg$FAILED) {
          s2 = null;
        }
        s3 = peg$parse__s();
        if (s3 !== peg$FAILED) {
          s4 = peg$parseWord();
          if (s4 !== peg$FAILED) {
            s5 = peg$parse__s();
            if (s5 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 58) {
                s6 = peg$c30;
                peg$currPos++;
              } else {
                s6 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e35); }
              }
              if (s6 !== peg$FAILED) {
                s7 = peg$parse__s();
                if (s7 !== peg$FAILED) {
                  s8 = peg$parseRange();
                  if (s8 !== peg$FAILED) {
                    s9 = peg$parse__s();
                    if (s9 !== peg$FAILED) {
                      if (input.charCodeAt(peg$currPos) === 123) {
                        s10 = peg$c3;
                        peg$currPos++;
                      } else {
                        s10 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$e7); }
                      }
                      if (s10 !== peg$FAILED) {
                        s11 = peg$parse__();
                        if (s11 !== peg$FAILED) {
                          s12 = peg$parseExprs();
                          if (s12 !== peg$FAILED) {
                            s13 = peg$parse__();
                            if (s13 !== peg$FAILED) {
                              if (input.charCodeAt(peg$currPos) === 125) {
                                s14 = peg$c4;
                                peg$currPos++;
                              } else {
                                s14 = peg$FAILED;
                                if (peg$silentFails === 0) { peg$fail(peg$e8); }
                              }
                              if (s14 !== peg$FAILED) {
                                peg$savedPos = s0;
                                s0 = peg$f55(s2, s4, s8, s12);
                              } else {
                                peg$currPos = s0;
                                s0 = peg$FAILED;
                              }
                            } else {
                              peg$currPos = s0;
                              s0 = peg$FAILED;
                            }
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 3) === peg$c69) {
          s1 = peg$c69;
          peg$currPos += 3;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e76); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$currPos;
          s3 = peg$parse__s();
          if (s3 !== peg$FAILED) {
            if (input.substr(peg$currPos, 5) === peg$c34) {
              s4 = peg$c34;
              peg$currPos += 5;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e39); }
            }
            if (s4 !== peg$FAILED) {
              s3 = [s3, s4];
              s2 = s3;
            } else {
              peg$currPos = s2;
              s2 = peg$FAILED;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
          if (s2 === peg$FAILED) {
            s2 = null;
          }
          s3 = peg$parse__s();
          if (s3 !== peg$FAILED) {
            s4 = peg$parseWord();
            if (s4 !== peg$FAILED) {
              s5 = peg$parse__s();
              if (s5 !== peg$FAILED) {
                if (input.charCodeAt(peg$currPos) === 58) {
                  s6 = peg$c30;
                  peg$currPos++;
                } else {
                  s6 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$e35); }
                }
                if (s6 !== peg$FAILED) {
                  s7 = peg$parse__s();
                  if (s7 !== peg$FAILED) {
                    s8 = peg$parseExpr();
                    if (s8 !== peg$FAILED) {
                      s9 = peg$parse__s();
                      if (s9 !== peg$FAILED) {
                        if (input.charCodeAt(peg$currPos) === 123) {
                          s10 = peg$c3;
                          peg$currPos++;
                        } else {
                          s10 = peg$FAILED;
                          if (peg$silentFails === 0) { peg$fail(peg$e7); }
                        }
                        if (s10 !== peg$FAILED) {
                          s11 = peg$parse__();
                          if (s11 !== peg$FAILED) {
                            s12 = peg$parseExprs();
                            if (s12 !== peg$FAILED) {
                              s13 = peg$parse__();
                              if (s13 !== peg$FAILED) {
                                if (input.charCodeAt(peg$currPos) === 125) {
                                  s14 = peg$c4;
                                  peg$currPos++;
                                } else {
                                  s14 = peg$FAILED;
                                  if (peg$silentFails === 0) { peg$fail(peg$e8); }
                                }
                                if (s14 !== peg$FAILED) {
                                  peg$savedPos = s0;
                                  s0 = peg$f56(s2, s4, s8, s12);
                                } else {
                                  peg$currPos = s0;
                                  s0 = peg$FAILED;
                                }
                              } else {
                                peg$currPos = s0;
                                s0 = peg$FAILED;
                              }
                            } else {
                              peg$currPos = s0;
                              s0 = peg$FAILED;
                            }
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 3) === peg$c69) {
            s1 = peg$c69;
            peg$currPos += 3;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e76); }
          }
          if (s1 !== peg$FAILED) {
            s2 = peg$parse__s();
            if (s2 !== peg$FAILED) {
              if (input.substr(peg$currPos, 4) === peg$c70) {
                s3 = peg$c70;
                peg$currPos += 4;
              } else {
                s3 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e77); }
              }
              if (s3 !== peg$FAILED) {
                s4 = peg$parse__s();
                if (s4 !== peg$FAILED) {
                  if (input.charCodeAt(peg$currPos) === 123) {
                    s5 = peg$c3;
                    peg$currPos++;
                  } else {
                    s5 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$e7); }
                  }
                  if (s5 !== peg$FAILED) {
                    s6 = peg$parse__();
                    if (s6 !== peg$FAILED) {
                      s7 = peg$parseExprs();
                      if (s7 !== peg$FAILED) {
                        s8 = peg$parse__();
                        if (s8 !== peg$FAILED) {
                          if (input.charCodeAt(peg$currPos) === 125) {
                            s9 = peg$c4;
                            peg$currPos++;
                          } else {
                            s9 = peg$FAILED;
                            if (peg$silentFails === 0) { peg$fail(peg$e8); }
                          }
                          if (s9 !== peg$FAILED) {
                            peg$savedPos = s0;
                            s0 = peg$f57(s7);
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "For",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "For",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseArray() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s13;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Array",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 49;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Array",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Array",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 91) {
        s1 = peg$c60;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e66); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (input.charCodeAt(peg$currPos) === 93) {
          s3 = peg$c61;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e67); }
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f58();
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 91) {
          s1 = peg$c60;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e66); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parse_();
          s3 = peg$parseExpr();
          if (s3 === peg$FAILED) {
            s3 = peg$parseSpread();
          }
          if (s3 !== peg$FAILED) {
            s4 = [];
            s5 = peg$currPos;
            s6 = peg$parse_i();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseExpr();
              if (s7 === peg$FAILED) {
                s7 = peg$parseSpread();
              }
              if (s7 !== peg$FAILED) {
                s6 = [s6, s7];
                s5 = s6;
              } else {
                peg$currPos = s5;
                s5 = peg$FAILED;
              }
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
            while (s5 !== peg$FAILED) {
              s4.push(s5);
              s5 = peg$currPos;
              s6 = peg$parse_i();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseExpr();
                if (s7 === peg$FAILED) {
                  s7 = peg$parseSpread();
                }
                if (s7 !== peg$FAILED) {
                  s6 = [s6, s7];
                  s5 = s6;
                } else {
                  peg$currPos = s5;
                  s5 = peg$FAILED;
                }
              } else {
                peg$currPos = s5;
                s5 = peg$FAILED;
              }
            }
            s5 = peg$parse_();
            if (input.charCodeAt(peg$currPos) === 93) {
              s6 = peg$c61;
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e67); }
            }
            if (s6 !== peg$FAILED) {
              peg$savedPos = s0;
              s0 = peg$f59(s3, s4);
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 91) {
            s1 = peg$c60;
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e66); }
          }
          if (s1 !== peg$FAILED) {
            s2 = peg$parseRange();
            if (s2 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 93) {
                s3 = peg$c61;
                peg$currPos++;
              } else {
                s3 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e67); }
              }
              if (s3 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f60(s2);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 91) {
              s1 = peg$c60;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e66); }
            }
            if (s1 !== peg$FAILED) {
              s2 = peg$parse_();
              s3 = peg$parseExpr();
              if (s3 !== peg$FAILED) {
                s4 = peg$parse__();
                if (s4 !== peg$FAILED) {
                  if (input.substr(peg$currPos, 4) === peg$c52) {
                    s5 = peg$c52;
                    peg$currPos += 4;
                  } else {
                    s5 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$e57); }
                  }
                  if (s5 !== peg$FAILED) {
                    s6 = peg$parse__s();
                    if (s6 !== peg$FAILED) {
                      s7 = peg$parseWord();
                      if (s7 !== peg$FAILED) {
                        s8 = peg$parse__s();
                        if (s8 !== peg$FAILED) {
                          if (input.charCodeAt(peg$currPos) === 58) {
                            s9 = peg$c30;
                            peg$currPos++;
                          } else {
                            s9 = peg$FAILED;
                            if (peg$silentFails === 0) { peg$fail(peg$e35); }
                          }
                          if (s9 !== peg$FAILED) {
                            s10 = peg$parse__s();
                            if (s10 !== peg$FAILED) {
                              s11 = peg$parseRange();
                              if (s11 !== peg$FAILED) {
                                peg$parse_();
                                if (input.charCodeAt(peg$currPos) === 93) {
                                  s13 = peg$c61;
                                  peg$currPos++;
                                } else {
                                  s13 = peg$FAILED;
                                  if (peg$silentFails === 0) { peg$fail(peg$e67); }
                                }
                                if (s13 !== peg$FAILED) {
                                  peg$savedPos = s0;
                                  s0 = peg$f61(s3, s7, s11);
                                } else {
                                  peg$currPos = s0;
                                  s0 = peg$FAILED;
                                }
                              } else {
                                peg$currPos = s0;
                                s0 = peg$FAILED;
                              }
                            } else {
                              peg$currPos = s0;
                              s0 = peg$FAILED;
                            }
                          } else {
                            peg$currPos = s0;
                            s0 = peg$FAILED;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$FAILED;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          }
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Array",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Array",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseObject() {
      var startPos = peg$currPos;
      var s0, s1, s3, s5;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Object",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 50;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Object",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Object",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 123) {
        s1 = peg$c3;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e7); }
      }
      if (s1 !== peg$FAILED) {
        peg$parse_();
        if (input.charCodeAt(peg$currPos) === 125) {
          s3 = peg$c4;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e8); }
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f62();
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 123) {
          s1 = peg$c3;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e7); }
        }
        if (s1 !== peg$FAILED) {
          peg$parse_();
          s3 = peg$parsePairs();
          if (s3 !== peg$FAILED) {
            peg$parse_();
            if (input.charCodeAt(peg$currPos) === 125) {
              s5 = peg$c4;
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e8); }
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s0 = peg$f63(s3);
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Object",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Object",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parsePairs() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Pairs",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 51;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Pairs",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Pairs",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$parsePair();
      if (s1 === peg$FAILED) {
        s1 = peg$parseSpread();
        if (s1 === peg$FAILED) {
          s1 = peg$parseShorthand();
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse_i();
        if (s4 !== peg$FAILED) {
          s5 = peg$parsePair();
          if (s5 === peg$FAILED) {
            s5 = peg$parseSpread();
            if (s5 === peg$FAILED) {
              s5 = peg$parseShorthand();
            }
          }
          if (s5 !== peg$FAILED) {
            s4 = [s4, s5];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$parse_i();
          if (s4 !== peg$FAILED) {
            s5 = peg$parsePair();
            if (s5 === peg$FAILED) {
              s5 = peg$parseSpread();
              if (s5 === peg$FAILED) {
                s5 = peg$parseShorthand();
              }
            }
            if (s5 !== peg$FAILED) {
              s4 = [s4, s5];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        }
        peg$savedPos = s0;
        s0 = peg$f32(s1, s2);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Pairs",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Pairs",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parsePair() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Pair",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 52;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Pair",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Pair",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$parsePairKey();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__s();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseExpr();
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f64(s1, s3);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Pair",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Pair",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parsePairKey() {
      var startPos = peg$currPos;
      var s0, s1, s2;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "PairKey",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 53;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "PairKey",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "PairKey",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 58) {
        s1 = peg$c30;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e35); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseVar();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f65(s2);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 58) {
          s1 = peg$c30;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e35); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseString();
          if (s2 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f65(s2);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$parseComputedKey();
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "PairKey",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "PairKey",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseComputedKey() {
      var startPos = peg$currPos;
      var s0, s1, s3, s5;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "ComputedKey",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 54;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "ComputedKey",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "ComputedKey",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c71) {
        s1 = peg$c71;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e78); }
      }
      if (s1 !== peg$FAILED) {
        peg$parse_();
        s3 = peg$parseExpr();
        if (s3 !== peg$FAILED) {
          peg$parse_();
          if (input.charCodeAt(peg$currPos) === 41) {
            s5 = peg$c31;
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e36); }
          }
          if (s5 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f66(s3);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "ComputedKey",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "ComputedKey",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseSpread() {
      var startPos = peg$currPos;
      var s0, s1, s2;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Spread",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 55;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Spread",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Spread",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 3) === peg$c72) {
        s1 = peg$c72;
        peg$currPos += 3;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e79); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseExpr();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f67(s2);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Spread",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Spread",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseShorthand() {
      var startPos = peg$currPos;
      var s0, s1, s2;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Shorthand",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 56;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Shorthand",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Shorthand",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 46) {
        s1 = peg$c35;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e40); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseWord();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f68(s2);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Shorthand",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Shorthand",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseAssignment() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Assignment",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 57;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Assignment",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Assignment",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$parseLValue();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__s();
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 2) === peg$c56) {
            s3 = peg$c56;
            peg$currPos += 2;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e61); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__s();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseExpr();
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f44(s1, s5);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseArrayDest();
        if (s1 === peg$FAILED) {
          s1 = peg$parseObjDest();
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parse__s();
          if (s2 !== peg$FAILED) {
            if (input.substr(peg$currPos, 2) === peg$c56) {
              s3 = peg$c56;
              peg$currPos += 2;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e61); }
            }
            if (s3 !== peg$FAILED) {
              s4 = peg$parse__s();
              if (s4 !== peg$FAILED) {
                s5 = peg$parseExpr();
                if (s5 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s0 = peg$f69(s1, s5);
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Assignment",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Assignment",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseLValue() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "LValue",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 58;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "LValue",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "LValue",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      peg$silentFails++;
      s0 = peg$currPos;
      s1 = peg$parseVar();
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$parseLValueAccess();
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$parseLValueAccess();
        }
        peg$savedPos = s0;
        s0 = peg$f70(s1, s2);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e80); }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "LValue",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "LValue",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseLValueAccess() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s5;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "LValueAccess",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 59;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "LValueAccess",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "LValueAccess",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (input.charCodeAt(peg$currPos) === 46) {
        s2 = peg$c35;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e40); }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parseWord();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f71(s3);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 91) {
          s1 = peg$c60;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e66); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parse_();
          s3 = peg$parseExpr();
          if (s3 !== peg$FAILED) {
            peg$parse_();
            if (input.charCodeAt(peg$currPos) === 93) {
              s5 = peg$c61;
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e67); }
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s0 = peg$f72(s3);
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "LValueAccess",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "LValueAccess",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseIdentifier() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Identifier",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 60;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Identifier",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Identifier",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      peg$silentFails++;
      s0 = peg$currPos;
      s1 = peg$parseArray();
      if (s1 === peg$FAILED) {
        s1 = peg$parseVar();
        if (s1 === peg$FAILED) {
          s1 = peg$parseString();
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$parseIdentifierAccess();
        if (s3 !== peg$FAILED) {
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            s3 = peg$parseIdentifierAccess();
          }
        } else {
          s2 = peg$FAILED;
        }
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f73(s1, s2);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseVar();
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e81); }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Identifier",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Identifier",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseIdentifierAccess() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s6;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "IdentifierAccess",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 61;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "IdentifierAccess",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "IdentifierAccess",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (input.charCodeAt(peg$currPos) === 63) {
        s2 = peg$c41;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e46); }
      }
      if (s2 === peg$FAILED) {
        s2 = null;
      }
      if (input.charCodeAt(peg$currPos) === 46) {
        s3 = peg$c35;
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e40); }
      }
      if (s3 !== peg$FAILED) {
        s4 = peg$parseWord();
        if (s4 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f74(s2, s4);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 63) {
          s1 = peg$c41;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e46); }
        }
        if (s1 === peg$FAILED) {
          s1 = null;
        }
        if (input.charCodeAt(peg$currPos) === 91) {
          s2 = peg$c60;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e66); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          s4 = peg$parseSliceRange();
          if (s4 !== peg$FAILED) {
            peg$parse_();
            if (input.charCodeAt(peg$currPos) === 93) {
              s6 = peg$c61;
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e67); }
            }
            if (s6 !== peg$FAILED) {
              peg$savedPos = s0;
              s0 = peg$f75(s1, s4);
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 63) {
            s1 = peg$c41;
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e46); }
          }
          if (s1 === peg$FAILED) {
            s1 = null;
          }
          if (input.charCodeAt(peg$currPos) === 91) {
            s2 = peg$c60;
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e66); }
          }
          if (s2 !== peg$FAILED) {
            s3 = peg$parse_();
            s4 = peg$parseExpr();
            if (s4 !== peg$FAILED) {
              peg$parse_();
              if (input.charCodeAt(peg$currPos) === 93) {
                s6 = peg$c61;
                peg$currPos++;
              } else {
                s6 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e67); }
              }
              if (s6 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f76(s1, s4);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 63) {
              s1 = peg$c41;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e46); }
            }
            if (s1 === peg$FAILED) {
              s1 = null;
            }
            if (input.charCodeAt(peg$currPos) === 40) {
              s2 = peg$c29;
              peg$currPos++;
            } else {
              s2 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e34); }
            }
            if (s2 !== peg$FAILED) {
              s3 = peg$parse_();
              s4 = peg$parseArgs();
              if (s4 === peg$FAILED) {
                s4 = null;
              }
              peg$parse_();
              if (input.charCodeAt(peg$currPos) === 41) {
                s6 = peg$c31;
                peg$currPos++;
              } else {
                s6 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e36); }
              }
              if (s6 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f77(s1, s4);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              if (input.charCodeAt(peg$currPos) === 96) {
                s1 = peg$c73;
                peg$currPos++;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e82); }
              }
              if (s1 !== peg$FAILED) {
                s2 = peg$parseString();
                if (s2 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s0 = peg$f78(s2);
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            }
          }
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "IdentifierAccess",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "IdentifierAccess",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseArgs() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Args",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 62;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Args",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Args",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$parsePositionalArgs();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_i();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseNamedArgs();
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f79(s1, s3);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseNamedArgs();
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$f80(s1);
        }
        s0 = s1;
        if (s0 === peg$FAILED) {
          s0 = peg$parsePositionalArgs();
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Args",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Args",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parsePositionalArgs() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "PositionalArgs",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 63;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "PositionalArgs",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "PositionalArgs",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$parseExpr();
      if (s1 === peg$FAILED) {
        s1 = peg$parseSpread();
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse_i();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseExpr();
          if (s5 === peg$FAILED) {
            s5 = peg$parseSpread();
          }
          if (s5 !== peg$FAILED) {
            s4 = [s4, s5];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$parse_i();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseExpr();
            if (s5 === peg$FAILED) {
              s5 = peg$parseSpread();
            }
            if (s5 !== peg$FAILED) {
              s4 = [s4, s5];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        }
        peg$savedPos = s0;
        s0 = peg$f32(s1, s2);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "PositionalArgs",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "PositionalArgs",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseNamedArgs() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "NamedArgs",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 64;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "NamedArgs",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "NamedArgs",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$parseNamedArg();
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse_i();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseNamedArg();
          if (s5 !== peg$FAILED) {
            s4 = [s4, s5];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$parse_i();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseNamedArg();
            if (s5 !== peg$FAILED) {
              s4 = [s4, s5];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        }
        peg$savedPos = s0;
        s0 = peg$f81(s1, s2);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "NamedArgs",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "NamedArgs",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseNamedArg() {
      var startPos = peg$currPos;
      var s0, s1, s2, s4;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "NamedArg",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 65;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "NamedArg",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "NamedArg",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 58) {
        s1 = peg$c30;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e35); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseWord();
        if (s2 !== peg$FAILED) {
          peg$parse_s();
          s4 = peg$parseExpr();
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f82(s2, s4);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 58) {
          s1 = peg$c30;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e35); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseWord();
          if (s2 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f83(s2);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "NamedArg",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "NamedArg",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseNew() {
      var startPos = peg$currPos;
      var s0, s1, s2;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "New",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 66;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "New",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "New",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 38) {
        s1 = peg$c21;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e25); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseExpr();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f84(s2);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "New",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "New",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseNumber() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Number",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 67;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Number",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Number",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      peg$silentFails++;
      s0 = peg$currPos;
      s1 = peg$currPos;
      s2 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 45) {
        s3 = peg$c17;
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e21); }
      }
      if (s3 === peg$FAILED) {
        s3 = null;
      }
      s4 = [];
      s5 = peg$parseDigit();
      if (s5 !== peg$FAILED) {
        while (s5 !== peg$FAILED) {
          s4.push(s5);
          s5 = peg$parseDigit();
        }
      } else {
        s4 = peg$FAILED;
      }
      if (s4 !== peg$FAILED) {
        s3 = [s3, s4];
        s2 = s3;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = input.substring(s1, peg$currPos);
      } else {
        s1 = s2;
      }
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 110) {
          s2 = peg$c74;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e84); }
        }
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f85(s1);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$currPos;
        s2 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 45) {
          s3 = peg$c17;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e21); }
        }
        if (s3 === peg$FAILED) {
          s3 = null;
        }
        s4 = [];
        s5 = peg$parseDigit();
        if (s5 !== peg$FAILED) {
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            s5 = peg$parseDigit();
          }
        } else {
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          s5 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 46) {
            s6 = peg$c35;
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e40); }
          }
          if (s6 !== peg$FAILED) {
            s7 = [];
            s8 = peg$parseDigit();
            if (s8 !== peg$FAILED) {
              while (s8 !== peg$FAILED) {
                s7.push(s8);
                s8 = peg$parseDigit();
              }
            } else {
              s7 = peg$FAILED;
            }
            if (s7 !== peg$FAILED) {
              s6 = [s6, s7];
              s5 = s6;
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
          } else {
            peg$currPos = s5;
            s5 = peg$FAILED;
          }
          if (s5 === peg$FAILED) {
            s5 = null;
          }
          s6 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 101) {
            s7 = peg$c75;
            peg$currPos++;
          } else {
            s7 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e85); }
          }
          if (s7 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 43) {
              s8 = peg$c18;
              peg$currPos++;
            } else {
              s8 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e22); }
            }
            if (s8 === peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 45) {
                s8 = peg$c17;
                peg$currPos++;
              } else {
                s8 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e21); }
              }
            }
            if (s8 === peg$FAILED) {
              s8 = null;
            }
            s9 = [];
            s10 = peg$parseDigit();
            if (s10 !== peg$FAILED) {
              while (s10 !== peg$FAILED) {
                s9.push(s10);
                s10 = peg$parseDigit();
              }
            } else {
              s9 = peg$FAILED;
            }
            if (s9 !== peg$FAILED) {
              s7 = [s7, s8, s9];
              s6 = s7;
            } else {
              peg$currPos = s6;
              s6 = peg$FAILED;
            }
          } else {
            peg$currPos = s6;
            s6 = peg$FAILED;
          }
          if (s6 === peg$FAILED) {
            s6 = null;
          }
          s3 = [s3, s4, s5, s6];
          s2 = s3;
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
        if (s2 !== peg$FAILED) {
          s1 = input.substring(s1, peg$currPos);
        } else {
          s1 = s2;
        }
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$f86(s1);
        }
        s0 = s1;
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 2) === peg$c76) {
            s1 = peg$c76;
            peg$currPos += 2;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e86); }
          }
          if (s1 !== peg$FAILED) {
            s2 = peg$currPos;
            s3 = [];
            s4 = peg$parseHex();
            if (s4 !== peg$FAILED) {
              while (s4 !== peg$FAILED) {
                s3.push(s4);
                s4 = peg$parseHex();
              }
            } else {
              s3 = peg$FAILED;
            }
            if (s3 !== peg$FAILED) {
              s2 = input.substring(s2, peg$currPos);
            } else {
              s2 = s3;
            }
            if (s2 !== peg$FAILED) {
              peg$savedPos = s0;
              s0 = peg$f87(s2);
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.substr(peg$currPos, 2) === peg$c77) {
              s1 = peg$c77;
              peg$currPos += 2;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e87); }
            }
            if (s1 !== peg$FAILED) {
              s2 = peg$currPos;
              s3 = [];
              if (input.charCodeAt(peg$currPos) === 48) {
                s4 = peg$c78;
                peg$currPos++;
              } else {
                s4 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e88); }
              }
              if (s4 === peg$FAILED) {
                if (input.charCodeAt(peg$currPos) === 49) {
                  s4 = peg$c79;
                  peg$currPos++;
                } else {
                  s4 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$e89); }
                }
              }
              if (s4 !== peg$FAILED) {
                while (s4 !== peg$FAILED) {
                  s3.push(s4);
                  if (input.charCodeAt(peg$currPos) === 48) {
                    s4 = peg$c78;
                    peg$currPos++;
                  } else {
                    s4 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$e88); }
                  }
                  if (s4 === peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 49) {
                      s4 = peg$c79;
                      peg$currPos++;
                    } else {
                      s4 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$e89); }
                    }
                  }
                }
              } else {
                s3 = peg$FAILED;
              }
              if (s3 !== peg$FAILED) {
                s2 = input.substring(s2, peg$currPos);
              } else {
                s2 = s3;
              }
              if (s2 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f88(s2);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          }
        }
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e83); }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Number",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Number",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseString() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "String",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 68;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "String",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "String",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      peg$silentFails++;
      s0 = peg$currPos;
      s1 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c80) {
        s2 = peg$c80;
        peg$currPos += 2;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e91); }
      }
      if (s2 !== peg$FAILED) {
        s1 = input.substring(s1, peg$currPos);
      } else {
        s1 = s2;
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$f89();
      }
      s0 = s1;
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 34) {
          s1 = peg$c81;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e92); }
        }
        if (s1 !== peg$FAILED) {
          s2 = [];
          s3 = peg$parseStringPart();
          if (s3 !== peg$FAILED) {
            while (s3 !== peg$FAILED) {
              s2.push(s3);
              s3 = peg$parseStringPart();
            }
          } else {
            s2 = peg$FAILED;
          }
          if (s2 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 34) {
              s3 = peg$c81;
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e92); }
            }
            if (s3 !== peg$FAILED) {
              peg$savedPos = s0;
              s0 = peg$f90(s2);
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e90); }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "String",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "String",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseStringPart() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5, s6, s7, s8;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "StringPart",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 69;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "StringPart",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "StringPart",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c82) {
        s1 = peg$c82;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e93); }
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$f91();
      }
      s0 = s1;
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 92) {
          s2 = peg$c83;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e94); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 117) {
            s4 = peg$c84;
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e95); }
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parseHex();
            if (s5 !== peg$FAILED) {
              s6 = peg$parseHex();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseHex();
                if (s7 !== peg$FAILED) {
                  s8 = peg$parseHex();
                  if (s8 !== peg$FAILED) {
                    s4 = [s4, s5, s6, s7, s8];
                    s3 = s4;
                  } else {
                    peg$currPos = s3;
                    s3 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s3;
                  s3 = peg$FAILED;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
          if (s3 !== peg$FAILED) {
            s2 = [s2, s3];
            s1 = s2;
          } else {
            peg$currPos = s1;
            s1 = peg$FAILED;
          }
        } else {
          peg$currPos = s1;
          s1 = peg$FAILED;
        }
        if (s1 !== peg$FAILED) {
          s0 = input.substring(s0, peg$currPos);
        } else {
          s0 = s1;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 92) {
            s1 = peg$c83;
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e94); }
          }
          if (s1 !== peg$FAILED) {
            s2 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 117) {
              s3 = peg$c84;
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e95); }
            }
            if (s3 !== peg$FAILED) {
              s4 = peg$parseHex();
              if (s4 === peg$FAILED) {
                s4 = null;
              }
              s5 = peg$parseHex();
              if (s5 === peg$FAILED) {
                s5 = null;
              }
              s6 = peg$parseHex();
              if (s6 === peg$FAILED) {
                s6 = null;
              }
              s3 = [s3, s4, s5, s6];
              s2 = s3;
            } else {
              peg$currPos = s2;
              s2 = peg$FAILED;
            }
            if (s2 !== peg$FAILED) {
              peg$savedPos = s0;
              s0 = peg$f92();
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            s1 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 92) {
              s2 = peg$c83;
              peg$currPos++;
            } else {
              s2 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e94); }
            }
            if (s2 !== peg$FAILED) {
              if (input.length > peg$currPos) {
                s3 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s3 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e96); }
              }
              if (s3 !== peg$FAILED) {
                s2 = [s2, s3];
                s1 = s2;
              } else {
                peg$currPos = s1;
                s1 = peg$FAILED;
              }
            } else {
              peg$currPos = s1;
              s1 = peg$FAILED;
            }
            if (s1 !== peg$FAILED) {
              s0 = input.substring(s0, peg$currPos);
            } else {
              s0 = s1;
            }
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              if (input.substr(peg$currPos, 2) === peg$c85) {
                s1 = peg$c85;
                peg$currPos += 2;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e97); }
              }
              if (s1 !== peg$FAILED) {
                s2 = peg$parse_();
                s3 = peg$parseExpr();
                if (s3 !== peg$FAILED) {
                  s4 = peg$parse_();
                  if (input.charCodeAt(peg$currPos) === 125) {
                    s5 = peg$c4;
                    peg$currPos++;
                  } else {
                    s5 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$e8); }
                  }
                  if (s5 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s0 = peg$f93(s3);
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
              if (s0 === peg$FAILED) {
                s0 = peg$currPos;
                s1 = peg$currPos;
                s2 = [];
                if (peg$r0.test(input.charAt(peg$currPos))) {
                  s3 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s3 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$e98); }
                }
                if (s3 !== peg$FAILED) {
                  while (s3 !== peg$FAILED) {
                    s2.push(s3);
                    if (peg$r0.test(input.charAt(peg$currPos))) {
                      s3 = input.charAt(peg$currPos);
                      peg$currPos++;
                    } else {
                      s3 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$e98); }
                    }
                  }
                } else {
                  s2 = peg$FAILED;
                }
                if (s2 !== peg$FAILED) {
                  s1 = input.substring(s1, peg$currPos);
                } else {
                  s1 = s2;
                }
                if (s1 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$f94(s1);
                }
                s0 = s1;
                if (s0 === peg$FAILED) {
                  if (input.charCodeAt(peg$currPos) === 35) {
                    s0 = peg$c86;
                    peg$currPos++;
                  } else {
                    s0 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$e99); }
                  }
                }
              }
            }
          }
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "StringPart",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "StringPart",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseRegex() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5, s6, s7;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Regex",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 70;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Regex",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Regex",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$currPos;
      s2 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 47) {
        s3 = peg$c14;
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e18); }
      }
      if (s3 !== peg$FAILED) {
        s4 = [];
        s5 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 92) {
          s6 = peg$c83;
          peg$currPos++;
        } else {
          s6 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e94); }
        }
        if (s6 !== peg$FAILED) {
          if (input.length > peg$currPos) {
            s7 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s7 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e96); }
          }
          if (s7 !== peg$FAILED) {
            s6 = [s6, s7];
            s5 = s6;
          } else {
            peg$currPos = s5;
            s5 = peg$FAILED;
          }
        } else {
          peg$currPos = s5;
          s5 = peg$FAILED;
        }
        if (s5 === peg$FAILED) {
          if (peg$r1.test(input.charAt(peg$currPos))) {
            s5 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e100); }
          }
        }
        if (s5 !== peg$FAILED) {
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            s5 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 92) {
              s6 = peg$c83;
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e94); }
            }
            if (s6 !== peg$FAILED) {
              if (input.length > peg$currPos) {
                s7 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s7 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e96); }
              }
              if (s7 !== peg$FAILED) {
                s6 = [s6, s7];
                s5 = s6;
              } else {
                peg$currPos = s5;
                s5 = peg$FAILED;
              }
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
            if (s5 === peg$FAILED) {
              if (peg$r1.test(input.charAt(peg$currPos))) {
                s5 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e100); }
              }
            }
          }
        } else {
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 47) {
            s5 = peg$c14;
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e18); }
          }
          if (s5 !== peg$FAILED) {
            s6 = [];
            if (peg$r2.test(input.charAt(peg$currPos))) {
              s7 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s7 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e101); }
            }
            while (s7 !== peg$FAILED) {
              s6.push(s7);
              if (peg$r2.test(input.charAt(peg$currPos))) {
                s7 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s7 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e101); }
              }
            }
            s3 = [s3, s4, s5, s6];
            s2 = s3;
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = input.substring(s1, peg$currPos);
      } else {
        s1 = s2;
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$f95(s1);
      }
      s0 = s1;

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Regex",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Regex",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseRange() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Range",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 71;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Range",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Range",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$parseExpr();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 2) === peg$c87) {
            s3 = peg$c87;
            peg$currPos += 2;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e102); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseExpr();
              if (s5 !== peg$FAILED) {
                s6 = peg$currPos;
                s7 = peg$parse__();
                if (s7 !== peg$FAILED) {
                  if (input.substr(peg$currPos, 2) === peg$c88) {
                    s8 = peg$c88;
                    peg$currPos += 2;
                  } else {
                    s8 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$e103); }
                  }
                  if (s8 !== peg$FAILED) {
                    s9 = peg$parse__();
                    if (s9 !== peg$FAILED) {
                      s10 = peg$parseExpr();
                      if (s10 !== peg$FAILED) {
                        s7 = [s7, s8, s9, s10];
                        s6 = s7;
                      } else {
                        peg$currPos = s6;
                        s6 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s6;
                      s6 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s6;
                    s6 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s6;
                  s6 = peg$FAILED;
                }
                if (s6 === peg$FAILED) {
                  s6 = null;
                }
                peg$savedPos = s0;
                s0 = peg$f96(s1, s5, s6);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Range",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Range",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseSliceRange() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "SliceRange",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 72;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "SliceRange",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "SliceRange",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$parseExpr();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 2) === peg$c87) {
            s3 = peg$c87;
            peg$currPos += 2;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e102); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseExpr();
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f97(s1, s5);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseExpr();
        if (s1 !== peg$FAILED) {
          s2 = peg$parse__();
          if (s2 !== peg$FAILED) {
            if (input.substr(peg$currPos, 2) === peg$c87) {
              s3 = peg$c87;
              peg$currPos += 2;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e102); }
            }
            if (s3 !== peg$FAILED) {
              peg$savedPos = s0;
              s0 = peg$f98(s1);
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 2) === peg$c87) {
            s1 = peg$c87;
            peg$currPos += 2;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e102); }
          }
          if (s1 !== peg$FAILED) {
            s2 = peg$parse__();
            if (s2 !== peg$FAILED) {
              s3 = peg$parseExpr();
              if (s3 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f99(s3);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "SliceRange",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "SliceRange",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseBoolean() {
      var startPos = peg$currPos;
      var s0, s1;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Boolean",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 73;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Boolean",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Boolean",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 4) === peg$c89) {
        s1 = peg$c89;
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e104); }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 5) === peg$c90) {
          s1 = peg$c90;
          peg$currPos += 5;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e105); }
        }
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$f100(s1);
      }
      s0 = s1;

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Boolean",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Boolean",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseBottomValue() {
      var startPos = peg$currPos;
      var s0, s1;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "BottomValue",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 74;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "BottomValue",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "BottomValue",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 4) === peg$c91) {
        s1 = peg$c91;
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e106); }
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$f101();
      }
      s0 = s1;
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 4) === peg$c92) {
          s1 = peg$c92;
          peg$currPos += 4;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e107); }
        }
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$f102();
        }
        s0 = s1;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "BottomValue",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "BottomValue",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseVar() {
      var startPos = peg$currPos;
      var s0, s1;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Var",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 75;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Var",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Var",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$parseWord();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$f103(s1);
      }
      s0 = s1;

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Var",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Var",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseComment() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5, s6, s7;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Comment",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 76;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Comment",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Comment",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$currPos;
      s2 = peg$currPos;
      if (input.substr(peg$currPos, 3) === peg$c93) {
        s3 = peg$c93;
        peg$currPos += 3;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e108); }
      }
      if (s3 !== peg$FAILED) {
        s4 = [];
        s5 = peg$currPos;
        s6 = peg$currPos;
        peg$silentFails++;
        if (input.substr(peg$currPos, 3) === peg$c93) {
          s7 = peg$c93;
          peg$currPos += 3;
        } else {
          s7 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e108); }
        }
        peg$silentFails--;
        if (s7 === peg$FAILED) {
          s6 = undefined;
        } else {
          peg$currPos = s6;
          s6 = peg$FAILED;
        }
        if (s6 !== peg$FAILED) {
          if (input.length > peg$currPos) {
            s7 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s7 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e96); }
          }
          if (s7 === peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 10) {
              s7 = peg$c94;
              peg$currPos++;
            } else {
              s7 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e109); }
            }
            if (s7 === peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 13) {
                s7 = peg$c95;
                peg$currPos++;
              } else {
                s7 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e110); }
              }
            }
          }
          if (s7 !== peg$FAILED) {
            s6 = [s6, s7];
            s5 = s6;
          } else {
            peg$currPos = s5;
            s5 = peg$FAILED;
          }
        } else {
          peg$currPos = s5;
          s5 = peg$FAILED;
        }
        while (s5 !== peg$FAILED) {
          s4.push(s5);
          s5 = peg$currPos;
          s6 = peg$currPos;
          peg$silentFails++;
          if (input.substr(peg$currPos, 3) === peg$c93) {
            s7 = peg$c93;
            peg$currPos += 3;
          } else {
            s7 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e108); }
          }
          peg$silentFails--;
          if (s7 === peg$FAILED) {
            s6 = undefined;
          } else {
            peg$currPos = s6;
            s6 = peg$FAILED;
          }
          if (s6 !== peg$FAILED) {
            if (input.length > peg$currPos) {
              s7 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s7 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e96); }
            }
            if (s7 === peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 10) {
                s7 = peg$c94;
                peg$currPos++;
              } else {
                s7 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e109); }
              }
              if (s7 === peg$FAILED) {
                if (input.charCodeAt(peg$currPos) === 13) {
                  s7 = peg$c95;
                  peg$currPos++;
                } else {
                  s7 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$e110); }
                }
              }
            }
            if (s7 !== peg$FAILED) {
              s6 = [s6, s7];
              s5 = s6;
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
          } else {
            peg$currPos = s5;
            s5 = peg$FAILED;
          }
        }
        if (input.substr(peg$currPos, 3) === peg$c93) {
          s5 = peg$c93;
          peg$currPos += 3;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e108); }
        }
        if (s5 !== peg$FAILED) {
          s3 = [s3, s4, s5];
          s2 = s3;
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = input.substring(s1, peg$currPos);
      } else {
        s1 = s2;
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$f104();
      }
      s0 = s1;
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$currPos;
        s2 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 35) {
          s3 = peg$c86;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e99); }
        }
        if (s3 !== peg$FAILED) {
          s4 = [];
          s5 = peg$currPos;
          s6 = peg$currPos;
          peg$silentFails++;
          if (input.charCodeAt(peg$currPos) === 10) {
            s7 = peg$c94;
            peg$currPos++;
          } else {
            s7 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e109); }
          }
          peg$silentFails--;
          if (s7 === peg$FAILED) {
            s6 = undefined;
          } else {
            peg$currPos = s6;
            s6 = peg$FAILED;
          }
          if (s6 !== peg$FAILED) {
            if (input.length > peg$currPos) {
              s7 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s7 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e96); }
            }
            if (s7 !== peg$FAILED) {
              s6 = [s6, s7];
              s5 = s6;
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
          } else {
            peg$currPos = s5;
            s5 = peg$FAILED;
          }
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            s5 = peg$currPos;
            s6 = peg$currPos;
            peg$silentFails++;
            if (input.charCodeAt(peg$currPos) === 10) {
              s7 = peg$c94;
              peg$currPos++;
            } else {
              s7 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e109); }
            }
            peg$silentFails--;
            if (s7 === peg$FAILED) {
              s6 = undefined;
            } else {
              peg$currPos = s6;
              s6 = peg$FAILED;
            }
            if (s6 !== peg$FAILED) {
              if (input.length > peg$currPos) {
                s7 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s7 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e96); }
              }
              if (s7 !== peg$FAILED) {
                s6 = [s6, s7];
                s5 = s6;
              } else {
                peg$currPos = s5;
                s5 = peg$FAILED;
              }
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
          }
          s3 = [s3, s4];
          s2 = s3;
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
        if (s2 !== peg$FAILED) {
          s1 = input.substring(s1, peg$currPos);
        } else {
          s1 = s2;
        }
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$f104();
        }
        s0 = s1;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Comment",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Comment",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseWord() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Word",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 77;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Word",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Word",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      s0 = peg$currPos;
      s1 = peg$currPos;
      if (peg$r3.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e111); }
      }
      if (s2 !== peg$FAILED) {
        s3 = [];
        if (peg$r4.test(input.charAt(peg$currPos))) {
          s4 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e112); }
        }
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          if (peg$r4.test(input.charAt(peg$currPos))) {
            s4 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e112); }
          }
        }
        s2 = [s2, s3];
        s1 = s2;
      } else {
        peg$currPos = s1;
        s1 = peg$FAILED;
      }
      if (s1 !== peg$FAILED) {
        s0 = input.substring(s0, peg$currPos);
      } else {
        s0 = s1;
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Word",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Word",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseHex() {
      var startPos = peg$currPos;
      var s0;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Hex",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 78;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Hex",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Hex",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      peg$silentFails++;
      if (peg$r5.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e114); }
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        if (peg$silentFails === 0) { peg$fail(peg$e113); }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Hex",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Hex",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parseDigit() {
      var startPos = peg$currPos;
      var s0;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "Digit",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 79;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Digit",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Digit",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      peg$silentFails++;
      if (peg$r6.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e116); }
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        if (peg$silentFails === 0) { peg$fail(peg$e115); }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "Digit",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "Digit",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parse_i() {
      var startPos = peg$currPos;
      var s0, s1, s2;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "_i",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 80;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "_i",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "_i",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      peg$silentFails++;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 44) {
        s1 = peg$c51;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e56); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parse_l();
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e117); }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "_i",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "_i",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parse__() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "__",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 81;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "__",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "__",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      peg$silentFails++;
      s0 = peg$currPos;
      s1 = [];
      s2 = [];
      if (peg$r7.test(input.charAt(peg$currPos))) {
        s3 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e119); }
      }
      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          if (peg$r7.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e119); }
          }
        }
      } else {
        s2 = peg$FAILED;
      }
      if (s2 === peg$FAILED) {
        s2 = peg$parseComment();
      }
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          s2 = [];
          if (peg$r7.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e119); }
          }
          if (s3 !== peg$FAILED) {
            while (s3 !== peg$FAILED) {
              s2.push(s3);
              if (peg$r7.test(input.charAt(peg$currPos))) {
                s3 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s3 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e119); }
              }
            }
          } else {
            s2 = peg$FAILED;
          }
          if (s2 === peg$FAILED) {
            s2 = peg$parseComment();
          }
        }
      } else {
        s1 = peg$FAILED;
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$f104();
      }
      s0 = s1;
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e118); }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "__",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "__",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parse_() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "_",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 82;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "_",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "_",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      peg$silentFails++;
      s0 = peg$currPos;
      s1 = [];
      s2 = [];
      if (peg$r7.test(input.charAt(peg$currPos))) {
        s3 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e119); }
      }
      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          if (peg$r7.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e119); }
          }
        }
      } else {
        s2 = peg$FAILED;
      }
      if (s2 === peg$FAILED) {
        s2 = peg$parseComment();
      }
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = [];
        if (peg$r7.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e119); }
        }
        if (s3 !== peg$FAILED) {
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            if (peg$r7.test(input.charAt(peg$currPos))) {
              s3 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e119); }
            }
          }
        } else {
          s2 = peg$FAILED;
        }
        if (s2 === peg$FAILED) {
          s2 = peg$parseComment();
        }
      }
      peg$savedPos = s0;
      s1 = peg$f104();
      s0 = s1;
      peg$silentFails--;
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$e118); }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "_",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "_",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parse_s() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "_s",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 83;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "_s",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "_s",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      peg$silentFails++;
      s0 = peg$currPos;
      s1 = [];
      s2 = [];
      if (peg$r8.test(input.charAt(peg$currPos))) {
        s3 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e121); }
      }
      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          if (peg$r8.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e121); }
          }
        }
      } else {
        s2 = peg$FAILED;
      }
      if (s2 === peg$FAILED) {
        s2 = peg$parseComment();
      }
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = [];
        if (peg$r8.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$e121); }
        }
        if (s3 !== peg$FAILED) {
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            if (peg$r8.test(input.charAt(peg$currPos))) {
              s3 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$e121); }
            }
          }
        } else {
          s2 = peg$FAILED;
        }
        if (s2 === peg$FAILED) {
          s2 = peg$parseComment();
        }
      }
      peg$savedPos = s0;
      s1 = peg$f104();
      s0 = s1;
      peg$silentFails--;
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$e120); }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "_s",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "_s",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parse__s() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "__s",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 84;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "__s",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "__s",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      peg$silentFails++;
      s0 = peg$currPos;
      s1 = [];
      s2 = [];
      if (peg$r8.test(input.charAt(peg$currPos))) {
        s3 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e121); }
      }
      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          if (peg$r8.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e121); }
          }
        }
      } else {
        s2 = peg$FAILED;
      }
      if (s2 === peg$FAILED) {
        s2 = peg$parseComment();
      }
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          s2 = [];
          if (peg$r8.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e121); }
          }
          if (s3 !== peg$FAILED) {
            while (s3 !== peg$FAILED) {
              s2.push(s3);
              if (peg$r8.test(input.charAt(peg$currPos))) {
                s3 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s3 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e121); }
              }
            }
          } else {
            s2 = peg$FAILED;
          }
          if (s2 === peg$FAILED) {
            s2 = peg$parseComment();
          }
        }
      } else {
        s1 = peg$FAILED;
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$f104();
      }
      s0 = s1;
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e122); }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "__s",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "__s",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }

    function peg$parse_l() {
      var startPos = peg$currPos;
      var s0, s1, s2, s3, s4, s5, s6;

      peg$tracer.trace({
        type: "rule.enter",
        rule: "_l",
        location: peg$computeLocation(startPos, startPos)
      });

      var key = peg$currPos * 86 + 85;
      var cached = peg$resultsCache[key];

      if (cached) {
        peg$currPos = cached.nextPos;

      if (cached.result !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "_l",
          result: cached.result,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "_l",
          location: peg$computeLocation(startPos, startPos)
        });
      }

        return cached.result;
      }

      peg$silentFails++;
      s0 = peg$currPos;
      s1 = [];
      s2 = peg$currPos;
      s3 = peg$parse_s();
      s4 = [];
      s5 = [];
      if (peg$r9.test(input.charAt(peg$currPos))) {
        s6 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s6 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e124); }
      }
      if (s6 !== peg$FAILED) {
        while (s6 !== peg$FAILED) {
          s5.push(s6);
          if (peg$r9.test(input.charAt(peg$currPos))) {
            s6 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e124); }
          }
        }
      } else {
        s5 = peg$FAILED;
      }
      if (s5 === peg$FAILED) {
        s5 = peg$parseComment();
      }
      if (s5 !== peg$FAILED) {
        while (s5 !== peg$FAILED) {
          s4.push(s5);
          s5 = [];
          if (peg$r9.test(input.charAt(peg$currPos))) {
            s6 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e124); }
          }
          if (s6 !== peg$FAILED) {
            while (s6 !== peg$FAILED) {
              s5.push(s6);
              if (peg$r9.test(input.charAt(peg$currPos))) {
                s6 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s6 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e124); }
              }
            }
          } else {
            s5 = peg$FAILED;
          }
          if (s5 === peg$FAILED) {
            s5 = peg$parseComment();
          }
        }
      } else {
        s4 = peg$FAILED;
      }
      if (s4 !== peg$FAILED) {
        s5 = peg$parse_s();
        s3 = [s3, s4, s5];
        s2 = s3;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          s2 = peg$currPos;
          s3 = peg$parse_s();
          s4 = [];
          s5 = [];
          if (peg$r9.test(input.charAt(peg$currPos))) {
            s6 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$e124); }
          }
          if (s6 !== peg$FAILED) {
            while (s6 !== peg$FAILED) {
              s5.push(s6);
              if (peg$r9.test(input.charAt(peg$currPos))) {
                s6 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s6 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e124); }
              }
            }
          } else {
            s5 = peg$FAILED;
          }
          if (s5 === peg$FAILED) {
            s5 = peg$parseComment();
          }
          if (s5 !== peg$FAILED) {
            while (s5 !== peg$FAILED) {
              s4.push(s5);
              s5 = [];
              if (peg$r9.test(input.charAt(peg$currPos))) {
                s6 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s6 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$e124); }
              }
              if (s6 !== peg$FAILED) {
                while (s6 !== peg$FAILED) {
                  s5.push(s6);
                  if (peg$r9.test(input.charAt(peg$currPos))) {
                    s6 = input.charAt(peg$currPos);
                    peg$currPos++;
                  } else {
                    s6 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$e124); }
                  }
                }
              } else {
                s5 = peg$FAILED;
              }
              if (s5 === peg$FAILED) {
                s5 = peg$parseComment();
              }
            }
          } else {
            s4 = peg$FAILED;
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parse_s();
            s3 = [s3, s4, s5];
            s2 = s3;
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
        }
      } else {
        s1 = peg$FAILED;
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$f104();
      }
      s0 = s1;
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$e123); }
      }

      peg$resultsCache[key] = { nextPos: peg$currPos, result: s0 };

      if (s0 !== peg$FAILED) {
        peg$tracer.trace({
          type: "rule.match",
          rule: "_l",
          result: s0,
          location: peg$computeLocation(startPos, peg$currPos)
        });
      } else {
        peg$tracer.trace({
          type: "rule.fail",
          rule: "_l",
          location: peg$computeLocation(startPos, startPos)
        });
      }

      return s0;
    }


        const tok = (type) =>
            (source) => ({type, ...source});
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
            "debugger",
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
            "pipe",
            "range",
            "reactive",
            "regex",
            "return",
            "safeguard",
            "shorthand",
            "slice",
            "spread",
            "string",
            "tag",
            "ternary",
            "throw",
            "try",
            "typeof",
            "unary",
            "var",
            "void",
        ];
        const binOp = (head, tail) => tail.reduce(
            (left, next) => token.binop({
                left,
                op: next[1],
                right: next[3]
            }),
            head
        );
        const list = (head, tail, n) => tail.reduce(
            (list, item) => [...list, item[n]],
            [head]
        );
        const listMap = (head, tail, map) => tail.reduce(
            (list, item) => [...list, map(item)],
            [head]
        );
        const token = tokenTypes.reduce(
            (toks, type) => {
                toks[type] = tok(type);
                return toks
            },
            {}
        );


    peg$result = peg$startRuleFunction();

    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
      return peg$result;
    } else {
      if (peg$result !== peg$FAILED && peg$currPos < input.length) {
        peg$fail(peg$endExpectation());
      }

      throw peg$buildStructuredError(
        peg$maxFailExpected,
        peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null,
        peg$maxFailPos < input.length
          ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1)
          : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)
      );
    }
  }

  var parser = {
    SyntaxError: peg$SyntaxError,
    DefaultTracer: peg$DefaultTracer,
    parse: peg$parse
  };

  const realOp = {
      "==": "===",
      "!=": "!==",
      "<-": "=",
  };
  const generateCode$1 = (source) => {
      const topLevel = new Set();
      let refID = 0;
      const makeRef = () => {
          refID += 1;
          return `_ref${refID}`
      };
      let scope = [[]];
      let rebind = null;

      const argLine = (token, index) => {
          const { type, name, value } = token;
          if (type === "var") {
              return `const ${name} = args[${index}]`
          }

          if (name.type === "var") {
              return `const ${name.name} = args[${index}] ?? ${genJS(value)}`
          }

          const array = (name.type === "arraydest");
          const def = array ? "[]" : "{}";
          const source = `const ${value.name} = args[${index}] ?? ${def}`;
          const names = genJS(name.names).join(", ");
          const des = array ? `[${names}]` : `{${names}}`;
          return `${source}\nconst ${des} = ${value.name}`
      };
      const tokenf = {
          "arg": (token, pos) => {
              const argList =
                  token.args
                      .map(argLine)
                      .join("\n");
              return argList
          },
          "array": token => {
              const {items, range, arg, body} = token;

              if (items !== undefined) {
                  return `[${genJS(items).join(", ")}]`
              }

              topLevel.add("_range");
              const {start, end, by} = range;
              if (arg === undefined) {
                  return `_range(${genJS(start)}, ${genJS(end)}, ${genJS(by)})`
              }

              const f = `(${arg}) => ${genJS(body)}`;
              return `_range(${genJS(start)}, ${genJS(end)}, ${genJS(by)}, ${f})`
          },
          "arrayAccess": token => {
              const {target, value, optional} = token;

              topLevel.add("_at");

              return `_at(${genJS(target)},${genJS(value)}, ${optional})`
          },
          "arraydest": token => {
              const { names, rest } = token;

              const named = genJS(names);
              const parts = rest === undefined
                  ? named
                  : [
                      ...named,
                      genJS(rest)
                  ];

              return `[${parts.join(", ")}]`
          },
          "as": token => `${token.source}: ${token.name}`,
          "assign": token => {
              const {left, right, op, dest} = token;

              if (left.type === "arrayAccess") {
                  topLevel.add("_set");

                  const target = genJS(left.target);
                  const key = genJS(left.value);
                  const value = genJS(right);
                  return `_set(${target}, ${key}, ${value})`
              }

              const l = genJS(left);
              const r = genJS(right);
              if (dest === true) {
                  return `;(${l} = ${r});`
              }

              return `${l} = ${r}`
          },
          "binop": token => {
              const {left, right, op} = token;

              const actualOp = realOp[op] ?? op;

              return `${genJS(left)} ${actualOp} ${genJS(right)}`
          },
          "bool": token => token.value.toString(),
          "call": token => {
              const {target, args, optional} = token;
              const op = optional ? "?." : "";

              // console.log(
              //     target.type === "var"
              //     && builtin.bitfunc.includes(target.name)
              // )

              return `${genJS(target)}${op}(${genJS(args).join(", ")})`
          },
          "debugger": () => "debugger;",
          "delete": token => {
              const {expr} = token;

              if (expr.type === "arrayAccess") {
                  const {optional, target, value} = expr;
                  const opt = optional ? "?." : "";
                  return `delete(${genJS(target)}${opt}[${genJS(value)}])`
              }
              return `delete(${genJS(expr)})`
          },
          "do": token => {
              scope.unshift([]);
              const body = genJS(token.body).join("\n");
              const value = genJS(token.value);

              const extra = scope[0].map(
                  name => `let ${name} = null`
              ).join("\n");
              scope.shift();

              return `(function(){\n${extra}\n${body}\n${value}\n}())`
          },
          "dotAccess": token => {
              const {name, target, optional} = token;
              const op = optional ? "?." : ".";

              return `${genJS(target)}${op}${name}`
          },
          "export": token => {
              const {def, expr, items} = token;

              if (items !== undefined) {
                  const list = items.map(
                      item => item.name
                          ? `${genJS(item.source)} as ${genJS(item.name)}`
                          : genJS(item.source)
                  );
                  return `export {${list.join(", ")}}`
              }

              const mod = def ? "default " : "";
              return `export ${mod}${genJS(expr)}`
          },
          "fn": token => {
              const {name, args, body, wait, gen, short, value} = token;
              const sync = wait ? "async " : "";
              const generate = gen ? "*" : "";
              const funcName = `${sync}function${generate} ${name ?? ""}`.trim();

              scope.unshift([]);

              if (short === true) {
                  const argList = genJS(args ?? []).join(", ");
                  return `${funcName}(${argList}){return ${genJS(body)}}`
              }

              const argList = (args === null) ? "" : genJS(args);
              const bodyCode = genJS(body).join("\n");
              const funcBody = [argList, bodyCode].join("\n").trim();
              const returnValue = value ? genJS(value) : "";

              const extra = scope[0].map(
                  name => `let ${name} = null`
              ).join("\n");
              scope.shift();

              return `${funcName} (...args) {\n${extra}\n${funcBody}\n${returnValue}\n}`
          },
          "for": token => {
              const {name, body, source, range, wait} = token;

              const loopBody = genJS(body).join("\n");
              if (name === undefined) {
                  return `for (;;) {\n${loopBody}\n}`
              }

              const sync = wait ? "await " : "";
              if (source !== undefined) {
                  const expr = genJS(source);
                  return `for ${sync}(const ${name} of ${expr}){\n${loopBody}\n}`
              }

              const {start, end, by} = range;
              const init =
                  [
                      `let _pos = ${genJS(start)}`,
                      `_end = ${genJS(end)}`,
                      `_start = _pos`,
                      `_inc = ${genJS(by)}`
                  ]
                  .join(", ");
              const cond = `(_end < _start ? _pos > _end : _pos < _end)`;
              const incr = `(_end < _start ? _pos -= _inc : _pos += _inc)`;

              const loopVars = `const ${name} = _pos`;

              return `for (${init};${cond};${incr}) {\n${loopVars}\n${loopBody}\n}`
          },
          "if": token => {
              const {condition, body, expr, value} = token;

              const cond = genJS(condition);

              if (expr !== undefined) {
                  return `if (${cond}) {\nreturn ${genJS(expr)}\n}`
              }

              const ifBody = genJS(body).join("\n");
              const ifValue = genJS(value);
              return `if (${cond}) {\n${ifBody}\n${ifValue}\n}`
          },
          "import": token => token.source,
          "instance": token =>
              `(${genJS(token.expr)} instanceof ${genJS(token.target)})`,
          "let": token => {
              const word = token.mutable ? "let" : "const";
              const {name, value, guard, destruct} = token;

              const varName = genJS(name);

              if (guard !== undefined) {
                  if (destruct === true) {
                      const ref = makeRef();
                      const val = tokenf.safeguard(guard, ref);
                      return `const ${ref} = ${val}\n${word} ${varName} = ${ref}`
                  }
                  const val = tokenf.safeguard(guard, varName);
                  return `${word} ${varName} = ${val}`
              }

              return `${word} ${varName} = ${genJS(value)}`
          },
          "new": token => `new ${genJS(token.expr)}`,
          "num": token => `${token.value}${token.big ?? ""}`,
          "null": () => "null",
          "objdest": token => {
              const { names, rest } = token;

              const named = genJS(names);
              const parts = rest === undefined
                  ? named
                  : [
                      ...named,
                      genJS(rest)
                  ];

              return `{${parts.join(", ")}}`
          },
          "object": token => {
              const {pairs} = token;

              return `{\n${genJS(pairs).join(",\n")}\n}`
          },
          "pair": token => {
              const {key, value} = token;

              const simpleKey = (
                  key.type === "var"
                  || (
                      key.type === "string"
                      && key.value !== undefined
                  )
              );
              if(simpleKey) {
                  return `${genJS(key)}: ${genJS(value)}`
              }

              const keyExpr = (key.type === "string") ? key : key.expr;
              return `[${genJS(keyExpr)}]: ${genJS(value)}`
          },
          "parens": token => `(${genJS(token.value)})`,
          "pipe": token => {
              const {list} = token;
              const ref = makeRef();

              // return "/* pipe sequence */"

              scope[0].push(ref);
              const refTok = { type: "var", name: ref };
              const sequence = [
                  genJS({
                      type: "assign",
                      left: refTok,
                      right: list[0],
                  }),
                  ...list.slice(1).map(
                      pipeExpr => {
                          const {binding, expr} = pipeExpr;
                          rebind = {
                              from: binding,
                              to: ref
                          };
                          const js = genJS({
                              type: "assign",
                              op: "<-",
                              left: refTok,
                              right: expr,
                          });
                          rebind = null;
                          return js
                      }
                  )
              ];
              return `(${sequence.join(", ")})`
          },
          "reactive": token => `$: ${genJS(token.expr)}`,
          "regex": token => {
              return token.def
          },
          "return": token => `return ${genJS(token.expr)}`,
          "safeguard": (token, ref) => {
              const {expr, body, value, wait} = token;

              const failExprs = [
                  ...genJS(body),
                  genJS(value)
              ].join("\n");
              const expression = genJS(expr);
              const modifier = (wait === true) ? "await " : "";
              const internalFunc = (wait === true) ? "_safe_async" : "_safe";

              topLevel.add(internalFunc);
              const wrapperFunc = `function() {return ${expression}}`;
              const valuePart = `${modifier}${internalFunc}(${wrapperFunc})`;
              const failBody = `{\nconst error = ${ref}\n${failExprs}\n}`;
              const fail = `if (${ref} instanceof Error) ${failBody}`;

              return `${valuePart}\n${fail}`
          },
          "shorthand": token => token.name,
          "slice": token => {
              const {target, range, optional} = token;
              const {start, end} = range;
              const op = optional ? "?." : ".";

              const args = [start ?? {type: "num", value: 0}, end]
                  .filter(arg => arg !== undefined)
                  .map(arg => genJS(arg))
                  .join(", ");

              return `${genJS(target)}${op}slice(${args})`
          },
          "spread": token => `...${genJS(token.expr)}`,
          "string": token => {
              const {parts, value} = token;

              if (value !== undefined) {
                  return `"${value}"`
              }

              const jsParts = parts.map(
                  part => (typeof part === "string")
                      ? part.replace(/`/g, "\\`")
                      : `\${${genJS(part)}}`
              );

              return `\`${jsParts.join("")}\``
          },
          "tag": token => {
              const target = genJS(token.target);
              const str = genJS(token.str);

              if (str.startsWith("`") === true) {
                  return `${target}${str}`
              }

              return `${target}\`${str.slice(1, -1)}\``
          },
          "ternary": token => {
              const {condition, t, f} = token;
              const cond = genJS(condition);
              const tru = genJS(t);
              const fals = genJS(f);

              return `(${cond} ? ${tru} : ${fals})`
          },
          "throw": token => `throw ${genJS(token.expr)}`,
          "try": token => {
              const {body, handle, last} = token;
              const tblock = genJS(body).join("\n");
              const cblock = genJS(handle.body).join("\n");
              const fblock = last ? genJS(last).join("\n") : null;

              const tryPart = `try {\n${tblock}\n}`;
              const catchPart = `catch (${handle.name}) {\n${cblock}\n}`;
              const finalPart = fblock ? `finally {\n${fblock}\n}` : "";

              return [tryPart, catchPart, finalPart].join("\n")
          },
          "typeof": token => `typeof(${genJS(token.expr)})`,
          "unary": token => {
              const {op, expr, func, mode} = token;
              const wrapper = (mode !== undefined) ? `Promise${mode}` : "";

              return `${op} ${wrapper}(${genJS(expr)})`
          },
          "var": token => {
              if (token.name === rebind?.from) {
                  return rebind.to
              }
              return token.name
          },
          "void": () => "undefined",
      };

      const genJS = ast => {
          if (Array.isArray(ast)) {
              return ast.map(
                  (tok, pos) => tokenf[tok.type](tok, pos)
              )
          }
          return tokenf[ast.type](ast)
      };

      const generatedCode = genJS(source);
      const extra = scope[0].map(
          name => `let ${name} = null`
      );

      return [[...extra, ...generatedCode], topLevel]
  };

  var genJs = generateCode$1;

  const $safe$1 = async (func, args = []) => {
      try {
          return await func(...args)
      }
      catch (err) {
          return err
      }
  };
  const _safe$1 = (func, args = []) => {
      try {
          return func(...args)
      }
      catch (err) {
          return err
      }
  };

  var safe = {_safe: _safe$1, $safe: $safe$1};

  const teascript = parser;
  const generateCode = genJs;

  const {_safe, $safe} = safe;

  const pmax = (a, b) => {
      if (a === null) {
          return b
      }
      if (a.location.start.offset < b.location.start.offset) {
          return b
      }
      return a
  };
  const nth = (source, find, n) => {
      if (n <= 0) {
          return 0
      }
      let last = 0;
      let count = 0;

      for (; ;) {
          const next = source.indexOf(find, last);

          if (next === -1) {
              return -1
          }

          count += 1;
          if (count === n) {
              return next
          }

          last = next + find.length;
      }
  };

  const formatError = (last, err, sourceCode) => {
      const { line, column } = last.location.start;
      const start = nth(sourceCode, "\n", line - 2);
      const end = nth(sourceCode, "\n", line);

      const snippet =
          sourceCode
              .slice(start, end)
              .replace(/^\r?\n|\r?\n?$/g, "");
      const pointer = `${"-".repeat(column - 1)}^`;
      const loc = `line ${line}, col ${column}`;

      return `${err.message}\n${loc}\n${snippet}\n${pointer}`
  };
  const errorWith = (err, info) => {
      err.info = info;
      return err
  };

  const compile = async (sourceCode, topLevelTransform, options = {}) => {
      const {format} = options;
      let last = null;
      const tracer = {
          trace: evt => {
              if (evt.type !== "rule.fail") {
                  return
              }
              last = pmax(last, evt);
          }
      };
      const ast = _safe(teascript.parse, [sourceCode, { tracer }]);
      if (ast instanceof Error) {
          const err = new Error(
              formatError(last, ast, sourceCode)
          );
          return err
      }

      const compiledCode = await $safe(generateCode, [ast]);
      if (compiledCode instanceof Error) {
          return errorWith(compiledCode, ast)
      }
      const [js, topLevel] = compiledCode;

      const topLevelFuncs = await topLevelTransform(topLevel, options);
      const output = [...topLevelFuncs, ...js].join("\n");

      return {
          // code: prettier.format(output, prettyOptions),
          code: format(output),
          ast
      }
  };

  var compile_1 = compile;

  const builtinFuncs = {"_at":"const _at = (source, key, optional) => {\r\n    if (optional === true && source === undefined) {\r\n        return undefined\r\n    }\r\n    if (typeof key === \"string\" || key >= 0) {\r\n        return source[key]\r\n    }\r\n    return source[source.length + key]\r\n}","_range":"const _range = (start, end, inc, map = i => i) => {\r\n    if (start > end) {\r\n        const array_r = []\r\n        for (let item = start; item > end; item -= inc) {\r\n            array_r.push(\r\n                map(item)\r\n            )\r\n        }\r\n        return array_r\r\n    }\r\n\r\n    const array = []\r\n    for (let item = start; item < end; item += inc) {\r\n        array.push(\r\n            map(item)\r\n        )\r\n    }\r\n    return array\r\n}","_safe":"const _safe = (func) => {\r\n    try {\r\n        return func()\r\n    }\r\n    catch (err) {\r\n        return err\r\n    }\r\n}","_safe_async":"const _safe_async = async (func) => {\r\n    try {\r\n        return await func()\r\n    }\r\n    catch (err) {\r\n        return err\r\n    }\r\n}","_set":"const _set = (source, key, value) => {\r\n    if (typeof key === \"string\" || key >= 0) {\r\n        source[key] = value\r\n        return\r\n    }\r\n    source[source.length + key] = value\r\n}"};
  const prettyOptions = {
      parser: "babel",
      plugins: prettierPlugins,
      tabWidth: 4,
      arrowParens: "always",
      semi: false,
  };
  const topLevelTransform = async (sources, options) => {
      const { target, browser } = options;
      const src = [...sources];

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
  };

  const browserCompile = (source, options = {}) =>
      compile_1(
          source,
          topLevelTransform,
          {
              ...options,
              format: (code) => prettier.format(code, prettyOptions)
          }
      );

  return browserCompile;

})();
