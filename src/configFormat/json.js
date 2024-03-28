/* eslint-disable */
// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }

const moo = require('moo');

let lexer = moo.compile({
    space: {match: /\s+/, lineBreaks: true},
    number: /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?\b/,
    string: /"(?:\\["bfnrt\/\\]|\\u[a-fA-F0-9]{4}|[^"\\])*"/,
    "{": "{",
    "}": "}",
    "[": "[",
    "]": "]",
    ",": ",",
    ":": ":",
    true: "true",
    false: "false",
    null: "null",
})

function empty(type) {
  return function ([open,,close]) {
    return {
      type,
      children: [],
      loc: { start: pos(open), end: pos(close, 1) }
    };
  };
}

function children(type) {
  return function ([open,,first,rest,,,close]) {
    return {
      type,
      children: [
        first,
        ...rest.map(([,,,property]) => property)
      ],
      loc: { start: pos(open), end: pos(close, 1) }
    };
  };
}

function literal() {
  return function ([token]) {
    return {
      type: "Literal",
      value: JSON.parse(token.value),
      raw: token.text,
      loc: {
        start: pos(token),
        end: pos(token, token.text.length)
      }
    };
  };
}

function property([key,,,,value]) {
  return {
    type: "Property",
    key,
    value,
    loc: {
      start: key.loc.start,
      end: value.loc.end
    }
  };
}

function pos({ line, col, offset }, add = 0) {
  return {
    line,
    col: col + add,
    offset: offset + add
  };
}
var grammar = {
    Lexer: lexer,
    ParserRules: [
    {"name": "json", "symbols": ["_", "value", "_"], "postprocess": ([,val,]) => val},
    {"name": "object", "symbols": [{"literal":"{"}, "_", {"literal":"}"}], "postprocess": empty("Object")},
    {"name": "object$ebnf$1", "symbols": []},
    {"name": "object$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "property"]},
    {"name": "object$ebnf$1", "symbols": ["object$ebnf$1", "object$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "object$ebnf$2$subexpression$1", "symbols": [{"literal":","}, "_"]},
    {"name": "object$ebnf$2", "symbols": ["object$ebnf$2$subexpression$1"], "postprocess": id},
    {"name": "object$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "object", "symbols": [{"literal":"{"}, "_", "property", "object$ebnf$1", "_", "object$ebnf$2", {"literal":"}"}], "postprocess": children("Object")},
    {"name": "array", "symbols": [{"literal":"["}, "_", {"literal":"]"}], "postprocess": empty("Array")},
    {"name": "array$ebnf$1", "symbols": []},
    {"name": "array$ebnf$1$subexpression$1", "symbols": ["_", {"literal":","}, "_", "value"]},
    {"name": "array$ebnf$1", "symbols": ["array$ebnf$1", "array$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "array$ebnf$2$subexpression$1", "symbols": [{"literal":","}, "_"]},
    {"name": "array$ebnf$2", "symbols": ["array$ebnf$2$subexpression$1"], "postprocess": id},
    {"name": "array$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "array", "symbols": [{"literal":"["}, "_", "value", "array$ebnf$1", "_", "array$ebnf$2", {"literal":"]"}], "postprocess": children("Array")},
    {"name": "value", "symbols": ["object"], "postprocess": id},
    {"name": "value", "symbols": ["array"], "postprocess": id},
    {"name": "value", "symbols": [(lexer.has("true") ? {type: "true"} : true)], "postprocess": literal()},
    {"name": "value", "symbols": [(lexer.has("false") ? {type: "false"} : false)], "postprocess": literal()},
    {"name": "value", "symbols": [(lexer.has("null") ? {type: "null"} : null)], "postprocess": literal()},
    {"name": "value", "symbols": [(lexer.has("number") ? {type: "number"} : number)], "postprocess": literal()},
    {"name": "value", "symbols": [(lexer.has("string") ? {type: "string"} : string)], "postprocess": literal()},
    {"name": "property", "symbols": ["key", "_", {"literal":":"}, "_", "value"], "postprocess": property},
    {"name": "key", "symbols": [(lexer.has("string") ? {type: "string"} : string)], "postprocess": literal("Identifier")},
    {"name": "_", "symbols": []},
    {"name": "_", "symbols": [(lexer.has("space") ? {type: "space"} : space)], "postprocess": d => null}
]
  , ParserStart: "json"
}
if (typeof module !== 'undefined'&& typeof module.exports !== 'undefined') {
   module.exports = grammar;
} else {
   window.grammar = grammar;
}
})();
