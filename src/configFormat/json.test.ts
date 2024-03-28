import { expect, it } from "vitest";
import { JsonFormat } from "./jsonFormat";

it("can parse empty json", () => {
  const parsed = new JsonFormat().parse("{}");
  expect(parsed.is_ok).toBeTruthy();
});

it("can parse a json with trailing comma", () => {
  const parsed = new JsonFormat().parse('{"a": 1,}');
  expect(parsed.is_ok).toBeTruthy();
});
