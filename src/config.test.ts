import type {
  Repo,
  Issue,
  User,
  Label,
  PullRequest,
  TargetProj,
} from "./types";
import { TargetProjKind, WebhookEventKind } from "./types";
import { type OctokitResponse } from "@octokit/types";
import { processRules, getMatchedProj } from "./config";
import * as fs from "fs";
import { expect, it, vi } from "vitest";
import { type LoggerCat } from "./util";
import { type GetTeamMemberProp } from "./github";
import { OctokitRestMock } from "./github.mock";
import { getFormat } from "./configFormat/configFormat";

const loggerCat = "test" as LoggerCat;

const processYamlRules = (yaml: string) =>
  processRules(getFormat("yaml"), loggerCat, yaml);

it("fails to parse empty rule without throw", () => {
  const yaml = "";
  expect(processYamlRules(yaml).content).toEqual(null);
});

it("can parse readme rules", () => {
  const yaml = fs.readFileSync("./test/readme_rule.yaml", "utf-8");
  const rules = processYamlRules(yaml).content!;
  expect(rules.length).toBe(6);
  expect(rules[1].targetProj).toSatisfy((t: TargetProj) => {
    if (t.kind === TargetProjKind.Number) {
      if (
        t.projectNumber.flatMap((n) => n.value).toString() === [2, 3].toString()
      ) {
        return true;
      }
    }
    return false;
  });
});

it("can match with readme rules", async () => {
  const yaml = fs.readFileSync("./test/readme_rule.yaml", "utf-8");
  const repository: Repo = {
    name: "example-repo1",
    full_name: "the_owner/example-repo1",
    private: false,
    description: null,
    fork: false,
    topics: ["example-topic"],
  };
  const user: User = {
    login: "octocat",
  };
  const sender: User = {
    login: "sender",
  };
  const user2: User = {
    login: "novemdog",
  };
  const label: Label = {
    name: "bug",
  };
  const mock = vi.fn().mockImplementation(async () => {
    const resp = { data: [user] };
    return resp;
  });
  const octokit = OctokitRestMock(mock);
  const issue: Issue & GetTeamMemberProp = {
    assignees: [user],
    labels: [label],
    octokit,
  };
  const obj = { repository, sender, issue, pr: null };
  const issue2: Issue & GetTeamMemberProp = {
    assignees: [user2],
    labels: [label],
    octokit,
  };
  const pr: PullRequest & GetTeamMemberProp = {
    requested_reviewers: [user],
    assignees: [user],
    head: {
      label: "arkedge:renovate/regex-1.x",
      ref: "renovate/regex-1.x",
    },
    octokit,
  };
  const obj2 = { repository, sender, issue: issue2, pr: null };
  const obj3 = { repository, sender, issue: null, pr };
  const obj4 = {
    repository: { ...repository, name: "autoproject" },
    sender,
    issue: null,
    pr,
  };
  const rules = processYamlRules(yaml).content!;
  await expect(rules[0].test(obj)).resolves.toBeTruthy();
  await expect(rules[1].test(obj)).resolves.toBeFalsy();
  expect(mock).toHaveBeenCalledTimes(0);
  await expect(rules[2].test(obj)).resolves.toBeTruthy();
  expect(
    mock,
    "acquire team member the first time we need",
  ).toHaveBeenCalledTimes(1);

  await expect(
    getMatchedProj(
      rules,
      { kind: WebhookEventKind.Issue, action: "assigned" },
      obj,
    ),
  ).resolves.toEqual([1, 4]);

  await expect(rules[2].test(obj2)).resolves.toBeFalsy();
  expect(
    mock,
    "once called, it will not be called again",
  ).toHaveBeenCalledTimes(1);
  await expect(
    getMatchedProj(
      rules,
      { kind: WebhookEventKind.Issue, action: "assigned" },
      obj2,
    ),
  ).resolves.toEqual([]);

  await expect(rules[3].test(obj3)).resolves.toBeFalsy();

  await expect(rules[3].test(obj4)).resolves.toBeTruthy();
  await expect(rules[4].test(obj4)).resolves.toBeTruthy();
  await expect(rules[5].test(obj4)).resolves.toBeTruthy();
  await expect(
    getMatchedProj(
      rules,
      { kind: WebhookEventKind.PullRequest, action: "assigned" },
      obj4,
    ),
  ).resolves.toEqual([9]);
});

