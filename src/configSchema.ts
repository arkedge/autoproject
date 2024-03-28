import { getAllTeamMember, type GetTeamMemberProp } from "./github";
import { z } from "zod";
import {
  type Issue,
  type Label,
  type Repo,
  type MatchArg,
  type PullRequest,
  type User,
  TargetProjKind,
  type TargetProjNumber,
  type TargetProjOnly,
  type TargetProjReject,
  type PullRequestHead,
  type TargetProjKindNumber,
} from "./types";

type Pred<X> = (x: X) => boolean;
export type APred<X> = (x: X) => Promise<boolean>;

type ArrayOrInner<T> = T | T[];

export const flatten = <T>(a: ArrayOrInner<T>) => {
  if (Array.isArray(a)) {
    return a;
  }
  return [a];
};

const id = <T>(x: T) => x;

const propProj =
  <T, K extends keyof T>(key: K) =>
  (t: T) =>
    t[key];

const existsAsync = async <Y>(arr: Y[], predicate: APred<Y>) => {
  for (const e of arr) {
    if (await predicate(e)) return true;
  }
  return false;
};

export const forallAsync = async <Y>(arr: Y[], predicate: APred<Y>) => {
  for (const e of arr) {
    if (!(await predicate(e))) return false;
  }
  return true;
};

const composeE =
  <X, Y, Z>(f: (x: X) => ArrayOrInner<Y>, g: Array<(x: Y) => Z>) =>
  (x: X) => {
    const y = flatten(f(x));
    return g.some((g) => y.some((y) => g(y)));
  };

const composeEAsync =
  <X, Y>(f: (x: X) => ArrayOrInner<Y>, g: Array<(x: Y) => Promise<boolean>>) =>
  async (x: X) => {
    const y = flatten(f(x));
    return await existsAsync(
      g,
      async (g) => await existsAsync(y, async (y) => await g(y))
    );
  };

const composeA =
  <X, Y, Z>(f: (x: X) => ArrayOrInner<Y>, g: Array<(x: Y) => Z>) =>
  (x: X) => {
    const y = flatten(f(x));
    return g.every((g) => y.some((y) => g(y)));
  };

const composeAAsync =
  <X, Y>(f: (x: X) => ArrayOrInner<Y>, g: Array<(x: Y) => Promise<boolean>>) =>
  async (x: X) => {
    const y = flatten(f(x));
    return await forallAsync(
      g,
      async (g) => await existsAsync(y, async (y) => await g(y))
    );
  };

const extendE =
  <X, Y>(f: (_: X) => Y) =>
  (ps: ArrayOrInner<Pred<Y>>) =>
    composeE(f, flatten(ps));

const extendEAsync =
  <X, Y>(f: (_: X) => Y) =>
  (ps: ArrayOrInner<APred<Y>>) =>
    composeEAsync(f, flatten(ps));

const extendPropE =
  <X>() =>
  <K extends keyof X>(key: K) =>
  (ps: ArrayOrInner<Pred<X[K]>>) =>
    composeE(propProj(key), flatten(ps));

const extendPropA =
  <X>() =>
  <K extends keyof X>(key: K) =>
  (ps: ArrayOrInner<Pred<X[K]>>) =>
    composeA(propProj(key), flatten(ps));

const extendPropAAsync =
  <X>() =>
  <K extends keyof X>(key: K) =>
  (ps: ArrayOrInner<APred<X[K]>>) =>
    composeAAsync(propProj(key), flatten(ps));

const asAsync =
  <X>(p: Pred<X>) =>
  async (x: X) =>
    p(x);

const arrayOneOf = <X>(ps: ArrayOrInner<Pred<X>>) =>
  composeE((x: X[]) => x, flatten(ps));

const nullTolerantAAsync =
  <X>(ps: ArrayOrInner<APred<X>>) =>
  async (x: X | null) => {
    if (x === null) {
      // identity element of `and`
      return true;
    } else {
      return await composeAAsync(id<X>, flatten(ps))(x);
    }
  };

const unit = <T>(a: T) => [a];

const _number = z.number().int().nonnegative();

