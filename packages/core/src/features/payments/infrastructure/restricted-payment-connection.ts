import postgres from 'postgres';
import { PaymentRepositoryException } from '@/payments/application/exceptions/payment-repository.exception';

export async function openRestrictedPaymentConnection(
  databaseUrl: string,
  role:
    | 'payment_worker_role'
    | 'payment_reconciliation_role'
    | 'payment_egress_role'
    | 'payment_retention_role',
): Promise<postgres.Sql<Record<string, unknown>>> {
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 20,
    connection: { statement_timeout: 10000, application_name: `canaldigital-${role}` },
  });
  try {
    const identity = await sql<
      { authorized: boolean }[]
    >`SELECT NOT r.rolsuper AND NOT r.rolbypassrls AND NOT r.rolcreaterole
      AND session_user=current_user AND pg_has_role(session_user,${role}::name,'MEMBER')
      AND NOT pg_has_role(session_user,'payments_rpc_owner','MEMBER') AND NOT pg_has_role(session_user,'service_role','MEMBER')
      AND (SELECT count(*)=1 FROM unnest(ARRAY['payment_worker_role','payment_reconciliation_role','payment_egress_role','payment_retention_role','payment_admin_proxy_role','payment_checkout_role','payment_ingestion_role','payment_order_domain_role']) required_role WHERE pg_has_role(session_user,required_role::name,'MEMBER'))
      AND NOT has_table_privilege(current_user,'sales.payments','INSERT,UPDATE,DELETE,TRUNCATE') AS authorized FROM pg_roles r WHERE r.rolname=session_user`;
    if (identity[0]?.authorized !== true)
      throw new PaymentRepositoryException('Unsafe payment process identity.');
    return sql;
  } catch {
    await sql.end({ timeout: 5 });
    throw new PaymentRepositoryException('Restricted payment process connection failed.');
  }
}