it("can treat multiple rules", async () => {
  const yaml = fs.readFileSync("./test/test_multiple_rules.yaml", "utf-8");
  const repository = {} as unknown as Repo;
  const mock = vi.fn().mockImplementation(async () => {
    const resp = { data: [] } as unknown as OctokitResponse<[]>;
    return resp;
  });
  const obj = (login: string) => {
    const user: User = {
      login,
    };
    const sender: User = {
      login,
    };
    const octokit = OctokitRestMock(mock);
    const issue: Issue & GetTeamMemberProp = {
      assignees: [user],
      octokit,
    };
    const obj = { repository, sender, issue, pr: null };
    return obj;
  };
  const rules = processYamlRules(yaml).content!;
  await expect(rules[0].test(obj("z"))).resolves.toBeFalsy();
  await expect(rules[0].test(obj("a"))).resolves.toBeTruthy();
  await expect(rules[1].test(obj("a"))).resolves.toBeFalsy();
  await expect(rules[2].test(obj("a"))).resolves.toBeFalsy();
  await expect(rules[0].test(obj("b"))).resolves.toBeFalsy();
  await expect(rules[1].test(obj("b"))).resolves.toBeTruthy();
  await expect(rules[2].test(obj("b"))).resolves.toBeFalsy();
  expect(mock).toHaveBeenCalledTimes(0);
});

it("treat rules about issue and pr exclusively", () => {
  const ok = (yml: string, msg?: string) => {
    expect(processYamlRules(yml).content, msg).not.toEqual(null);
  };
  const ng = (yml: string, msg?: string) => {
    expect(processYamlRules(yml).content, msg).toEqual(null);
  };
  ok(`
  version: "0"
  rules:
    - issue:
        assignees:
          - name
      project: 1`);
  ok(`
  version: "0"
  rules:
    - pr:
        assignees:
          - name
      project: 1`);
  ng(`
  version: "0"
  rules:
    - issue:
        assignees:
          - name
      pr:
        assignees:
          - name
      project: 1`);
  ng(
    `
  version: "0"
  rules:
    - issue:
        assignees:
          - name
      on:
        pr:
          - assigned
      project: 1`,
    "issue rule on pr event",
  );
});

it("can limit firing event", async () => {
  const yaml = fs.readFileSync("./test/test_event_on.yaml", "utf-8");
  const repository = {
    name: "autopj",
  } as unknown as Repo;
  const mock = vi.fn().mockImplementation(async () => {
    const resp = { data: [] };
    return resp;
  });
  const arg = (login: string) => {
    const user: User = {
      login,
    };
    const sender: User = {
      login,
    };
    const octokit = OctokitRestMock(mock);
    const issue: Issue & GetTeamMemberProp = {
      assignees: [user],
      octokit,
    };
    const obj = { repository, sender, issue, pr: null };
    return obj;
  };
  const rules = processYamlRules(yaml).content!;
  await expect(
    getMatchedProj(
      rules,
      {
        kind: WebhookEventKind.Issue,
        action: "assigned",
      },
      arg("assignee"),
    ),
  ).resolves.toEqual([1]);
  await expect(
    getMatchedProj(
      rules,
      {
        kind: WebhookEventKind.Issue,
        action: "opened",
      },
      arg("assignee"),
    ),
  ).resolves.toEqual([1, 2]);
  await expect(
    getMatchedProj(
      rules,
      {
        kind: WebhookEventKind.PullRequest,
        action: "opened",
      },
      arg("assignee"),
    ),
  ).resolves.toEqual([2]);
  await expect(
    getMatchedProj(
      rules,
      {
        kind: WebhookEventKind.PullRequest,
        action: "assigned",
      },
      arg("assignee"),
    ),
  ).resolves.toEqual([]);
});
