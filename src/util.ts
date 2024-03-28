import * as fs from "fs";
import log4js, { getLogger } from "log4js";
import path from "path";
import YAML, { isMap, isScalar } from "yaml";
import { emitter } from "./emitter";
import {
  type ObjPath,
  type SemErrorPayload,
  stringifyObjPath,
  type SynErrorPayload,
} from "./types";
import assert from "assert";
import {
  type ConfigFormatKind,
  type EitherFormat,
  getFormat,
} from "./configFormat/configFormat";

export const readAndParse = <T>(
  filepath: string | undefined,
  parser: (format: EitherFormat, filepath: string, src: string) => T
) => {
  if (typeof filepath === "undefined") {
    return null;
  }
  const raw = fs.readFileSync(filepath, "utf-8");
  const ext = path.extname(filepath).substring(1);
  let formatKind: ConfigFormatKind;
  switch (ext) {
    case "json":
      formatKind = "json";
      break;
    case "yaml":
    case "yml":
      formatKind = "yaml";
      break;
    default:
      assert(
        false,
        "received unknown extension. please use `.json` or `.yaml` or `.yml`."
      );
  }
  return parser(getFormat(formatKind), filepath, raw);
};

export const renameProp = (
  doc: YAML.Document.Parsed,
  path: ObjPath,
  oldProp: string,
  newProp: string
) => {
  const node = doc.getIn(path);
  assert(isMap(node));
  YAML.visit(node, {
    Pair(_, pair) {
      if (isScalar(pair.key) && pair.key.value === oldProp) {
        pair.key.value = newProp;
      }
      return YAML.visit.SKIP;
    },
  });
};

export const doLogError = () => {
  emitter.on("semerror", ({ filepath, diags }: SemErrorPayload) => {
    const cat = path.basename(filepath);
    getLogger(cat).error(
      "Some semantic errors occurred while validating config file. Below are reported:"
    );
    for (const diag of diags) {
      const _path = stringifyObjPath(diag.objPath);
      const header = _path === "" ? "" : _path + ": ";
      getLogger(cat).error(`${header}${diag.msg}`);
    }
  });

  emitter.on("synerror", ({ filepath, diags }: SynErrorPayload) => {
    const cat = path.basename(filepath);
    getLogger(cat).error(
      "Some syntactic errors occurred while validating config file. Below are reported:"
    );
    for (const diag of diags) {
      const { range, msg } = diag;
      if (range !== null) {
        const { line, col } = range.start;
        getLogger(cat).error(`At line ${line}, column ${col}: ${msg}`);
      } else {
        getLogger(cat).error(`${msg} at unknown pos`);
      }
    }
  });
};

export const configLogger = () => {
  log4js.configure({
    appenders: {
      console: {
        type: "console",
        layout: {
          type: "colored",
        },
      },
      stdout: {
        type: "stdout",
        layout: {
          type: "basic",
        },
      },
    },
    categories: {
      default: {
        appenders: ["stdout"],
        level: "all",
      },
      test: {
        appenders: ["console"],
        level: "all",
      },
    },
  });
};

declare const _loggerCat: unique symbol;
export type LoggerCat = string & { readonly [_loggerCat]: never };

export const getLoggerCat = (filepath: string) =>
  path.basename(filepath) as LoggerCat;
