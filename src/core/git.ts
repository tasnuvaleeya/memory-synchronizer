import { simpleGit } from "simple-git";

export interface GitState {
  branch: string | null;
  isClean: boolean;
  stagedFiles: string[];
  modifiedFiles: string[];
}

export async function getGitState(cwd: string): Promise<GitState | null> {
  const git = simpleGit(cwd);
  try {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) return null;

    const [branch, status] = await Promise.all([
      git.revparse(["--abbrev-ref", "HEAD"]).catch(() => null),
      git.status(),
    ]);

    return {
      branch: branch?.trim() ?? null,
      isClean: status.isClean(),
      stagedFiles: status.staged,
      modifiedFiles: [...status.modified, ...status.not_added],
    };
  } catch {
    return null;
  }
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    return await simpleGit(cwd).checkIsRepo();
  } catch {
    return false;
  }
}
