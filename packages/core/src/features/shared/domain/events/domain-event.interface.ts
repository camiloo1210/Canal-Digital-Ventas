export interface DomainEvent {
  eventName: string;
  occurredOn: Date;
  [key: string]: unknown;
}
