# autoproject

自動で Issue を Project に登録する

## config

サンプル：[test/readme_rule.yaml](/test/readme_rule.yaml)

スキーマは，typescript 的に次と同じ（型名は実際のものと異なる）

```ts
type RulesYaml = (Partial<Payload> & { project: Project })[];

type Project =
  | number
  | {
      not: number | number[];
    }
  | Array<
      | number
      | {
          not: number | number[];
        }
    >
  | {
      only: number | number[];
    }
  | {
      reject: {};
    };

type Payload = {
  repo: Partial<Repo>;
  issue: Partial<Issue>;
  pr: Partial<PullRequest>;
  on: Partial<EventTarget>;
};

type Repo = {
  name: string | string[];
  full_name: string | string[];
  description: string | string[];
  fork: boolean;
  private: boolean;
  topics: string | string[];
};

type Issue = {
  assignees: string | string[];
  labels: string | string[];
};

type PullRequest = {
  reviewers: string | string[];
  assignees: string | string[];
  labels: string | string[];
  head: {
    label: string | string[];
    ref: string | string[];
  };
};

type EventTarget = {
  issue:
    | "any"
    | "opened"
    | "assigned"
    | "labeled"
    | ("opened" | "assigned" | "labeled")[];
  pr:
    | "any"
    | "opened"
    | "assigned"
    | "labeled"
    | ("opened" | "assigned" | "labeled")[];
};
```
