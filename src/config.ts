import { type YAMLError } from "yaml";
import type YAML from "yaml";
import { z } from "zod";
import { emitter } from "./emitter";
import {
  type ObjPath,
  type SemDiag,
  SemDiagKind,
  type SynDiag,
  type Diag,
  type MatchArg,
  WebhookEventKind,
  type WebhookEventActionTarget,
  isTargetWebhookEvent,
  type WebhookEventAction,
  type EventTarget,
  type TargetProj,
  TargetProjKind,
  type TargetProjNumber,
  type TargetProjOnly,
  type TargetProjReject,
} from "./types";
import Fuse from "fuse.js";
import assert from "assert";
import { getLogger } from "log4js";
import {
  type APred,
  type RuleSchema,
  type ZodPathComponentUsed,
  configSchema,
  forallAsync,
  flatten,
  versionedSchema,
} from "./configSchema";
import { type YamlDocument, type YamlTagged } from "./configFormat/yamlFormat";
import {
  type JsonDocument,
  type JsonTagged,
  type LineCol,
} from "./configFormat/jsonFormat";
import { type Document, type EitherFormat } from "./configFormat/configFormat";

const createSearcher = (path: ObjPath) => {
  return new Fuse(tryExtractPossibleKeysAt(path));
};

const tryExtractPossibleKeysAt = (path: ObjPath) => {
  try {
    let def: ZodPathComponentUsed = versionedSchema._def;
    for (const elem of path) {
      let next: ZodPathComponentUsed;
      if (typeof elem === "number") {
        assert(def.typeName === z.ZodFirstPartyTypeKind.ZodArray);
        next = def.type._def;
      } else {
        assert(def.typeName === z.ZodFirstPartyTypeKind.ZodObject);
        const shape = def.shape();
        next = shape[elem]._def;
      }
      def = peelTransformer(next);
    }
    assert(def.typeName === z.ZodFirstPartyTypeKind.ZodObject);
    return Object.keys(def.shape());
  } catch (e) {
    if (e instanceof Error) {
      getLogger("debug").error(e.message);
    }
    return [];
  }
};

const peelTransformer = (def: ZodPathComponentUsed): ZodPathComponentUsed => {
  if (def.typeName === z.ZodFirstPartyTypeKind.ZodOptional) {
    const newDef: ZodPathComponentUsed = def.innerType._def;
    def = peelTransformer(newDef);
  }
  if (def.typeName === z.ZodFirstPartyTypeKind.ZodEffects) {
    const newDef: ZodPathComponentUsed = def.schema._def;
    def = peelTransformer(newDef);
  }
  return def;
};

export interface Config {
  get: (x: string) => number[] | undefined;
}

interface Rule {
  test: APred<MatchArg>;
  webhookEventTarget: WebhookEventActionTarget;
  targetProj: TargetProj;
}

export async function getMatchedProj(
  rules: Rule[],
  webhookEvent: WebhookEventAction,
  obj: MatchArg,
): Promise<number[]> {
  const ruleMatchedProjectNumbers = await Promise.all(
    rules.map(async (rule) => {
      if (isTargetWebhookEvent(rule.webhookEventTarget, webhookEvent)) {
        if (await rule.test(obj)) {
          return rule.targetProj;
        }
      }
      return [];
    }),
  );
  const targetProjs: TargetProj[] = ruleMatchedProjectNumbers.flat();
  return filterTargetProjs(targetProjs);
}

