import * as fs from "fs";
import * as http from "http";
import { App, createNodeMiddleware } from "@octokit/app";
import { type Octokit } from "@octokit/core";
import {
  type IssuesEvent,
  type PullRequestEvent,
} from "@octokit/webhooks-types";
import { z } from "zod";
import log4js from "log4js";
import { processRulesV0, processRules, getMatchedProj } from "./config";
import { configLogger, doLogError, readAndParse } from "./util";
import { addIssueToProject } from "./github";
import {
  type MatchArg,
  type WebhookEventAction,
  WebhookEventKind,
} from "./types";

configLogger();
doLogError();

const defaultPort = 8124;

const logger = log4js.getLogger("general");
logger.info("process started.");

const envSchema = z.object({
  GITHUB_APP_ID: z.string({ required_error: "GITHUB_APP_ID is required" }),
  GITHUB_APP_PRIVATE_KEY_FILE: z.string({
    required_error: "GITHUB_APP_PRIVATE_KEY_FILE is required",
  }),
  WEBHOOK_SECRET: z.string({ required_error: "WEBHOOK_SECRET is required" }),
  RULES_FILE: z.string({ required_error: "RULES_FILE is required" }).optional(),
  // legacy, for compatibility
  CONFIG_FILE: z.string().optional(),
  // legacy
  RULES_FILE_V0: z.string().optional(),
  // compatibility with old config format
  LABEL_CLASSIFICATION_FILE: z.string().optional(),
  // the port that http server listen on
  PORT: z.string().optional(),
});

const envParseResult = envSchema.safeParse(process.env);
if (!envParseResult.success) {
  logger.error("environment variable validation failed.");
  for (const issue of envParseResult.error.issues) {
    logger.error(issue.message);
  }
  process.exit(1);
}
const envInput = {
  GITHUB_APP_ID: envParseResult.data.GITHUB_APP_ID,
  GITHUB_APP_PRIVATE_KEY_FILE: envParseResult.data.GITHUB_APP_PRIVATE_KEY_FILE,
  WEBHOOK_SECRET: envParseResult.data.WEBHOOK_SECRET,
  RULES_FILE: envParseResult.data.RULES_FILE,
  RULES_FILE_V0:
    envParseResult.data.CONFIG_FILE ?? envParseResult.data.RULES_FILE_V0,
  LABEL_CLASSIFICATION_FILE: envParseResult.data.LABEL_CLASSIFICATION_FILE,
  PORT: envParseResult.data.PORT ?? defaultPort,
};
if (
  typeof envInput.RULES_FILE === "undefined" &&
  typeof envInput.RULES_FILE_V0 === "undefined"
) {
  logger.error("environment variable validation failed.");
  logger.error("either RULES_FILE or CONFIG_FILE must be specified.");
  process.exit(1);
}

const privateKey = fs.readFileSync(
  envInput.GITHUB_APP_PRIVATE_KEY_FILE,
  "utf-8",
);

const rules = readAndParse(envInput.RULES_FILE, processRules)?.content ?? [];
const config = readAndParse(envInput.RULES_FILE_V0, processRulesV0);
const labelClass =
  typeof envInput.LABEL_CLASSIFICATION_FILE !== "undefined"
    ? readAndParse(envInput.LABEL_CLASSIFICATION_FILE, processRulesV0)
    : null;

logger.info("finish parsing and validating files.");

const app = new App({
  appId: envInput.GITHUB_APP_ID,
  privateKey,
  oauth: {
    clientId: "PLACEHOLDER",
    clientSecret: "PLACEHOLDER",
  },
  webhooks: {
    secret: envInput.WEBHOOK_SECRET,
  },
});

async function determineDestination(
  webhookEvent: WebhookEventAction,
  arg: MatchArg,
): Promise<Set<number>> {
  const projectNumberSet = new Set<number>();

  const projectNumbers = config?.content?.get(arg.repository.full_name);
  if (typeof projectNumbers !== "undefined") {
    for (const projectNumber of projectNumbers) {
      projectNumberSet.add(projectNumber);
    }
  }

  const projectNumbers2 = await getMatchedProj(rules, webhookEvent, arg);
  for (const projectNumber of projectNumbers2) {
    projectNumberSet.add(projectNumber);
  }

  // compatibility with old config format
  if (labelClass !== null) {
    const labels = arg.issue?.labels ?? [];
    for (const label of labels) {
      const projectNumbers3 = labelClass.content?.get(label.name);
      if (typeof projectNumbers3 !== "undefined") {
        for (const projectNumber of projectNumbers3) {
          projectNumberSet.add(projectNumber);
        }
      }
    }
  }
  // end of compatibility

  return projectNumberSet;
}

type IssuesEventPayload = WithOctokit<IssuesEvent>;

const issuesEventPayloadToArg = ({ octokit, payload }: IssuesEventPayload) => {
  const arg: MatchArg = {
    repository: payload.repository,
    sender: payload.sender,
    issue: { ...payload.issue, octokit },
    pr: null,
  };
  const r: Extracted = {
    arg,
    webhookEvent: {
      kind: WebhookEventKind.Issue,
      action: payload.action,
    },
    nodeId: payload.issue.node_id,
    login: payload.repository.owner.login,
  };
  return r;
};

type PullRequestEventPayload = WithOctokit<PullRequestEvent>;

const pullRequestEventPayloadToArg = ({
  octokit,
  payload,
}: PullRequestEventPayload) => {
  const arg: MatchArg = {
    repository: payload.repository,
    sender: payload.sender,
    issue: null,
    pr: { ...payload.pull_request, octokit },
  };
  const r: Extracted = {
    arg,
    webhookEvent: {
      kind: WebhookEventKind.PullRequest,
      action: payload.action,
    },
    nodeId: payload.pull_request.node_id,
    login: payload.repository.owner.login,
  };
  return r;
};

type WithOctokit<X> = {
  octokit: Octokit;
  payload: X;
};

type Extracted = {
  arg: MatchArg;
  webhookEvent: WebhookEventAction;
  nodeId: string;
  login: string;
};

const handleEvent =
  <X>(transformer: (_: WithOctokit<X>) => Extracted) =>
  async (w: WithOctokit<X>) => {
    const { arg, nodeId, login, webhookEvent } = transformer(w);
    const destinations = await determineDestination(webhookEvent, arg);
    return await Promise.all(
      [...destinations].map(async (projectNumber) => {
        await addIssueToProject(w.octokit, nodeId, login, projectNumber);
      }),
    );
  };

app.webhooks.on("issues.opened", handleEvent(issuesEventPayloadToArg));
app.webhooks.on("issues.assigned", handleEvent(issuesEventPayloadToArg));
app.webhooks.on("issues.labeled", handleEvent(issuesEventPayloadToArg));

app.webhooks.on(
  "pull_request.opened",
  handleEvent(pullRequestEventPayloadToArg),
);
app.webhooks.on(
  "pull_request.assigned",
  handleEvent(pullRequestEventPayloadToArg),
);
app.webhooks.on(
  "pull_request.labeled",
  handleEvent(pullRequestEventPayloadToArg),
);

logger.info(`listening on port ${envInput.PORT}`);

const middleware = createNodeMiddleware(app);
http
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  .createServer(async (req, res) => {
    // `middleware` returns `false` when `req` is unhandled
    if (await middleware(req, res)) return;
    if (req.url === "/healthcheck") {
      res.writeHead(200);
    } else {
      res.writeHead(404);
    }
    res.end();
  })
  .listen(envInput.PORT);
