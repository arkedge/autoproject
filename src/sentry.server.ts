import * as Sentry from "@sentry/node";
import { z } from "zod";

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
