import nearley from "nearley";
import grammar from "./json.js";
import {
  type Document,
  type DocumentNode,
  type FindKey,
  type Format,
  type ParseResult,
} from "./configFormat";
import { type ObjPath } from "../types";

const parserGrammar = nearley.Grammar.fromCompiled(
  grammar as nearley.CompiledRules
);

export type JsonTagged<T> = {
  kind: "json";
  value: T;
};

function wrap<T>(value: T): JsonTagged<T> {
  return {
    kind: "json",
    value,
  };
}

type ParseResultWrapped<T, U> = ParseResult<JsonTagged<T>, JsonTagged<U>>;

export class JsonFormat implements Format {
  parse(s: string): ParseResultWrapped<JsonDocument, LineCol | null> {
    try {
      const parser = new nearley.Parser(parserGrammar);
      parser.feed(s);
      const [value]: Value[] = parser.finish();
      return {
        is_ok: true,
        value: wrap(new JsonDocument(value)),
      };
    } catch (e) {
      // nearley + moo discards linecol of erroneous token while throwing error
      // recover it if possible
      const lc = recoverLineCol(e);
      return {
        is_ok: false,
        error: wrap(lc),
      };
    }
  }
}

export type LineCol = {
  line: number;
  col: number;
};

const reLc = /at line (\d) col (\d)/;

function recoverLineCol(e: any): LineCol | null {
  if (e instanceof Error) {
    const result = reLc.exec(e.message);
    if (result !== null) {
      return {
        line: Number(result[1]),
        col: Number(result[2]),
      };
    }
  }
  return null;
}

export class JsonDocument implements Document {
  constructor(private readonly value: Value) {}
  toJS() {
    return valueToJS(this.value);
  }

  asNode(): DocumentNode {
    return {
      loc: this.value.loc,
    };
  }

  getIn(path: ObjPath): (DocumentNode & FindKey) | undefined {
    let node: Value = this.value;
    for (const elem of path) {
      switch (node.type) {
        case "Object": {
          const pair = node.children.find((pair) => pair.key.value === elem);
          if (typeof pair === "undefined") {
            return undefined;
          }
          node = pair.value;
          break;
        }
        case "Array": {
          if (typeof elem !== "number") {
            return undefined;
          }
          node = node.children[elem];
          break;
        }
        case "Literal": {
          return undefined;
        }
      }
    }
    return toDocumentNode(node);
  }

  hasIn(path: ObjPath): boolean {
    let node: Value = this.value;
    for (const elem of path) {
      switch (node.type) {
        case "Object": {
          const pair = node.children.find((pair) => pair.key.value === elem);
          if (typeof pair === "undefined") {
            return false;
          }
          node = pair.value;
          break;
        }
        case "Array": {
          if (typeof elem !== "number") {
            return false;
          }
          node = node.children[elem];
          break;
        }
        case "Literal": {
          return false;
        }
      }
    }
    return true;
  }
}

interface Pos {
  line: number;
  col: number;
  offset: number;
}

interface Loc {
  start: Pos;
  end: Pos;
}

interface NodeBase {
  type: string;
  loc: Loc;
}

interface PrimitiveLiteral extends NodeBase {
  type: "Literal";
  value: any;
  raw: string;
}

interface Identifier extends NodeBase {
  type: "Identifier";
  value: any;
  raw: string;
}

interface ObjectNode extends NodeBase {
  type: "Object";
  children: Property[];
}

interface ArrayNode extends NodeBase {
  type: "Array";
  children: Value[];
}

type Value = PrimitiveLiteral | ObjectNode | ArrayNode;

interface Property extends NodeBase {
  type: "Property";
  key: Identifier;
  value: Value;
}

function valueToJS(value: Value): any {
  switch (value.type) {
    case "Literal": {
      return value.value;
    }
    case "Object": {
      const result: any = {};
      for (const prop of value.children) {
        result[prop.key.value] = valueToJS(prop.value);
      }
      return result;
    }
    case "Array": {
      const result = [];
      for (const elem of value.children) {
        result.push(valueToJS(elem));
      }
      return result;
    }
  }
}

function toDocumentNode(node: Value): DocumentNode & FindKey {
  return {
    loc: node.loc,
    findKeyAsMap: findDelegator(node),
  };
}

function findDelegator(node: Value | null) {
  return (keyName: string): DocumentNode | null => {
    if (node?.type === "Object") {
      const key = node?.children.find(
        (pair) => pair.key.value.toString() === keyName
      )?.key;
      if (typeof key === "undefined") {
        return null;
      }
      return {
        loc: key.loc,
      };
    } else {
      return null;
    }
  };
}
