import * as Sentry from "@sentry/node";
import { z } from "zod";
import log4js from "log4js";

const logger = log4js.getLogger("general");
const envSchema = z.object({
  SENTRY_DSN: z.string({ required_error: "SENTRY_DSN is required" }),
});
const envParseResult = envSchema.safeParse(process.env);
if (envParseResult.success) {
  const envInput = {
    SENTRY_DSN: envParseResult.data.SENTRY_DSN,
  };
  Sentry.init({
    dsn: envInput.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}
