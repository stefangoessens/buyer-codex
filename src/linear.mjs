const LINEAR_ENDPOINT = "https://api.linear.app/graphql";

export class LinearClient {
  constructor(config) {
    this.config = config;
  }

  async request(query, variables = {}) {
    const response = await fetch(LINEAR_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.config.apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });

    const payload = await response.json();
    if (!response.ok || payload.errors?.length) {
      const message = payload.errors?.map((error) => error.message).join("; ") || response.statusText;
      throw new Error(`Linear API error: ${message}`);
    }

    return payload.data;
  }

  async listWorkflowStates() {
    const query = `
      query($teamKey: String!) {
        workflowStates(filter: { team: { key: { eq: $teamKey } } }, first: 50) {
          nodes {
            id
            name
            type
          }
        }
      }
    `;

    const data = await this.request(query, { teamKey: this.config.teamKey });
    return data.workflowStates.nodes;
  }

  async listCandidateIssues() {
    const query = `
      query($projectName: String!, $stateNames: [String!]) {
        issues(
          filter: {
            project: { name: { eq: $projectName } }
            state: { name: { in: $stateNames } }
          }
          first: 250
        ) {
          nodes {
            id
            identifier
            title
            description
            priority
            updatedAt
            url
            state {
              id
              name
              type
            }
            projectMilestone {
              id
              name
            }
            parent {
              id
              identifier
            }
            labels {
              nodes {
                name
              }
            }
          }
        }
      }
    `;

    const data = await this.request(query, {
      projectName: this.config.projectName,
      stateNames: this.config.activeStates,
    });

    return data.issues.nodes;
  }

  async getIssue(id) {
    const query = `
      query($id: String!) {
        issue(id: $id) {
          id
          identifier
          title
          description
          priority
          url
          updatedAt
          state {
            id
            name
            type
          }
          project {
            id
            name
          }
          projectMilestone {
            id
            name
          }
          parent {
            id
            identifier
            title
          }
          labels {
            nodes {
              name
            }
          }
          attachments {
            nodes {
              id
              title
              url
            }
          }
          documents {
            nodes {
              id
              title
              url
            }
          }
          comments(first: 50) {
            nodes {
              id
              body
              updatedAt
            }
          }
          relations {
            nodes {
              type
              relatedIssue {
                id
                identifier
                title
                state {
                  name
                  type
                }
              }
            }
          }
          inverseRelations {
            nodes {
              type
              issue {
                id
                identifier
                title
                state {
                  name
                  type
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.request(query, { id });
    return data.issue;
  }

  async updateIssueState(issueId, stateId) {
    const mutation = `
      mutation($issueId: String!, $stateId: String!) {
        issueUpdate(id: $issueId, input: { stateId: $stateId }) {
          success
          issue {
            id
            identifier
            state {
              id
              name
              type
            }
          }
        }
      }
    `;

    const data = await this.request(mutation, { issueId, stateId });
    return data.issueUpdate.issue;
  }

  async createComment(issueId, body) {
    const mutation = `
      mutation($issueId: String!, $body: String!) {
        commentCreate(input: { issueId: $issueId, body: $body }) {
          success
          comment {
            id
            body
          }
        }
      }
    `;

    const data = await this.request(mutation, { issueId, body });
    return data.commentCreate.comment;
  }

  async updateComment(commentId, body) {
    const mutation = `
      mutation($commentId: String!, $body: String!) {
        commentUpdate(id: $commentId, input: { body: $body }) {
          success
          comment {
            id
            body
          }
        }
      }
    `;

    const data = await this.request(mutation, { commentId, body });
    return data.commentUpdate.comment;
  }

  async upsertBotComment(issue, marker, body) {
    const existing = issue.comments.nodes.find((comment) =>
      comment.body.includes(`<!-- ${marker} -->`),
    );

    if (existing) {
      return this.updateComment(existing.id, body);
    }

    return this.createComment(issue.id, body);
  }
}
