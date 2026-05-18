/**
 * Next.js runs this once per new server instance (Node.js only).
 * Patches global `fetch` for Mockifyer before Route Handlers run.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }
  const { initializeMockifyerOnServer } = await import('./lib/mockifyer-server-init');
  await initializeMockifyerOnServer();
}
