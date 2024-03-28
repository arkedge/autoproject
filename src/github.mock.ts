import { type Octokit } from "@octokit/core";
import { type OctokitResponse } from "@octokit/types";

export const OctokitRestMock = <T>(f: () => Promise<OctokitResponse<T>>) => {
  const octokit = {
    request: async (_route: string, _options?: any) => await f(),
  } as unknown as Octokit;
  return octokit;
};