function filterTargetProjs(targetProjs: TargetProj[]): number[] {
  // lift `priority` from `TargetProjNumber`
  const targetProjsFlat = targetProjs.flatMap(
    (
      p: TargetProj,
    ): Array<
      | ({ kind: TargetProjKind.Number } & TargetProjNumber)
      | TargetProjOnly
      | TargetProjReject
    > => {
      if (p.kind === TargetProjKind.Number) {
        return p.projectNumber.map((n) => ({
          kind: TargetProjKind.Number,
          ...n,
        }));
      }
      return [p];
    },
  );
  // dictionary order (priority >> kind)
  targetProjsFlat.sort((a, b) => {
    if (a.priority === b.priority) {
      if (a.kind === b.kind) {
        return 0;
      } else {
        return a.kind - b.kind;
      }
    } else {
      return a.priority - b.priority;
    }
  });
  let projSet = new Set<number>();
  for (const targetProj of targetProjsFlat) {
    switch (targetProj.kind) {
      case TargetProjKind.Number: {
        if (targetProj.isPositive) {
          for (const n of targetProj.value) {
            projSet.add(n);
          }
        } else {
          for (const n of targetProj.value) {
            projSet.delete(n);
          }
        }
        break;
      }
      case TargetProjKind.Only: {
        projSet = new Set<number>(targetProj.projectNumber);
        break;
      }
      case TargetProjKind.Reject: {
        // no projects to add
        return [];
      }
    }
  }
  return [...projSet];
}

export function processRulesV0(
  format: EitherFormat,
  filepath: string,
  src: string,
): ParseResult<Config> {
  const { docResult, content, error } = parseFile(
    format,
    configSchema,
    filepath,
    src,
  );
  return {
    docResult,
    content: content !== null ? new Map(Object.entries(content)) : null,
    error,
  };
}

export enum ErrorKind {
  Syn = "syn",
  Sem = "sem",
  Unknown = "?",
}

type ParseError =
  | {
      type: ErrorKind.Syn;
      diag: SynDiag;
    }
  | {
      type: ErrorKind.Sem;
      diag: SemDiag;
    }
  | {
      type: ErrorKind.Unknown;
      error: unknown;
    };

type YamlDocResult =
  | {
      is_ok: true;
      doc: JsonDocument | YamlDocument;
    }
  | {
      is_ok: false;
      docRaw:
        | YamlTagged<YAML.Document.Parsed<YAML.ParsedNode>>
        | JsonTagged<LineCol | null>;
    };

export type ParseResult<T> = {
  docResult: YamlDocResult;
  content: T | null;
  error: ParseError[];
};

function parseFile<Schema extends z.ZodType<any, any, any>>(
  format: EitherFormat,
  schema: Schema,
  filepath: string,
  yaml: string,
): ParseResult<Schema["_output"]> {
  const result = format.parse(yaml);
  if (!result.is_ok) {
    const doc = result.error;
    let diags;
    switch (doc.kind) {
      case "json":
        diags = extractJsonSynDiag(doc.value);
        break;
      case "yaml":
        diags = extractYamlSynDiag(doc.value.errors);
        break;
      default:
        assert(false, "configFormat is not exhaustive");
    }
    emitter.emit("synerror", { filepath, diags });
    return {
      docResult: {
        is_ok: false,
        docRaw: doc,
      },
      content: null,
      error: diags.map((diag) => {
        return { type: ErrorKind.Syn, diag };
      }),
    };
  }
  const doc = result.value.value;
  const raw: unknown = doc.toJS();
  const zResult = schema.safeParse(raw);
  if (zResult.success) {
    return {
      docResult: {
        is_ok: true,
        doc,
      },
      content: zResult.data,
      error: [],
    };
  } else {
    const diags = extractSemDiag(doc, zResult.error);
    emitter.emit("semerror", { filepath, diags });
    return {
      docResult: {
        is_ok: true,
        doc,
      },
      content: null,
      error: diags.map((diag) => {
        return { type: ErrorKind.Sem, diag };
      }),
    };
  }
}

const transformRule = (parsed: RuleSchema) => {
  const parts = [parsed.repo, parsed.issue, parsed.pr].flatMap((l) => l ?? []);
  const rule: Rule = {
    test: async (obj: MatchArg) =>
      await forallAsync(parts, async (value) => await value(obj)),
    webhookEventTarget: getWebhookEventTarget(parsed),
    targetProj: parsed.project,
  };
  return rule;
};

