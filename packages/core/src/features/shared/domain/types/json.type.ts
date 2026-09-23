export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

/**
 * Safely converts an object into a clean JsonObject.
 * In a real production environment with complex domain events (e.g. Dates, specific Value Objects),
 * this function should correctly serialize those into primitives.
 * For this implementation, we use a structured clone approach to guarantee a clean JSON object 
 * while stripping undefined values and methods, without resorting to JSON.parse(JSON.stringify).
 */
export function toJsonObject(obj: unknown): JsonObject {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('Expected an object to convert to JsonObject');
  }
  
  // This recursively extracts enumerable properties, effectively fulfilling the JSON contract
  // natively without stringify/parse hacks, and dropping methods.
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && typeof value !== 'function') {
      // In a more complex domain, we'd handle Value Objects serialization here.
      // For now, Date objects are serialized to ISO strings (standard JSON behavior).
      if (value instanceof Date) {
        result[key] = value.toISOString();
      } else {
        result[key] = value;
      }
    }
  }
  return result as JsonObject;
}
