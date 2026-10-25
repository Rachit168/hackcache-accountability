/** Fail closed: a saved Supabase session does not establish a staff role.
 * The server's scoped workflow queue is the authority for workspace entry.
 * No raw credential or private case content is returned to this helper.
 */
export async function staffAccessAllowed(
  hasSession: boolean,
  readScopedQueue: () => Promise<{ kind?: string }>,
): Promise<boolean> {
  if (!hasSession) return false;
  try {
    const view = await readScopedQueue();
    return view?.kind === 'reviewer' || view?.kind === 'office';
  } catch {
    // Network failure, 401, 403 and invalid JSON all leave the workspace locked.
    return false;
  }
}
