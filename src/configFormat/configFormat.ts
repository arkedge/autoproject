import { type ObjPath, type Range2 } from "../types";
import { JsonFormat } from "./jsonFormat";
import { YamlFormat } from "./yamlFormat";

export type ParseResult<T, E> =
  | {
      is_ok: true;
      value: T;
    }
  | {
      is_ok: false;
      error: E;
    };

export type ConfigFormatKind = "yaml" | "json";
type KindTagged<T> = {
  kind: ConfigFormatKind;
  value: T;
};
export type EitherFormat = YamlFormat | JsonFormat;

export function getFormat(kind: ConfigFormatKind): EitherFormat {
  if (kind === "yaml") {
    return new YamlFormat();
  } else {
    return new JsonFormat();
  }
}

export interface Format {
  parse: (s: string) => ParseResult<KindTagged<Document>, KindTagged<any>>;
}

export interface Document {
  toJS: () => unknown;
  asNode: () => DocumentNode;
  getIn: (path: ObjPath) => (DocumentNode & FindKey) | undefined;
  hasIn: (path: ObjPath) => boolean;
}

export interface FindKey {
  findKeyAsMap: (key: string) => DocumentNode | null;
}

export interface DocumentNode {
  loc: Range2;
}
