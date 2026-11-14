export function postgresConnection(environment = process.env) {
  const url = new URL(environment.DIRECT_URL || environment.DATABASE_URL || '');
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('PostgreSQL manzili kerak');
  for (const key of ['schema', 'pgbouncer', 'connection_limit', 'pool_timeout', 'socket_timeout', 'statement_cache_size', 'sslaccept']) url.searchParams.delete(key);
  const password = decodeURIComponent(url.password);
  url.password = '';
  return { url: url.toString(), env: { ...environment, ...(password ? { PGPASSWORD: password } : {}) } };
}
