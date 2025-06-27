import * as fs from "node:fs";
import { ErrorKind, processRules } from "./config";
import {
  type SemErrorPayload,
  type SynErrorPayload,
  type SemDiag,
  type SynDiag,
  stringifyObjPath,
  SemDiagKind,
  type Range as MyRange,
  nullPos,
} from "./types";
import { readAndParse, renameProp } from "./util";
import assert from "node:assert";
import { emitter } from "./emitter";
import * as dotenv from "dotenv";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import {
  type DiagnosticResult,
  type Range,
} from "./rdjson/DiagnosticResult.jsonschema";

const {
  input: inputPath,
  rdjson: outputRdjson,
  fix: doAutoFix,
} = yargs(hideBin(process.argv))
  .option("input", {
    alias: "i",
    type: "string",
    description: "Path to target file",
  })
  .option("rdjson", {
    type: "boolean",
    description: "Output diagnosis as Reviewdog Diagnostic Format (rdjson)",
  })
  .option("fix", {
    type: "boolean",
    description: "Fix problems if possible",
  })
  .parseSync();

dotenv.config();

const input = inputPath ?? process.env.RULES_FILE;
assert(input, "--input <PATH> or process.env.RULES_FILE is required");

const printSemDiag = (
  filepath: string,
  { range, msg, objPath, diagKind }: SemDiag,
) => {
  let semPos;
  if (objPath.length === 0) {
    semPos = "";
  } else {
    semPos = `At \`${stringifyObjPath(objPath)}\`: `;
  }
  switch (diagKind.diagName) {
    case SemDiagKind.UnrecognizedKeys: {
      const { line, col } = diagKind.key.range.start;
      console.log(`${filepath}:${line}:${col}: ${semPos}${msg}`);
      break;
    }
    default: {
      const { line, col } = range?.start ?? nullPos;
      console.log(`${filepath}:${line}:${col}: ${semPos}${msg}`);
      break;
    }
  }
};

const printSynDiag = (filepath: string, { range, msg }: SynDiag) => {
  const { line, col } = range?.start ?? nullPos;
  console.log(`${filepath}:${line}:${col}: ${msg}`);
};

if (outputRdjson !== true) {
  emitter.on("semerror", ({ filepath, diags }: SemErrorPayload) => {
    for (const diag of diags) {
      printSemDiag(filepath, diag);
    }
  });

  emitter.on("synerror", ({ filepath, diags }: SynErrorPayload) => {
    for (const diag of diags) {
      printSynDiag(filepath, diag);
    }
  });
}

const { docResult, error } = readAndParse(input, processRules)!;
if (outputRdjson === true) {
  const rdjson: DiagnosticResult = {
    source: {
      name: "autopjlint",
    },
    diagnostics: [],
  };
  for (const e of error) {
    switch (e.type) {
      case ErrorKind.Syn: {
        rdjson.diagnostics!.push({
          message: e.diag.msg,
          location: {
            path: input,
            range: convertRange(e.diag.range),
          },
        });
        break;
      }
      case ErrorKind.Sem: {
        const suggestions: Array<{ range: Range | undefined; text: string }> =
          [];
        if (e.diag.diagKind.diagName === SemDiagKind.UnrecognizedKeys) {
          const { candidates } = e.diag.diagKind;
          if (candidates.length !== 0) {
            suggestions.push({
              range: convertRange(e.diag.diagKind.key.range),
              text: candidates[0],
            });
          }
        }
        rdjson.diagnostics!.push({
          message: e.diag.msg,
          location: {
            path: input,
            range: convertRange(e.diag.range),
          },
          suggestions: suggestions.length !== 0 ? suggestions : undefined,
        });
        break;
      }
      default:
        break;
    }
  }
  console.log(JSON.stringify(rdjson));
}
// failed to parse
if (!docResult.is_ok) {
  if (doAutoFix === true && docResult.docRaw.kind === "yaml") {
    let modified = false;
    for (const e of error) {
      if (
        e.type === ErrorKind.Sem &&
        e.diag.diagKind.diagName === SemDiagKind.UnrecognizedKeys
      ) {
        const { key, candidates } = e.diag.diagKind;
        if (candidates.length !== 0) {
          renameProp(
            docResult.docRaw.value,
            e.diag.objPath,
            key.value,
            candidates[0],
          );
          modified = true;
        }
      }
    }
    if (modified) {
      fs.writeFileSync(input, docResult.docRaw.value.toString(), "utf-8");
    }
  }
}

function convertRange(r: MyRange | null): Range | undefined {
  if (r === null) {
    return undefined;
  }
  return {
    start: {
      line: r.start.line,
      column: r.start.col,
    },
    end:
      r.end !== undefined
        ? {
            line: r.end.line,
            column: r.end.col,
          }
        : undefined,
  };
}
