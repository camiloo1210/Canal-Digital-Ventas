import { z } from 'zod';

export const KIVI_KNOWLEDGE_MAX_FILE_BYTES = 200_000;
export const KIVI_KNOWLEDGE_MAX_CONTENT_CHARS = 100_000;
export const KIVI_KNOWLEDGE_ALLOWED_EXTENSIONS: readonly string[] = ['.md', '.markdown', '.txt'];

const documentId = z.string().regex(/^[a-zA-Z0-9_.:@-]{1,200}$/);

export const kiviKnowledgeSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('upload'),
    // Empty creates a new document; a value replaces that document.
    documentId: z.union([z.literal(''), documentId]),
    title: z.string().trim().min(1).max(500),
    content: z.string().trim().min(1).max(KIVI_KNOWLEDGE_MAX_CONTENT_CHARS),
  }),
  z.object({ operation: z.enum(['delete', 'retry']), documentId }),
]);
