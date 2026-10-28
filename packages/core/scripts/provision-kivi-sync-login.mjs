// Sets the password of the restricted Kivi sync login and prints the worker's connection URL.
// The login itself and its permissions come from the migrations (20261020000000 / 20261027000000
// / 20261028000000). The password is never stored in Git: pass it through the environment.
//
//   KIVI_SYNC_ADMIN_DATABASE_URL=<owner/admin url>  KIVI_SYNC_LOGIN_PASSWORD=<password> \
//     pnpm kivi:provision-login
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';

export class KiviLoginProvisioningException extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'KiviLoginProvisioningException';
  }
}

export const LOGIN = 'canaldigital_kivi_sync';
const MIN_PASSWORD_LENGTH = 24;

/** Derives the worker URL from the admin URL: same host/db, restricted user, encoded password. */
export function buildWorkerUrl(adminUrl, password) {
  const url = new URL(adminUrl);
  // Supabase poolers address a role as "<role>.<project-ref>".
  const projectRef = url.username.includes('.') ? url.username.split('.').slice(1).join('.') : '';
  const worker = new URL(adminUrl);
  worker.username = projectRef ? `${LOGIN}.${projectRef}` : LOGIN;
  worker.password = password;
  return worker.toString();
}

export function validatePassword(password) {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new KiviLoginProvisioningException(
      `KIVI_SYNC_LOGIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }
  const forbidden = ["'", String.fromCharCode(92), String.fromCharCode(0)];
  if (forbidden.some((character) => password.includes(character))) {
    throw new KiviLoginProvisioningException(
      'KIVI_SYNC_LOGIN_PASSWORD must not contain quotes, backslashes or NUL',
    );
  }
}

const CHECKS = `
  SELECT
    r.rolcanlogin AS can_login,
    NOT (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls) AS unprivileged,
    pg_has_role(r.oid, 'kivi_sync_worker_role', 'MEMBER') AS in_worker_role,
    pg_has_role(r.oid, 'outbox_worker_role', 'MEMBER') AS in_outbox_role,
    NOT has_table_privilege(r.oid, 'core.kivi_connections', 'SELECT') AS no_direct_table_access
  FROM pg_roles r WHERE r.rolname = '${LOGIN}'`;

async function main() {
  const adminUrl = process.env.KIVI_SYNC_ADMIN_DATABASE_URL;
  const password = process.env.KIVI_SYNC_LOGIN_PASSWORD;
  if (!adminUrl)
    throw new KiviLoginProvisioningException('KIVI_SYNC_ADMIN_DATABASE_URL is required');
  validatePassword(password);

  const sql = postgres(adminUrl, {
    max: 1,
    ssl: process.env.KIVI_SYNC_ADMIN_SSL === 'off' ? false : 'require',
    onnotice: () => {},
  });
  try {
    const exists = await sql`SELECT 1 FROM pg_roles WHERE rolname = ${LOGIN}`;
    if (exists.length === 0) {
      throw new KiviLoginProvisioningException(
        `Login ${LOGIN} does not exist: apply the Kivi migrations first`,
      );
    }
    // ALTER ROLE cannot take bind parameters; the password was validated above.
    await sql.unsafe(`ALTER ROLE ${LOGIN} WITH PASSWORD '${password}'`);
    const [checks] = await sql.unsafe(CHECKS);
    const failed = Object.entries(checks)
      .filter(([, ok]) => ok !== true)
      .map(([name]) => name);
    if (failed.length > 0) {
      throw new KiviLoginProvisioningException(
        `Login permission checks failed: ${failed.join(', ')}`,
      );
    }
  } finally {
    await sql.end();
  }
  console.log('Password set and permissions verified for', LOGIN);
  console.log('Put this in apps/worker/.env (keep it secret):');
  console.log(`KIVI_SYNC_DATABASE_URL=${buildWorkerUrl(adminUrl, password)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      error instanceof KiviLoginProvisioningException
        ? error.message
        : 'Kivi login provisioning failed; verify database access and migrations.',
    );
    process.exit(1);
  });
}
