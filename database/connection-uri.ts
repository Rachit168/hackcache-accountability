export function migrationConnectionUri(runtimeUri: string, projectRef: string, password: string) {
  const uri = new URL(runtimeUri);
  const user = decodeURIComponent(uri.username);
  const direct = uri.hostname === `db.${projectRef}.supabase.co` && user === 'hc_runtime';
  const pooled = uri.hostname.endsWith('.pooler.supabase.com') && user === `hc_runtime.${projectRef}`;
  if (!direct && !pooled) throw new Error('Runtime URL does not target the confirmed project.');
  uri.username = pooled ? `postgres.${projectRef}` : 'postgres';
  // URL.password does not escape a literal percent sign. Encode exactly once
  // before assigning, so pg's decodeURIComponent preserves the original secret.
  uri.password = encodeURIComponent(password);
  return uri.toString();
}
