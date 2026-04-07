export async function triggerDeploy(): Promise<void> {
  const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;

  if (!deployHookUrl) {
    console.warn("VERCEL_DEPLOY_HOOK_URL is not configured. Skipping deploy trigger.");
    return;
  }

  const response = await fetch(deployHookUrl, {
    method: "POST",
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Deploy hook failed: ${response.status}`);
  }
}
