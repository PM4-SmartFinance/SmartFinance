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
      listWorkflowRunsForWorkflow: ReturnType<typeof vi.fn>;
    };
    repos: {
      merge: ReturnType<typeof vi.fn>;
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
  mergeError?: Error;
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
        listWorkflowRunsForWorkflow: vi.fn(
          async ({ head_sha }: { head_sha?: string; branch?: string }) => {
            const result = head_sha !== undefined ? opts.tagRuns : opts.branchRuns;
            if (result instanceof Error) throw result;
            return { data: { workflow_runs: result ?? [] } };
          },
        ),
      },
      repos: {
        merge: vi.fn(async () => {
          if (opts.mergeError) throw opts.mergeError;
          return { data: { sha: "merge-commit-sha" } };
        }),
      },
    },
  };
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
    expect(github.rest.repos.merge).not.toHaveBeenCalled();
  });

  it("happy path with tag-SHA hit merges using release tag SHA", async () => {
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
    expect(github.rest.repos.merge).toHaveBeenCalledOnce();
    const mergeArgs = github.rest.repos.merge.mock.calls[0][0];
    expect(mergeArgs.base).toBe("main");
    expect(mergeArgs.head).toBe(TAG_COMMIT_SHA);
    expect(mergeArgs.head).not.toBe("develop");
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
    expect(github.rest.repos.merge).not.toHaveBeenCalled();
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

  it("tag-SHA empty + branch fallback hit merges", async () => {
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
    expect(github.rest.repos.merge).toHaveBeenCalledOnce();
    expect(github.rest.repos.merge.mock.calls[0][0].head).toBe(TAG_COMMIT_SHA);
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
    expect(github.rest.repos.merge).toHaveBeenCalledOnce();
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
    const calls = github.rest.actions.listWorkflowRunsForWorkflow.mock.calls;
    expect(calls).toHaveLength(1);
    expect(github.rest.repos.merge).not.toHaveBeenCalled();
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
    expect(github.rest.repos.merge).not.toHaveBeenCalled();
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
    expect(github.rest.repos.merge).not.toHaveBeenCalled();
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
    const mergeArgs = github.rest.repos.merge.mock.calls[0][0];
    expect(mergeArgs.head).toBe(TAG_COMMIT_SHA);
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
    expect(github.rest.repos.merge).not.toHaveBeenCalled();
  });

  it("merge 409 conflict → setFailed with conflict message + body", async () => {
    const refs: RefMap = {
      "heads/develop": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
      "heads/main": { object: { sha: MAIN_SHA, type: "commit" } },
      "tags/v1.0.0": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
    };
    const core = makeCore();
    const github = makeGithub({
      refs,
      tagRuns: [successRun(TAG_COMMIT_SHA)],
      mergeError: octokitError(409, "Merge conflict"),
    });

    await syncRelease({ github, context, core, inputs: baseInputs });

    expect(core.setFailed).toHaveBeenCalledOnce();
    const msg = core.setFailed.mock.calls[0][0];
    expect(msg).toContain("Merge conflict");
    expect(msg).toContain(TAG_COMMIT_SHA);
    expect(msg).toContain(MAIN_SHA);
  });

  it("merge non-409 error → setFailed with status + body", async () => {
    const refs: RefMap = {
      "heads/develop": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
      "heads/main": { object: { sha: MAIN_SHA, type: "commit" } },
      "tags/v1.0.0": { object: { sha: TAG_COMMIT_SHA, type: "commit" } },
    };
    const core = makeCore();
    const github = makeGithub({
      refs,
      tagRuns: [successRun(TAG_COMMIT_SHA)],
      mergeError: octokitError(500, "internal server error"),
    });

    await syncRelease({ github, context, core, inputs: baseInputs });

    expect(core.setFailed).toHaveBeenCalledOnce();
    const msg = core.setFailed.mock.calls[0][0];
    expect(msg).toContain("HTTP 500");
    expect(msg).toContain("internal server error");
    expect(msg).toContain(TAG_COMMIT_SHA);
  });

  it("dry-run skips merge but passes all checks", async () => {
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
    expect(github.rest.repos.merge).not.toHaveBeenCalled();
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
