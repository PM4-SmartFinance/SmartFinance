import { beforeEach, describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const syncRelease = require("./sync-release.js") as (args: {
  github: GithubMock;
  context: ContextMock;
  core: CoreMock;
  inputs: Inputs;
}) => Promise<{ skipped: boolean }>;

type Inputs = { releaseTag: string; targetCommitish: string; dryRun: boolean };

type ContextMock = { repo: { owner: string; repo: string } };

type CoreMock = {
  setFailed: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  setOutput: ReturnType<typeof vi.fn>;
};

type GithubMock = {
  rest: {
    git: {
      getRef: ReturnType<typeof vi.fn>;
      getTag: ReturnType<typeof vi.fn>;
    };
    actions: {
      listWorkflowRuns: ReturnType<typeof vi.fn>;
    };
    pulls: {
      list: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
  };
};

const DEVELOP_SHA = "develop-sha-1234567890";
const MAIN_SHA = "main-sha-1234567890";
const TAG_COMMIT_SHA = "tag-commit-sha-1234567890";
const ANNOTATED_TAG_SHA = "annotated-tag-object-sha";

const context: ContextMock = { repo: { owner: "PM4-SmartFinance", repo: "SmartFinance" } };

function makeCore(): CoreMock {
  return { setFailed: vi.fn(), info: vi.fn(), setOutput: vi.fn() };
}

type RefMap = Record<string, { object: { sha: string; type: string } }>;

function makeGithub(opts: {
  refs?: RefMap;
  refErrors?: Record<string, Error>;
  tagObject?: { object: { sha: string } };
  tagRuns?: unknown[] | Error;
  branchRuns?: unknown[] | Error;
  existingPrs?: unknown[];
  createPrError?: Error;
}): GithubMock {
  const refs: RefMap = opts.refs ?? {
    "heads/develop": { object: { sha: DEVELOP_SHA, type: "commit" } },
    "heads/main": { object: { sha: MAIN_SHA, type: "commit" } },
    [`tags/v1.0.0`]: { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
  };
  const refErrors = opts.refErrors ?? {};

  return {
    rest: {
      git: {
        getRef: vi.fn(async ({ ref }: { ref: string }) => {
          if (refErrors[ref]) throw refErrors[ref];
          if (!refs[ref]) {
            const err = new Error("Not Found") as Error & { status: number };
            err.status = 404;
            throw err;
          }
          return { data: refs[ref] };
        }),
        getTag: vi.fn(async () => ({
          data: opts.tagObject ?? { object: { sha: TAG_COMMIT_SHA } },
        })),
      },
      actions: {
        listWorkflowRuns: vi.fn(
          async ({
            workflow_id,
            head_sha,
          }: {
            workflow_id?: string;
            head_sha?: string;
            branch?: string;
          }) => {
            if (workflow_id !== "ci.yml") {
              throw new Error(
                `mock listWorkflowRuns expected workflow_id="ci.yml", got ${String(workflow_id)}`,
              );
            }
            const result = head_sha !== undefined ? opts.tagRuns : opts.branchRuns;
            if (result instanceof Error) throw result;
            return { data: { workflow_runs: result ?? [] } };
          },
        ),
      },
      pulls: {
        list: vi.fn(async () => ({ data: opts.existingPrs ?? [] })),
        create: vi.fn(async () => {
          if (opts.createPrError) throw opts.createPrError;
          return {
            data: {
              number: 99,
              html_url: "https://github.com/PM4-SmartFinance/SmartFinance/pull/99",
            },
          };
        }),
      },
    },
  };
}

function defaultRefs(
  overrides?: Partial<Record<string, { object: { sha: string; type: string } }>>,
) {
  return Object.assign(
    {
      "heads/develop": { object: { sha: DEVELOP_SHA, type: "commit" } },
      "heads/main": { object: { sha: MAIN_SHA, type: "commit" } },
      [`tags/v1.0.0`]: { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
    },
    overrides ?? {},
  );
}

function successRun(headSha: string) {
  return {
    run_number: 42,
    conclusion: "success",
    head_sha: headSha,
    html_url: "https://github.com/PM4-SmartFinance/SmartFinance/actions/runs/42",
  };
}

function failedRun(headSha: string, conclusion = "failure") {
  return {
    run_number: 43,
    conclusion,
    head_sha: headSha,
    html_url: "https://github.com/PM4-SmartFinance/SmartFinance/actions/runs/43",
  };
}

function octokitError(status: number, message = "API failure"): Error {
  const err = new Error(message) as Error & {
    status: number;
    response: { data: { message: string } };
  };
  err.status = status;
  err.response = { data: { message } };
  return err;
}

const baseInputs: Inputs = { releaseTag: "v1.0.0", targetCommitish: "develop", dryRun: false };

describe("sync-release", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("targetCommitish not 'develop' fails", async () => {
    const core = makeCore();
    const github = makeGithub({});
    await syncRelease({
      github,
      context,
      core,
      inputs: { ...baseInputs, targetCommitish: "main" },
    });

    expect(core.setFailed).toHaveBeenCalledOnce();
    expect(core.setFailed.mock.calls[0][0]).toContain("only syncs releases created from develop");
    expect(github.rest.pulls.create).not.toHaveBeenCalled();
  });

  it("happy path with tag-SHA hit opens a release PR develop → main", async () => {
    const refs: RefMap = {
      "heads/develop": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
      "heads/main": { object: { sha: MAIN_SHA, type: "commit" } },
      "tags/v1.0.0": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
    };
    const core = makeCore();
    const github = makeGithub({ refs, tagRuns: [successRun(TAG_COMMIT_SHA)] });

    const result = await syncRelease({ github, context, core, inputs: baseInputs });

    expect(result).toEqual({ skipped: false });
    expect(core.setFailed).not.toHaveBeenCalled();
    expect(github.rest.actions.listWorkflowRuns).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_id: "ci.yml",
        head_sha: TAG_COMMIT_SHA,
        status: "completed",
        per_page: 1,
      }),
    );
    // We now unconditionally query both the tag-run (by head_sha) and the branch-run.
    expect(github.rest.actions.listWorkflowRuns).toHaveBeenCalledTimes(2);
    expect(github.rest.actions.listWorkflowRuns.mock.calls[1][0]).toEqual(
      expect.objectContaining({ workflow_id: "ci.yml", branch: "develop" }),
    );
    expect(github.rest.pulls.create).toHaveBeenCalledOnce();
    const prArgs = github.rest.pulls.create.mock.calls[0][0];
    expect(prArgs.base).toBe("main");
    expect(prArgs.head).toBe("develop");
    expect(prArgs.title).toContain("v1.0.0");
    // We check for an existing open PR before creating a new one.
    expect(github.rest.pulls.list).toHaveBeenCalledWith(
      expect.objectContaining({ base: "main", head: "PM4-SmartFinance:develop", state: "open" }),
    );
    expect(core.setOutput).toHaveBeenCalledWith("skipped", "false");
  });

  it("tag-SHA hit with failure conclusion uses 'release tag commit' wording", async () => {
    const refs: RefMap = {
      "heads/develop": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
      "heads/main": { object: { sha: MAIN_SHA, type: "commit" } },
      "tags/v1.0.0": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
    };
    const core = makeCore();
    const github = makeGithub({ refs, tagRuns: [failedRun(TAG_COMMIT_SHA)] });

    await syncRelease({ github, context, core, inputs: baseInputs });

    expect(core.setFailed).toHaveBeenCalledOnce();
    const msg = core.setFailed.mock.calls[0][0];
    expect(msg).toContain("release tag commit");
    expect(msg).toContain(TAG_COMMIT_SHA);
    expect(msg).toContain("conclusion: failure");
    expect(msg).toContain("https://github.com");
    expect(github.rest.pulls.create).not.toHaveBeenCalled();
  });

  it("develop success overrides a failing tag run for the same commit", async () => {
    const refs: RefMap = {
      "heads/develop": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
      "heads/main": { object: { sha: MAIN_SHA, type: "commit" } },
      "tags/v1.0.0": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
    };
    const core = makeCore();
    const github = makeGithub({
      refs,
      tagRuns: [failedRun(TAG_COMMIT_SHA)],
      branchRuns: [successRun(TAG_COMMIT_SHA)],
    });

    const result = await syncRelease({ github, context, core, inputs: baseInputs });

    expect(result).toEqual({ skipped: false });
    expect(core.setFailed).not.toHaveBeenCalled();
    expect(github.rest.pulls.create).toHaveBeenCalledOnce();
    expect(github.rest.pulls.create.mock.calls[0][0].head).toBe("develop");
  });

  it("tag-SHA empty triggers branch fallback (uses 'develop tip' wording on failure)", async () => {
    const refs: RefMap = {
      "heads/develop": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
      "heads/main": { object: { sha: MAIN_SHA, type: "commit" } },
      "tags/v1.0.0": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
    };
    const core = makeCore();
    const github = makeGithub({
      refs,
      tagRuns: [],
      branchRuns: [failedRun(TAG_COMMIT_SHA, "cancelled")],
    });

    await syncRelease({ github, context, core, inputs: baseInputs });

    expect(core.setFailed).toHaveBeenCalledOnce();
    expect(core.setFailed.mock.calls[0][0]).toContain("develop tip");
    expect(core.setFailed.mock.calls[0][0]).toContain("conclusion: cancelled");
  });

  it("tag-SHA empty + branch fallback hit opens a release PR", async () => {
    const refs: RefMap = {
      "heads/develop": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
      "heads/main": { object: { sha: MAIN_SHA, type: "commit" } },
      "tags/v1.0.0": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
    };
    const core = makeCore();
    const github = makeGithub({
      refs,
      tagRuns: [],
      branchRuns: [successRun(TAG_COMMIT_SHA)],
    });

    const result = await syncRelease({ github, context, core, inputs: baseInputs });

    expect(result).toEqual({ skipped: false });
    expect(github.rest.actions.listWorkflowRuns).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        workflow_id: "ci.yml",
        branch: "develop",
        status: "completed",
        per_page: 1,
      }),
    );
    expect(github.rest.actions.listWorkflowRuns.mock.calls[1][0]).not.toHaveProperty("head_sha");
    expect(github.rest.pulls.create).toHaveBeenCalledOnce();
    expect(github.rest.pulls.create.mock.calls[0][0].head).toBe("develop");
  });

  it("tag-SHA throws 404 → falls back to branch lookup", async () => {
    const refs: RefMap = {
      "heads/develop": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
      "heads/main": { object: { sha: MAIN_SHA, type: "commit" } },
      "tags/v1.0.0": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
    };
    const core = makeCore();
    const github = makeGithub({
      refs,
      tagRuns: octokitError(404, "Not Found"),
      branchRuns: [successRun(TAG_COMMIT_SHA)],
    });

    const result = await syncRelease({ github, context, core, inputs: baseInputs });

    expect(result).toEqual({ skipped: false });
    expect(core.setFailed).not.toHaveBeenCalled();
    expect(core.info.mock.calls.some((c) => String(c[0]).includes("falling back"))).toBe(true);
    expect(github.rest.pulls.create).toHaveBeenCalledOnce();
  });

  it("branch lookup throws 500 → aborts without promoting", async () => {
    const core = makeCore();
    const github = makeGithub({
      refs: defaultRefs({ "heads/develop": { object: { sha: TAG_COMMIT_SHA, type: "commit" } } }),
      tagRuns: [],
      branchRuns: octokitError(500, "internal server error"),
    });

    await syncRelease({ github, context, core, inputs: baseInputs });

    expect(core.setFailed).toHaveBeenCalledOnce();
    const failure = core.setFailed.mock.calls[0][0];
    expect(failure).toContain("HTTP 500");
    expect(failure).toContain("internal server error");
    // We should have attempted both lookups (tag then branch)
    expect(github.rest.actions.listWorkflowRuns).toHaveBeenCalledTimes(2);
    expect(github.rest.pulls.create).not.toHaveBeenCalled();
  });

  it("per_page semantics: latest tag run-only is authoritative (do not scan history)", async () => {
    // We pin the decision to only consider the latest completed run returned
    // by the API (we request `per_page: 1`). If the latest run is failing
    // and an older one is green, that older run is not considered.
    const core = makeCore();
    // Simulate a latest (most-recent) tag run that failed, followed by an
    // older successful run. Because we request per_page:1, only the failing
    // run should be visible to the script and it must fail.
    const github = makeGithub({
      refs: defaultRefs({ "heads/develop": { object: { sha: TAG_COMMIT_SHA, type: "commit" } } }),
      // Simulate the API honoring `per_page: 1` by returning only the latest run
      tagRuns: [failedRun(TAG_COMMIT_SHA)],
      branchRuns: [],
    });

    await syncRelease({ github, context, core, inputs: baseInputs });

    expect(core.setFailed).toHaveBeenCalledOnce();
    const msg = core.setFailed.mock.calls[0][0];
    expect(msg).toContain("CI is not green");
    // Confirm we only requested the latest run by checking we asked for per_page:1
    const calls = github.rest.actions.listWorkflowRuns.mock.calls;
    expect(calls[0][0]).toHaveProperty("per_page", 1);
    expect(github.rest.pulls.create).not.toHaveBeenCalled();
  });

  it.each([
    [401, "Bad credentials"],
    [403, "rate limit exceeded"],
    [429, "too many requests"],
    [500, "internal server error"],
    [502, "bad gateway"],
  ])("tag-SHA throws %i → aborts without falling back", async (status, msg) => {
    const refs: RefMap = {
      "heads/develop": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
      "heads/main": { object: { sha: MAIN_SHA, type: "commit" } },
      "tags/v1.0.0": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
    };
    const core = makeCore();
    const github = makeGithub({
      refs,
      tagRuns: octokitError(status, msg),
      branchRuns: [successRun(TAG_COMMIT_SHA)],
    });

    await syncRelease({ github, context, core, inputs: baseInputs });

    expect(core.setFailed).toHaveBeenCalledOnce();
    const failure = core.setFailed.mock.calls[0][0];
    expect(failure).toContain(`HTTP ${status}`);
    expect(failure).toContain(msg);
    expect(failure).toContain(TAG_COMMIT_SHA);
    expect(failure).toContain("v1.0.0");
    // Branch fallback must NOT be called.
    const calls = github.rest.actions.listWorkflowRuns.mock.calls;
    expect(calls).toHaveLength(1);
    expect(github.rest.pulls.create).not.toHaveBeenCalled();
  });

  it("both lookups empty → fails with all 3 SHAs", async () => {
    const refs: RefMap = {
      "heads/develop": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
      "heads/main": { object: { sha: MAIN_SHA, type: "commit" } },
      "tags/v1.0.0": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
    };
    const core = makeCore();
    const github = makeGithub({ refs, tagRuns: [], branchRuns: [] });

    await syncRelease({ github, context, core, inputs: baseInputs });

    expect(core.setFailed).toHaveBeenCalledOnce();
    const msg = core.setFailed.mock.calls[0][0];
    expect(msg).toContain("v1.0.0");
    expect(msg).toContain(TAG_COMMIT_SHA);
  });

  it("SHA mismatch → fails with both SHAs", async () => {
    const refs: RefMap = {
      "heads/develop": { object: { sha: DEVELOP_SHA, type: "commit" } },
      "heads/main": { object: { sha: MAIN_SHA, type: "commit" } },
      "tags/v1.0.0": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
    };
    const core = makeCore();
    const github = makeGithub({
      refs,
      tagRuns: [],
      branchRuns: [successRun("some-other-sha")],
    });

    await syncRelease({ github, context, core, inputs: baseInputs });

    expect(core.setFailed).toHaveBeenCalledOnce();
    const msg = core.setFailed.mock.calls[0][0];
    expect(msg).toContain("some-other-sha");
    expect(msg).toContain(TAG_COMMIT_SHA);
    expect(msg).toContain(DEVELOP_SHA);
  });

  it("release tag ≠ develop tip → fails before any merge", async () => {
    const refs: RefMap = {
      "heads/develop": { object: { sha: DEVELOP_SHA, type: "commit" } },
      "heads/main": { object: { sha: MAIN_SHA, type: "commit" } },
      "tags/v1.0.0": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
    };
    const core = makeCore();
    const github = makeGithub({
      refs,
      tagRuns: [successRun(TAG_COMMIT_SHA)],
    });

    await syncRelease({ github, context, core, inputs: baseInputs });

    expect(core.setFailed).toHaveBeenCalledOnce();
    const msg = core.setFailed.mock.calls[0][0];
    expect(msg).toContain("Release tag v1.0.0 points to");
    expect(msg).toContain(TAG_COMMIT_SHA);
    expect(msg).toContain(DEVELOP_SHA);
    expect(github.rest.pulls.create).not.toHaveBeenCalled();
  });

  it("branch fallback run head_sha matches develop tip but tag != develop tip still fails", async () => {
    const refs: RefMap = {
      "heads/develop": { object: { sha: DEVELOP_SHA, type: "commit" } },
      "heads/main": { object: { sha: MAIN_SHA, type: "commit" } },
      "tags/v1.0.0": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
    };
    const core = makeCore();
    const github = makeGithub({
      refs,
      tagRuns: [],
      branchRuns: [successRun(DEVELOP_SHA)],
    });

    await syncRelease({ github, context, core, inputs: baseInputs });

    expect(core.setFailed).toHaveBeenCalledOnce();
    const msg = core.setFailed.mock.calls[0][0];
    expect(msg).toContain("Release tag v1.0.0 points to");
    expect(msg).toContain(TAG_COMMIT_SHA);
    expect(msg).toContain(DEVELOP_SHA);
    expect(github.rest.pulls.create).not.toHaveBeenCalled();
  });

  it("annotated tag dereferences to underlying commit", async () => {
    const refs: RefMap = {
      "heads/develop": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
      "heads/main": { object: { sha: MAIN_SHA, type: "commit" } },
      "tags/v1.0.0": { object: { sha: ANNOTATED_TAG_SHA, type: "tag" } },
    };
    const core = makeCore();
    const github = makeGithub({
      refs,
      tagObject: { object: { sha: TAG_COMMIT_SHA } },
      tagRuns: [successRun(TAG_COMMIT_SHA)],
    });

    const result = await syncRelease({ github, context, core, inputs: baseInputs });

    expect(result).toEqual({ skipped: false });
    expect(github.rest.git.getTag).toHaveBeenCalledOnce();
    expect(github.rest.pulls.create).toHaveBeenCalledOnce();
    expect(github.rest.pulls.create.mock.calls[0][0].head).toBe("develop");
  });

  it("main already matches develop → skipped, no merge", async () => {
    const refs: RefMap = {
      "heads/develop": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
      "heads/main": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
      "tags/v1.0.0": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
    };
    const core = makeCore();
    const github = makeGithub({ refs, tagRuns: [successRun(TAG_COMMIT_SHA)] });

    const result = await syncRelease({ github, context, core, inputs: baseInputs });

    expect(result).toEqual({ skipped: true });
    expect(core.setOutput).toHaveBeenCalledWith("skipped", "true");
    expect(github.rest.pulls.create).not.toHaveBeenCalled();
  });

  it("an open release PR already exists → skipped, no new PR created", async () => {
    const refs: RefMap = {
      "heads/develop": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
      "heads/main": { object: { sha: MAIN_SHA, type: "commit" } },
      "tags/v1.0.0": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
    };
    const core = makeCore();
    const github = makeGithub({
      refs,
      tagRuns: [successRun(TAG_COMMIT_SHA)],
      existingPrs: [
        { number: 7, html_url: "https://github.com/PM4-SmartFinance/SmartFinance/pull/7" },
      ],
    });

    const result = await syncRelease({ github, context, core, inputs: baseInputs });

    expect(result).toEqual({ skipped: true });
    expect(github.rest.pulls.create).not.toHaveBeenCalled();
    expect(core.info.mock.calls.some((c) => String(c[0]).includes("already open"))).toBe(true);
    expect(core.setOutput).toHaveBeenCalledWith("skipped", "true");
  });

  it("PR creation blocked by ruleset (403) → setFailed with body", async () => {
    const refs: RefMap = {
      "heads/develop": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
      "heads/main": { object: { sha: MAIN_SHA, type: "commit" } },
      "tags/v1.0.0": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
    };
    const core = makeCore();
    const github = makeGithub({
      refs,
      tagRuns: [successRun(TAG_COMMIT_SHA)],
      createPrError: octokitError(403, "Resource not accessible by integration"),
    });

    await syncRelease({ github, context, core, inputs: baseInputs });

    expect(core.setFailed).toHaveBeenCalledOnce();
    const msg = core.setFailed.mock.calls[0][0];
    expect(msg).toContain("Failed to open release PR");
    expect(msg).toContain("Resource not accessible by integration");
    expect(msg).toContain("HTTP 403");
    expect(msg).toContain(TAG_COMMIT_SHA);
  });

  it("PR creation non-403 error → setFailed with status + body", async () => {
    const refs: RefMap = {
      "heads/develop": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
      "heads/main": { object: { sha: MAIN_SHA, type: "commit" } },
      "tags/v1.0.0": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
    };
    const core = makeCore();
    const github = makeGithub({
      refs,
      tagRuns: [successRun(TAG_COMMIT_SHA)],
      createPrError: octokitError(500, "internal server error"),
    });

    await syncRelease({ github, context, core, inputs: baseInputs });

    expect(core.setFailed).toHaveBeenCalledOnce();
    const msg = core.setFailed.mock.calls[0][0];
    expect(msg).toContain("HTTP 500");
    expect(msg).toContain("internal server error");
    expect(msg).toContain(TAG_COMMIT_SHA);
  });

  it("dry-run skips PR creation but passes all checks", async () => {
    const refs: RefMap = {
      "heads/develop": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
      "heads/main": { object: { sha: MAIN_SHA, type: "commit" } },
      "tags/v1.0.0": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
    };
    const core = makeCore();
    const github = makeGithub({ refs, tagRuns: [successRun(TAG_COMMIT_SHA)] });

    const result = await syncRelease({
      github,
      context,
      core,
      inputs: { ...baseInputs, dryRun: true },
    });

    expect(result).toEqual({ skipped: true });
    expect(core.info.mock.calls.some((c) => String(c[0]).includes("[dry-run]"))).toBe(true);
    expect(github.rest.pulls.create).not.toHaveBeenCalled();
    expect(core.setOutput).toHaveBeenCalledWith("skipped", "true");
  });

  it("tag resolution failure includes tag and HTTP status", async () => {
    const refs: RefMap = {
      "heads/develop": { object: { sha: DEVELOP_SHA, type: "commit" } },
      "heads/main": { object: { sha: MAIN_SHA, type: "commit" } },
    };
    const core = makeCore();
    const github = makeGithub({
      refs,
      refErrors: { "tags/v1.0.0": octokitError(404, "tag does not exist") },
    });

    await syncRelease({ github, context, core, inputs: baseInputs });

    expect(core.setFailed).toHaveBeenCalledOnce();
    const msg = core.setFailed.mock.calls[0][0];
    expect(msg).toContain("v1.0.0");
    expect(msg).toContain("tag does not exist");
    expect(msg).toContain("HTTP 404");
  });
});
