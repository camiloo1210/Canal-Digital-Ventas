import { EventBusPort, DomainEvent } from '@canaldigital/packages/core';

type EventHandler = (event: DomainEvent) => Promise<void> | void;

export class InMemoryEventBus implements EventBusPort {
  private handlers: Map<string, EventHandler[]> = new Map();

  /**
   * Registers a handler for a specific domain event.
   */
  subscribe(eventName: string, handler: EventHandler): void {
    const currentHandlers = this.handlers.get(eventName) || [];
    this.handlers.set(eventName, [...currentHandlers, handler]);
  }

  /**
   * Executes all registered handlers for the dispatched events.
   * Awaits execution synchronously to ensure events are not lost in Server Actions.
   */
  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      const eventHandlers = this.handlers.get(event.eventName) || [];

      // Useful for development to log events passing through the bus
      console.log(`[EventBus] Dispatching event: ${event.eventName}`, event);

      // Execute all handlers in parallel and wait for them to finish
      await Promise.all(eventHandlers.map((handler) => handler(event)));
    }
  }
}
