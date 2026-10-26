// How a git address is shown: never with credentials, and as people read it.

// A git address with any credentials taken out: "https://user:TOKEN@host/x"
// and "ssh://git:pw@host/x" become "https://host/x" and "ssh://host/x".
// Every place that shows a project's address goes through it, the tooltip
// included: a token a remote carries for cloning is not for the screen.
export function withoutCredentials(gitUrl: string): string {
  return gitUrl.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^@/]*@/i, "$1");
}

// The address as people read it: credentials out, the scheme and ".git"
// dropped ("github.com/org/repo").
export function repositoryName(gitUrl: string): string {
  return withoutCredentials(gitUrl)
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .replace(/\.git\/?$/, "");
}

// The repository's page in its web host (GitHub, GitLab…) from the address
// git clones it with: "https://host/org/repo.git" and "git@host:org/repo.git"
// both become "https://host/org/repo". Anything else (a local path, ssh://
// with a port), or an address that does not parse, has no page to open, and
// nothing pretends it does.
export function repositoryPage(gitUrl: string): string | undefined {
  const scp = /^[\w.-]+@([\w.-]+):(.+?)(\.git)?\/?$/.exec(gitUrl);
  if (scp) return `https://${scp[1]}/${scp[2]}`;
  if (!/^https?:\/\//.test(gitUrl)) return undefined;
  try {
    // Never a token in a link someone might copy: credentials an https
    // remote carries for cloning stay out of the page address.
    const url = new URL(gitUrl);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\.git\/?$/, "");
    return url.toString();
  } catch {
    return undefined;
  }
}

// A git project checkout is periodic work with no data of its own: it last
// pulled, last failed, or has not pulled yet.
export const PROJECT_LABELS = {
  fresh: "Synced",
  pending: "Not pulled yet",
};

// A commit's own page, where the repository has one (GitHub, GitLab and
// their kind all answer /commit/<id>); undefined otherwise.
export function commitPage(
  gitUrl: string,
  revision: string,
): string | undefined {
  const page = repositoryPage(gitUrl);
  return page ? `${page.replace(/\/$/, "")}/commit/${revision}` : undefined;
}