const getEventTarget = <E>(on: "any" | E | E[]): EventTarget<E> => {
  if (on === "any") {
    return {
      kind: "any",
    };
  } else {
    return {
      kind: "oneof",
      list: flatten(on),
    };
  }
};

function getWebhookEventTarget(parsed: RuleSchema): WebhookEventActionTarget {
  if (typeof parsed.pr === "undefined") {
    if (typeof parsed.issue === "undefined") {
      // repo only
      return {
        kind: "both",
        issueAction: getEventTarget(parsed.on?.issue ?? "any"),
        prAction: getEventTarget(parsed.on?.pr ?? "any"),
      };
    } else {
      // issue rule
      return {
        kind: WebhookEventKind.Issue,
        issueAction: getEventTarget(parsed.on?.issue ?? "any"),
      };
    }
  } else {
    return {
      kind: WebhookEventKind.PullRequest,
      prAction: getEventTarget(parsed.on?.pr ?? "any"),
    };
  }
}

export function processRules(
  format: EitherFormat,
  filepath: string,
  src: string,
): ParseResult<Rule[]> {
  const { docResult, content, error } = parseFile(
    format,
    versionedSchema,
    filepath,
    src,
  );
  return {
    docResult,
    content: content?.rules.map(transformRule) ?? null,
    error,
  };
}

const extractSemDiag = (doc: Document, error: z.ZodError) => {
  const extractFromDoc = (path: ObjPath, msg: string) => {
    const node = doc.getIn(path);
    if (typeof node !== "undefined") {
      const diag: SemDiag = {
        objPath: path,
        msg: msg.split("\n")[0],
        diagKind: {
          diagName: SemDiagKind.Any,
        },
        range: {
          start: node.loc.start,
          end: node.loc.end,
        },
      };
      return diag;
    } else {
      throw new Error(`invalid object path: ${path.toString()}`);
    }
  };
  const diags = error.issues.flatMap((issue) => {
    const path = issue.path;
    if (path.length === 0) {
      const diag: SemDiag = {
        objPath: path,
        msg: issue.message,
        range: {
          start: doc.asNode().loc.start,
          end: doc.asNode().loc.end,
        },
        diagKind: {
          diagName: SemDiagKind.Any,
        },
      };
      return [diag];
    }
    if (issue.code === "unrecognized_keys") {
      return issue.keys.map((k) => {
        const elem = doc.getIn(path)!;
        const key = elem.findKeyAsMap(k)!;
        const candidates = [
          ...createSearcher(path)
            .search(k)
            .map((fr) => fr.item),
        ];
        let msg = `Unrecognized key: '${k}'`;
        if (candidates.length !== 0) {
          msg += `. Did you mean '${candidates[0]}'?`;
        }
        const diag: SemDiag = {
          objPath: path,
          msg,
          diagKind: {
            diagName: SemDiagKind.UnrecognizedKeys,
            key: {
              value: k,
              range: {
                start: key.loc.start,
                end: key.loc.end,
              },
            },
            candidates,
          },
          range: {
            start: elem.loc.start,
            end: elem.loc.end,
          },
        };
        return diag;
      });
    }
    let msg;
    if (
      (issue.code === "invalid_union" &&
        issue.unionErrors.every((e) =>
          e.errors.every((e) => e.message === "Required"),
        )) ||
      issue.message === "Required"
    ) {
      msg = `'${path.at(-1)!}' is required`;
    } else {
      msg = issue.message;
    }
    const docPath = doc.hasIn(path) ? path : path.slice(0, -1);
    return [extractFromDoc(docPath, msg)];
  });
  return diags;
};

const extractYamlSynDiag = (errors: YAMLError[]) => {
  return errors.map((error) => {
    const r: Diag = {
      msg: error.message,
      range: {
        start: error.linePos![0],
        end: error.linePos![1],
      },
    };
    return r;
  });
};

const extractJsonSynDiag = (lc: LineCol | null) => {
  const start = lc ?? {
    line: 1,
    col: 1,
  };
  const d: SynDiag = {
    msg: "syntax error",
    range: {
      start,
    },
  };
  return [d];
};
