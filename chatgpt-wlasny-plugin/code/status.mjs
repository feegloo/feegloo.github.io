export function runState(run) {
  if (!run) return 'waiting';
  if (run.status !== 'completed') return 'running';
  if (run.conclusion === 'success') return 'success';
  if (run.conclusion === 'cancelled') return 'cancelled';
  if (['skipped', 'neutral'].includes(run.conclusion)) return 'skipped';
  return 'failure';
}

export function createStatusReader(repository, request = fetch) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Set GITHUB_REPOSITORY=owner/repo');
  const cache = new Map();
  return async ({ sha, workflow }, { fresh = false } = {}) => {
    const key = `${sha}:${workflow}`;
    const hit = cache.get(key);
    if (!fresh && hit && Date.now() - hit.created < 10000) return hit.watch;
    const url = new URL(`https://api.github.com/repos/${repository}/actions/workflows/${encodeURIComponent(workflow)}/runs`);
    url.searchParams.set('head_sha', sha);
    url.searchParams.set('per_page', '100');
    const response = await request(url, { headers: { Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'hello-workflow-mcp' }, signal: AbortSignal.timeout(10000) });
    // No token: this example can only read public repositories.
    if (!response.ok) throw new Error(`GitHub HTTP ${response.status}. Check the public repository, workflow filename and API rate limit.`);
    const { workflow_runs = [] } = await response.json();
    const run = workflow_runs.filter(item => item.head_sha === sha).sort((a, b) => b.id - a.id)[0];
    const watch = { repository, sha, workflow, state: runState(run),
      commitUrl: `https://github.com/${repository}/commit/${sha}`, runUrl: run?.html_url ?? null,
      checkedAt: new Date().toISOString() };
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(key, { created: Date.now(), watch });
    return watch;
  };
}
