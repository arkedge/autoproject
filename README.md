# autoproject

自動で Issue を Project に登録する

config ファイルに基づき，Issue と PR を Project に自動登録します．適切な環境変数のもとで，起動すると Webhooks を受け付け，Project 追加は graphql でリクエストを飛ばすという実装につき，動作には GitHub app 側で相応の設定が必要です．

## config

サンプル：[test/readme_rule.yaml](/test/readme_rule.yaml)

ルール毎に OR，プロパティ毎に AND，プロパティの値のリストは OR を取ったものとして扱います．各ルールを独立に追加し，ルールにおける絞り込みはプロパティの追加や正規表現で行うことを想定しています．

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

## Docker を使った実行方法

簡単に Docker を使って検証する方法を説明します．
他のオプションを指定する場合はコードを確認してください．

### 必要なリソースの用意

いくつか環境変数の指定が必要なため，.env ファイルを作成します．

```bash
RULES_FILE=/app/rules.yaml
GITHUB_APP_ID=[github_app_id]
PORT=8080
WEBHOOK_SECRET=[github_webhook_secret]
GITHUB_APP_PRIVATE_KEY_FILE=/app/github.key
```

ほか，root ディレクトリに以下のファイルを用意します．

- rules.yaml
  - 上の記法を参考に用意する
- github.key
  - Github App を登録してダウンロードする

### 実行コマンド

例として実行コマンドを示します．

```bash
cd ./autoproject
docker build . -t autoproject
docker run --env-file .env -p 8080:8080 autoproject
```

### 留意すべきポイント

- 実行する際は Github から Webhook でアクセスできる必要があります
- Github App に登録する際 Webhook 先のパスは `https://[your-host]/api/github/webhooks` としてください
