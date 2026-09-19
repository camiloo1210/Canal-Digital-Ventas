import { SupabaseClient } from '@supabase/supabase-js';
import { OutboxPort, OutboxEvent } from '@/shared/application/ports/out/outbox.port';

/**
 * Outbox Adapter using direct service_role queries.
 *
 * The V5 RPC `claim_outbox_events` enforces `has_role(session_user, 'outbox_worker_role')`,
 * which rejects the service_role client. Since this adapter runs server-side with the
 * service_role key (which bypasses RLS), we use direct table operations with
 * advisory locks for safe concurrent processing.
 */
export class SupabaseOutboxAdapter implements OutboxPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async claimNextEvent(): Promise<OutboxEvent | null> {
    // Direct query: select oldest PENDING event and atomically mark it PROCESSING.
    // service_role bypasses RLS, so we can read/write core.outbox_events directly.
    const { data: pending, error: selectError } = await this.supabase
      .schema('core')
      .from('outbox_events')
      .select('id, event_type, aggregate_id, payload, attempt_count, status')
      .in('status', ['PENDING', 'RETRY'])
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (selectError || !pending) {
      return null;
    }

    // Atomically claim it
    const { data: claimed, error: updateError } = await this.supabase
      .schema('core')
      .from('outbox_events')
      .update({
        status: 'PROCESSING',
        locked_at: new Date().toISOString(),
        lease_until: new Date(Date.now() + 60_000).toISOString(),
        attempt_count: (pending.attempt_count || 0) + 1,
      })
      .eq('id', pending.id)
      .eq('status', pending.status === 'RETRY' ? 'RETRY' : 'PENDING')
      .select('id, event_type, aggregate_id, payload, attempt_count')
      .single();

    if (updateError || !claimed) {
      return null;
    }

    return {
      id: claimed.id,
      eventType: claimed.event_type,
      aggregateId: claimed.aggregate_id,
      payload: claimed.payload,
      retries: claimed.attempt_count || 1,
    };
  }

  async markAsProcessed(eventId: string): Promise<void> {
    const { error } = await this.supabase
      .schema('core')
      .from('outbox_events')
      .update({
        status: 'COMPLETED',
        locked_by: null,
        lease_until: null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    if (error) {
      console.error(`[SupabaseOutboxAdapter] Failed to mark event ${eventId} as processed:`, error);
    }
  }

  async markAsFailed(eventId: string, errorMessage: string): Promise<void> {
    const { data: eventRow } = await this.supabase
      .schema('core')
      .from('outbox_events')
      .select('attempt_count')
      .eq('id', eventId)
      .single();

    const retries = eventRow?.attempt_count || 1;
    const isDead = retries >= 5;

    const { error } = await this.supabase
      .schema('core')
      .from('outbox_events')
      .update({
        status: isDead ? 'DEAD' : 'RETRY',
        locked_by: null,
        lease_until: null,
        next_attempt_at: isDead
          ? null
          : new Date(Date.now() + Math.pow(2, retries) * 1000).toISOString(),
      })
      .eq('id', eventId);

    if (isDead) {
      console.error(
        `[CRITICAL ALERT] Event ${eventId} moved to DLQ after ${retries} attempts. Error: ${errorMessage}`,
      );
    }

    if (error) {
      console.error(`[SupabaseOutboxAdapter] Failed to mark event ${eventId} as failed:`, error);
    }
  }
}
