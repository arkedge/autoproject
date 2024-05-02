import { type GetTeamMemberProp } from "./github";
import {
  type Team,
  type IssuesEvent,
  type PullRequestEvent,
} from "@octokit/webhooks-types";

export interface Repo {
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  fork: boolean;
  topics: string[];
}
export interface User {
  login: string;
}
export interface Label {
  name: string;
}
export interface Issue {
  labels?: Label[];
  assignees: User[];
}
export interface PullRequestHead {
  label: string;
  ref: string;
}
export interface PullRequest {
  labels?: Label[];
  requested_reviewers: Array<User | Team>;
  assignees: User[];
  head: PullRequestHead;
}

export interface MatchArg {
  repository: Repo;
  sender: User;
  issue: (Issue & GetTeamMemberProp) | null;
  pr: (PullRequest & GetTeamMemberProp) | null;
}

export enum TargetProjKind {
  Number,
  Only,
  Reject,
}

export interface TargetProjNumber {
  isPositive: boolean;
  value: number[];
  priority: number;
}

export interface TargetProjKindNumber {
  kind: TargetProjKind.Number;
  projectNumber: TargetProjNumber[];
}

export interface TargetProjOnly {
  kind: TargetProjKind.Only;
  projectNumber: number[];
  priority: number;
}

export interface TargetProjReject {
  kind: TargetProjKind.Reject;
  priority: number;
}

export type TargetProj =
  | TargetProjKindNumber
  | TargetProjOnly
  | TargetProjReject;

export enum WebhookEventKind {
  Issue,
  PullRequest,
}

export type WebhookEvent<A1, A2> =
  | {
      kind: WebhookEventKind.Issue;
      action: A1;
    }
  | {
      kind: WebhookEventKind.PullRequest;
      action: A2;
    };

export type WebhookEventAction = WebhookEvent<
  IssuesEvent["action"],
  PullRequestEvent["action"]
>;

export type EventTarget<E> =
  | {
      kind: "any";
    }
  | {
      kind: "oneof";
      list: E[];
    };

export type IssueActionTarget = {
  issueAction: EventTarget<IssuesEvent["action"]>;
};

export type PrActionTarget = {
  prAction: EventTarget<PullRequestEvent["action"]>;
};

export type WebhookEventActionTarget =
  | ({
      kind: "both";
    } & IssueActionTarget &
      PrActionTarget)
  | ({
      kind: WebhookEventKind.Issue;
    } & IssueActionTarget)
  | ({
      kind: WebhookEventKind.PullRequest;
    } & PrActionTarget);

export const isTargetWebhookEvent = (
  et: WebhookEventActionTarget,
  event: WebhookEventAction,
) => {
  switch (event.kind) {
    case WebhookEventKind.Issue:
      return (
        (et.kind === "both" || et.kind === WebhookEventKind.Issue) &&
        isTargetEvent(et.issueAction, event.action)
      );
    case WebhookEventKind.PullRequest:
      return (
        (et.kind === "both" || et.kind === WebhookEventKind.PullRequest) &&
        isTargetEvent(et.prAction, event.action)
      );
  }
};

export const isTargetEvent = <E>(et: EventTarget<E>, event: E) => {
  switch (et.kind) {
    case "any":
      return true;
    default:
      return et.list.includes(event);
  }
};

export type ObjPath = Array<string | number>;
export const stringifyObjPath = (objPath: ObjPath) =>
  objPath
    .map((p, index) => {
      if (index === 0) {
        return p.toString();
      }
      if (typeof p === "string") {
        return `.${p}`;
      } else {
        return `[${p}]`;
      }
    })
    .join("");

export type Pos = {
  line: number;
  col: number;
};

export type Range = {
  start: Pos;
  end?: Pos;
};

export type Range2 = {
  start: Pos;
  end: Pos;
};

export type Diag = {
  range: Range | null;
  msg: string;
};

export const nullPos: Pos = {
  line: 1,
  col: 1,
};

export type SynDiag = Diag;

export enum SemDiagKind {
  UnrecognizedKeys = "unrecognized_keys",
  Any = "any",
}

export type SemDiag = Diag & {
  objPath: ObjPath;
  diagKind:
    | {
        diagName: SemDiagKind.Any;
      }
    | {
        diagName: SemDiagKind.UnrecognizedKeys;
        key: {
          value: string;
          range: Range2;
        };
        candidates: string[];
      };
};

export type SynErrorPayload = {
  filepath: string;
  diags: SynDiag[];
};

export type SemErrorPayload = {
  filepath: string;
  diags: SemDiag[];
};
