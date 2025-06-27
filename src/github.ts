import { type Octokit } from "@octokit/core";
import assert from "node:assert";
import { type User as Login } from "./types.js";
import { type GraphqlResponseError } from "@octokit/graphql";

enum ProjectV2OwnerType {
  Organization = "org",
  User = "user",
}

const projectV2OwnerMap = new Map<string, ProjectV2OwnerType>();
const orgMap = new Map<number, string>();
const userMap = new Map<number, string>();

// ad-hoc
type Organization = {
  projectV2: {
    id: string;
  };
};
type User = Organization;

async function fetchProjectIdCached(
  octokit: Octokit,
  login: string,
  projectNumber: number,
): Promise<{
  projectId: string;
}> {
  type OrgResponse = { organization: Organization };
  type UserResponse = { user: User };
  switch (projectV2OwnerMap.get(login)) {
    case ProjectV2OwnerType.Organization: {
      const id = orgMap.get(projectNumber);
      if (typeof id !== "undefined") {
        return {
          projectId: id,
        };
      }
      const {
        organization: { projectV2 },
      } = await octokit.graphql<OrgResponse>(
        `query($login: String!, $projectNumber: Int!) {
          organization(login: $login) {
            projectV2(number: $projectNumber) {
              id
            }
          }
        }`,
        {
          login,
          projectNumber,
        },
      );
      const projectId = projectV2.id;
      orgMap.set(projectNumber, projectId);
      return {
        projectId,
      };
    }
    case ProjectV2OwnerType.User: {
      const id = userMap.get(projectNumber);
      if (typeof id !== "undefined") {
        return {
          projectId: id,
        };
      }
      const {
        user: { projectV2 },
      } = await octokit.graphql<UserResponse>(
        `query($login: String!, $projectNumber: Int!) {
          user(login: $login) {
            projectV2(number: $projectNumber) {
              id
            }
          }
        }`,
        {
          login,
          projectNumber,
        },
      );
      const projectId = projectV2.id;
      userMap.set(projectNumber, projectId);
      return {
        projectId,
      };
    }
    default: {
      let r;
      let err = null;
      try {
        r = await octokit.graphql<Partial<OrgResponse & UserResponse>>(
          `query($login: String!, $projectNumber: Int!) {
            organization(login: $login) {
              projectV2(number: $projectNumber) {
                id
              }
            }
            user(login: $login) {
              projectV2(number: $projectNumber) {
                id
              }
            }
          }`,
          {
            login,
            projectNumber,
          },
        );
      } catch (error) {
        err = error;
        r = (error as GraphqlResponseError<Partial<OrgResponse & UserResponse>>)
          .data;
      }
      if (typeof r.organization?.projectV2?.id !== "undefined") {
        const projectId = r.organization.projectV2.id;
        projectV2OwnerMap.set(login, ProjectV2OwnerType.Organization);
        orgMap.set(projectNumber, projectId);
        return {
          projectId,
        };
      }
      if (typeof r.user?.projectV2?.id !== "undefined") {
        const projectId = r.user.projectV2.id;
        projectV2OwnerMap.set(login, ProjectV2OwnerType.User);
        userMap.set(projectNumber, projectId);
        return {
          projectId,
        };
      }
      console.error(err);
      assert(false, `${login}/${projectNumber} doesn't exist`);
    }
  }
}

export async function addIssueToProject(
  octokit: Octokit,
  issueId: string,
  login: string,
  projectNumber: number,
) {
  const { projectId } = await fetchProjectIdCached(
    octokit,
    login,
    projectNumber,
  );
  await octokit.graphql(
    `mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item {
          id
        }
      }
    }`,
    {
      projectId,
      contentId: issueId,
    },
  );
}

export interface GetTeamMemberProp {
  octokit: Octokit;
}

export async function getAllTeamMember(
  { octokit }: GetTeamMemberProp,
  organization: string,
  teamSlug: string,
): Promise<Login[]> {
  const resp = await octokit.request(
    "GET /orgs/{org}/teams/{team_slug}/members",
    {
      org: organization,
      team_slug: teamSlug,
    },
  );
  return resp.data ?? [];
}
