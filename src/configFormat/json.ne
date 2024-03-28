# http://www.json.org/
# http://www.asciitable.com/
@lexer lexer

json -> _ value _ {% ([,val,]) => val %}

object ->
    "{" _ "}"                                            {% empty("Object") %}
  | "{" _ property (_ "," _ property):* _ ("," _ ):? "}" {% children("Object") %}

array ->
    "[" _ "]"                                       {% empty("Array") %}
  | "[" _ value (_ "," _ value):* _ ("," _ ):? "]"  {% children("Array") %}

value ->
    object  {% id %}
  | array   {% id %}
  | %true   {% literal() %}
  | %false  {% literal() %}
  | %null   {% literal() %}
  | %number {% literal() %}
  | %string {% literal() %}

property -> key _ ":" _ value {% property %}

key -> %string {% literal("Identifier") %}

_ -> null | %space {% d => null %}

@{%
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
%}