const numberParser = z.union([_number.transform(unit), _number.array()], {
  errorMap: (issue, ctx) => {
    if (
      issue.code === z.ZodIssueCode.invalid_union &&
      issue.unionErrors.length === 2
    ) {
      const [num, arr] = issue.unionErrors;
      if (num.issues.every((i) => i.code === z.ZodIssueCode.invalid_type)) {
        const issue = num.issues.at(0) as z.ZodInvalidTypeIssue;
        if (
          num.issues.every(
            (i) =>
              // i.code === z.ZodIssueCode.invalid_type is required because of type inference
              i.code === z.ZodIssueCode.invalid_type &&
              i.received === z.ZodParsedType.array
          )
        ) {
          // error is array of something
          // return `arr` to delegate error message
          return arr;
        } else {
          return {
            message: `Expected number or array of number, received ${issue.received}`,
          };
        }
      } else {
        // received a number, but invalid as a number (will be negative or float)
        // return `num` to delegate error message
        return num;
      }
    }
    return { message: ctx.defaultError };
  },
});

export const configSchema = z.record(numberParser);

const stringEq = (value: string, ctx: z.RefinementCtx): Pred<string | null> => {
  if (value.startsWith("/") && value.endsWith("/")) {
    try {
      const regexp = new RegExp(value.substring(1, value.length - 1));
      return (prop: string | null) => regexp.test(prop ?? "");
    } catch (e) {
      if (e instanceof SyntaxError) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid regexp: ${e.message}`,
        });
      }
      return z.NEVER;
    }
  } else {
    return (prop: string | null) => prop === value;
  }
};

const curryingStrictEq =
  <T>(x: T) =>
  (y: T) =>
    x === y;

const _string = z.string().transform(stringEq);

const stringish = _string.transform(unit).or(_string.array());

const booleanParser = z.boolean().transform(curryingStrictEq);

const repoSchema = z.object({
  name: stringish.transform(extendPropE<Repo>()("name")),
  full_name: stringish.transform(extendPropE<Repo>()("full_name")),
  description: stringish.transform(extendPropE<Repo>()("description")),
  fork: booleanParser.transform(extendPropE<Repo>()("fork")),
  private: booleanParser.transform(extendPropE<Repo>()("private")),
  topics: stringish
    .transform(arrayOneOf)
    .transform(extendPropE<Repo>()("topics")),
});

const lazyAsync = <X, T>(f: (i: X) => Promise<T>) => {
  let p: Promise<T> | undefined;
  return async (i: X) => {
    if (typeof p === "undefined") {
      p = f(i);
    }
    return await p;
  };
};

const teamRegex =
  /^([a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38})\/([a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38})$/i;

const loginEq =
  <X>(proj: (_: X) => User[]) =>
  (value: string): APred<X & GetTeamMemberProp> => {
    const r = teamRegex.exec(value);
    if (r === null) {
      return async (x: X) => {
        return proj(x).some((g) => curryingStrictEq(g.login)(value));
      };
    } else {
      const p = lazyAsync(async (i: X & GetTeamMemberProp) => {
        return await getAllTeamMember(i, r[1], r[2]);
      });
      return async (x: X & GetTeamMemberProp) => {
        const y = await p(x);
        return proj(x).some((g) =>
          y.some((y) => curryingStrictEq(g.login)(y.login))
        );
      };
    }
  };

const loginStr = <X>(proj: (_: X) => User[]) =>
  z.string().transform(loginEq(proj));

const loginParser = <X>(proj: (_: X) => User[]) =>
  loginStr(proj).transform(unit).or(loginStr(proj).array());

const labelParser = stringish
  .transform(extendPropE<Label>()("name"))
  .transform(arrayOneOf)
  .transform(extendE((ls: Label[] | undefined) => ls ?? []));

const issueSchema = z.object({
  assignees: loginParser(
    (x: Issue & GetTeamMemberProp) => x.assignees
  ).transform(extendEAsync((x: Issue & GetTeamMemberProp) => x)),
  labels: labelParser
    .transform(extendPropE<Issue>()("labels"))
    .transform(asAsync),
});

const prSchema = z.object({
  reviewers: loginParser((x: PullRequest & GetTeamMemberProp) =>
    x.requested_reviewers.flatMap((u) => {
      // filter out `Team`
      if ("login" in u) {
        return [u];
      } else {
        return [];
      }
    })
  ).transform(extendEAsync((x: PullRequest & GetTeamMemberProp) => x)),
  assignees: loginParser(
    (x: PullRequest & GetTeamMemberProp) => x.assignees
  ).transform(extendEAsync((x: PullRequest & GetTeamMemberProp) => x)),
  labels: labelParser
    .transform(extendPropE<PullRequest>()("labels"))
    .transform(asAsync),
  head: z
    .object({
      label: stringish.transform(extendPropE<PullRequestHead>()("label")),
      ref: stringish.transform(extendPropE<PullRequestHead>()("ref")),
    })
    .strict()
    .partial()
    .transform((p) => Object.values(p))
    .transform(extendPropA<PullRequest>()("head"))
    .transform(asAsync),
});

const issueActionLiteral = z.union([
  z.literal("opened"),
  z.literal("assigned"),
  z.literal("labeled"),
]);

const prActionLiteral = z.union([
  z.literal("opened"),
  z.literal("assigned"),
  z.literal("labeled"),
]);

const payloadSchema = z.object({
  repo: repoSchema
    .strict()
    .partial()
    .transform((p) => Object.values(p))
    .transform(extendPropA<MatchArg>()("repository"))
    .transform(asAsync),
  sender: loginParser((x: MatchArg & GetTeamMemberProp) => [
    x.sender,
  ]).transform(extendEAsync((x: MatchArg & GetTeamMemberProp) => x)),
  issue: issueSchema
    .strict()
    .partial()
    .transform((p) => Object.values(p))
    .transform(nullTolerantAAsync)
    .transform(extendPropAAsync<MatchArg>()("issue")),
  pr: prSchema
    .strict()
    .partial()
    .transform((p) => Object.values(p))
    .transform(nullTolerantAAsync)
    .transform(extendPropAAsync<MatchArg>()("pr")),
  on: z
    .object({
      issue: z
        .literal("any")
        .or(issueActionLiteral.or(issueActionLiteral.array())),
      pr: z.literal("any").or(prActionLiteral.or(prActionLiteral.array())),
    })
    .strict()
    .partial(),
});

const targetProjNumberSchema = _number
  .transform((n: number) => {
    const targetProjectNumber: TargetProjNumber = {
      isPositive: true,
      value: [n],
      priority: 0,
    };
    return [targetProjectNumber];
  })
  .or(
    z
      .object({
        not: numberParser.transform((n: ArrayOrInner<number>) => {
          const projectNumber = flatten(n).map((n: number) => {
            const projectNumber: TargetProjNumber = {
              isPositive: false,
              value: [n],
              priority: 0,
            };
            return projectNumber;
          });
          return projectNumber;
        }),
      })
      .transform((x) => x.not)
  );

const targetProjSchema = targetProjNumberSchema
  .or(targetProjNumberSchema.array())
  .transform((n) => {
    const r: TargetProjKindNumber = {
      kind: TargetProjKind.Number,
      projectNumber: n.flat(),
    };
    return r;
  })
  .or(
    z
      .object({
        only: numberParser.transform((n: ArrayOrInner<number>) => {
          const r: TargetProjOnly = {
            kind: TargetProjKind.Only,
            projectNumber: flatten(n),
            priority: 0,
          };
          return r;
        }),
      })
      .transform((x) => x.only)
  )
  .or(
    z
      .object({
        reject: z.object({}).transform(() => {
          const r: TargetProjReject = {
            kind: TargetProjKind.Reject,
            priority: 0,
          };
          return r;
        }),
      })
      .transform((x) => x.reject)
  );

const ruleSchema = payloadSchema
  .partial()
  .extend({
    project: targetProjSchema,
  })
  .strict()
  .refine(
    (p) => typeof p.issue === "undefined" || typeof p.pr === "undefined",
    "issue and pr cannot be specified together"
  )
  .refine((p) => {
    // issue rule
    if (typeof p.issue !== "undefined") {
      if (typeof p.on === "undefined") {
        // ok
      } else {
        if (typeof p.on.pr !== "undefined") {
          return false;
        }
      }
    }
    return true;
  }, "pr event do not fire issue rule")
  .refine((p) => {
    // pr rule
    if (typeof p.pr !== "undefined") {
      if (typeof p.on === "undefined") {
        // ok
      } else {
        if (typeof p.on.issue !== "undefined") {
          return false;
        }
      }
    }
    return true;
  }, "issue event do not fire pr rule");

export type RuleSchema = z.infer<typeof ruleSchema>;

const rulesSchema = ruleSchema.array();

export const versionedSchema = z.object({
  version: z.string(),
  rules: rulesSchema,
});

export type ZodPathComponentUsed =
  | z.ZodOptionalDef // from partial()
  | z.ZodEffectsDef // from transform(), refine()
  | z.ZodArrayDef // from array()
  | z.ZodObjectDef; // from object(), extend()
