"use strict";

module.exports = async function syncRelease({ github, context, core, inputs }) {
  const { releaseTag, targetCommitish, dryRun } = inputs;

  if (targetCommitish !== "develop") {
    core.setFailed(
      `Release ${releaseTag} targets '${targetCommitish || "(empty)"}', but this workflow only syncs releases created from develop.`,
    );
    return { skipped: false };
  }

  let developRef;
  try {
    ({ data: developRef } = await github.rest.git.getRef({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: "heads/develop",
    }));
  } catch (error) {
    core.setFailed(
      `Could not resolve branch 'develop' for release ${releaseTag}: ${formatError(error)}.`,
    );
    return { skipped: false };
  }

  let mainRef;
  try {
    ({ data: mainRef } = await github.rest.git.getRef({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: "heads/main",
    }));
  } catch (error) {
    core.setFailed(
      `Could not resolve branch 'main' for release ${releaseTag}: ${formatError(error)}.`,
    );
    return { skipped: false };
  }

  let releaseTagSha;
  try {
    const { data: releaseTagRef } = await github.rest.git.getRef({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: `tags/${releaseTag}`,
    });
    releaseTagSha = releaseTagRef.object.sha;

    if (releaseTagRef.object.type === "tag") {
      const { data: tagObject } = await github.rest.git.getTag({
        owner: context.repo.owner,
        repo: context.repo.repo,
        tag_sha: releaseTagSha,
      });
      releaseTagSha = tagObject.object.sha;
    }
  } catch (error) {
    core.setFailed(`Failed to resolve tag '${releaseTag}' to a commit SHA: ${formatError(error)}.`);
    return { skipped: false };
  }

  // Prefer the CI run that built the release tag SHA. Fall back to the latest
  // completed run on develop only if no run is found for the tag SHA. Genuine
  // API errors (auth, rate limit, 5xx) must abort — silently degrading would
  // mask a degraded GitHub API and let an unverified release through.
  let latestRun;
  let lookupSource;
  try {
    const { data: tagRuns } = await github.rest.actions.listWorkflowRuns({
      owner: context.repo.owner,
      repo: context.repo.repo,
      workflow_id: "ci.yml",
      head_sha: releaseTagSha,
      status: "completed",
      per_page: 1,
    });
    latestRun = tagRuns.workflow_runs[0];
    if (latestRun) {
      lookupSource = "tag-sha";
    }
  } catch (error) {
    const status = error.status ?? 0;
    if (status === 404) {
      core.info(
        `No CI run found by head_sha=${releaseTagSha} (tag=${releaseTag}); falling back to develop branch lookup.`,
      );
    } else {
      core.setFailed(
        `Failed to query CI runs by head_sha=${releaseTagSha} (tag=${releaseTag}): ${formatError(error)}. Aborting before fallback to avoid masking the underlying API failure.`,
      );
      return { skipped: false };
    }
  }

  if (!latestRun) {
    try {
      const { data: branchRuns } = await github.rest.actions.listWorkflowRuns({
        owner: context.repo.owner,
        repo: context.repo.repo,
        workflow_id: "ci.yml",
        branch: "develop",
        status: "completed",
        per_page: 1,
      });
      latestRun = branchRuns.workflow_runs[0];
      if (latestRun) {
        lookupSource = "develop-branch";
      }
    } catch (error) {
      core.setFailed(
        `Failed to list CI runs for workflow 'ci.yml' on branch 'develop' (release ${releaseTag}, commit ${releaseTagSha}): ${formatError(error)}.`,
      );
      return { skipped: false };
    }
  }

  if (!latestRun) {
    core.setFailed(
      `No completed CI run was found for release ${releaseTag} (tag commit ${releaseTagSha}, develop tip ${developRef.object.sha}).`,
    );
    return { skipped: false };
  }

  const sourceLabel =
    lookupSource === "tag-sha"
      ? `release tag commit ${releaseTagSha}`
      : `develop tip ${developRef.object.sha}`;

  if (latestRun.conclusion !== "success") {
    core.setFailed(
      `CI is not green for ${sourceLabel} (run #${latestRun.run_number}, conclusion: ${latestRun.conclusion}, url: ${latestRun.html_url}).`,
    );
    return { skipped: false };
  }

  if (latestRun.head_sha !== releaseTagSha && latestRun.head_sha !== developRef.object.sha) {
    core.setFailed(
      `CI passed for ${latestRun.head_sha} (run #${latestRun.run_number}, url: ${latestRun.html_url}), which matches neither the release tag commit ${releaseTagSha} nor the develop tip ${developRef.object.sha}.`,
    );
    return { skipped: false };
  }

  if (releaseTagSha !== developRef.object.sha) {
    core.setFailed(
      `Release tag ${releaseTag} points to ${releaseTagSha}, but the healthy develop tip is ${developRef.object.sha}.`,
    );
    return { skipped: false };
  }

  if (mainRef.object.sha === developRef.object.sha) {
    core.info(`main already matches develop (${developRef.object.sha}) — no sync required.`);
    core.setOutput("skipped", "true");
    return { skipped: true };
  }

  if (dryRun) {
    core.info(
      `[dry-run] Would merge ${releaseTagSha} into main (${mainRef.object.sha}) for release ${releaseTag}. Skipping actual merge.`,
    );
    core.setOutput("skipped", "true");
    return { skipped: true };
  }

  try {
    // Pin the merge to the verified commit SHA, not the branch ref, so a feature
    // PR that lands on develop between the SHA-equality check above and this
    // call cannot be silently promoted into main.
    await github.rest.repos.merge({
      owner: context.repo.owner,
      repo: context.repo.repo,
      base: "main",
      head: releaseTagSha,
      commit_message: `Sync develop into main for release ${releaseTag}`,
    });

    core.info(`Synced develop (${releaseTagSha}) into main for release ${releaseTag}.`);
    core.setOutput("skipped", "false");
    return { skipped: false };
  } catch (error) {
    const status = error.status ?? "unknown";
    const body = error.response?.data?.message ?? error.message;
    if (error.status === 409) {
      core.setFailed(
        `Merge conflict syncing develop (${releaseTagSha}) into main (${mainRef.object.sha}) for release ${releaseTag}: ${body}. Resolve conflicts manually before retrying.`,
      );
    } else {
      core.setFailed(
        `Failed to sync develop into main for release ${releaseTag} (commit ${releaseTagSha}): ${body} (HTTP ${status}).`,
      );
    }
    return { skipped: false };
  }
};

function formatError(error) {
  const status = error.status ?? "unknown";
  const body = error.response?.data?.message ?? error.message;
  return `${body} (HTTP ${status})`;
}
