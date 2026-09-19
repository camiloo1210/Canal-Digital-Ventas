export interface OutboxEvent {
  id: string;
  eventType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  retries: number;
}

export interface OutboxPort {
  claimNextEvent(): Promise<OutboxEvent | null>;
  markAsProcessed(eventId: string): Promise<void>;
  markAsFailed(eventId: string, error: string): Promise<void>;
}
