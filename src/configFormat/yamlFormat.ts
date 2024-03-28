import YAML, { LineCounter, type ParsedNode } from "yaml";
import {
  type Document,
  type DocumentNode,
  type FindKey,
  type Format,
  type ParseResult,
} from "./configFormat";
import { type ObjPath } from "src/types";

export type YamlTagged<T> = {
  kind: "yaml";
  value: T;
};

function wrap<T>(value: T): YamlTagged<T> {
  return {
    kind: "yaml",
    value,
  };
}

type ParseResultWrapped<T, U> = ParseResult<YamlTagged<T>, YamlTagged<U>>;

export class YamlFormat implements Format {
  parse(
    s: string
  ): ParseResultWrapped<YamlDocument, YAML.Document.Parsed<YAML.ParsedNode>> {
    const lineCounter = new LineCounter();
    const doc = YAML.parseDocument(s, { lineCounter, prettyErrors: true });
    if (doc.errors.length !== 0) {
      return {
        is_ok: false,
        error: wrap(doc),
      };
    } else {
      return {
        is_ok: true,
        value: wrap(new YamlDocument(doc, lineCounter)),
      };
    }
  }
}

export class YamlDocument implements Document {
  constructor(
    private readonly doc: YAML.Document.Parsed,
    private readonly lineCounter: LineCounter
  ) {}

  toJS() {
    return this.doc.toJS();
  }

  asNode(): DocumentNode {
    return {
      loc: {
        start: this.lineCounter.linePos(this.doc.range[0]),
        end: this.lineCounter.linePos(this.doc.range[2]),
      },
    };
  }

  getIn(path: ObjPath): (DocumentNode & FindKey) | undefined {
    const n = this.doc.getIn(path, true) as ParsedNode | undefined;
    if (typeof n === "undefined") {
      return undefined;
    } else {
      return toDocumentNode(n, this.lineCounter);
    }
  }

  hasIn(path: ObjPath): boolean {
    return this.doc.hasIn(path);
  }
}

function toDocumentNode(
  node: YAML.ParsedNode,
  lineCounter: LineCounter
): DocumentNode & FindKey {
  return {
    loc: {
      start: lineCounter.linePos(node.range[0]),
      end: lineCounter.linePos(node.range[1]),
    },
    findKeyAsMap: findDelegator(node, lineCounter),
  };
}

function findDelegator(node: YAML.ParsedNode | null, lineCounter: LineCounter) {
  return (keyName: string) => {
    if (YAML.isMap(node)) {
      const key = node?.items.find(
        (pair) => pair.key.toString() === keyName
      )?.key;
      if (typeof key === "undefined") {
        return null;
      }
      return {
        loc: {
          start: lineCounter.linePos(key.range[0]),
          end: lineCounter.linePos(key.range[1]),
        },
      };
    } else {
      return null;
    }
  };
}
