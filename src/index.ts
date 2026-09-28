import * as core from "@actions/core";
import * as github from "@actions/github";

async function run(): Promise<void> {
  try {
    const octokit = github.getOctokit(core.getInput("github-token"));
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
    const workflowListInputs = {
      owner,
      repo,
      workflow_id: core.getInput("workflow-id"),
      branch: core.getInput("branch") || undefined,
      event: core.getInput("event") || undefined,
      per_page: 100,
    } as const;
    core.debug(`Workflow list inputs: ${JSON.stringify(workflowListInputs)}`);
    // The status=success filter sometimes serves a stale snapshot that lists a run weeks old
    // first. Filter the latest runs here instead, and use the status filter only when none of
    // them succeeded. Neither listing's order is documented, so take the latest completion.
    const latestRuns = await octokit.rest.actions.listWorkflowRuns(
      workflowListInputs
    );
    let successfulRuns = latestRuns.data.workflow_runs.filter(
      (run) => run.conclusion === "success"
    );
    if (successfulRuns.length === 0) {
      const filteredRuns = await octokit.rest.actions.listWorkflowRuns({
        ...workflowListInputs,
        status: "success",
      });
      successfulRuns = filteredRuns.data.workflow_runs;
    }
    core.debug(`Successful runs: ${JSON.stringify(successfulRuns)}`);

    if (successfulRuns.length === 0) {
      core.warning(
        "No successful workflow runs found. Defaulting to an early commit."
      );
      // Get the earliest commit in the repo
      // TODO: This will only work for fairly new repos
      const commits = await octokit.rest.repos.listCommits({
        owner,
        repo,
      });
      core.debug(`Commits: ${JSON.stringify(commits.data)}`);
      const lastCommit = commits.data[commits.data.length - 1];
      return exit(lastCommit.sha);
    }

    const lastSuccessfulRun = successfulRuns.reduce((latest, run) =>
      run.updated_at > latest.updated_at ? run : latest
    );
    return exit(lastSuccessfulRun.head_sha);
  } catch (e) {
    if (e instanceof Error) {
      core.setFailed(e.message);
    } else {
      core.setFailed(`Unknown error occurred: ${e}`);
    }
  }
}

function exit(commitSha: string): void {
  core.setOutput("commit-sha", commitSha);
  core.info(`Commit SHA: ${commitSha}`);
  process.exit(0);
}

run();
