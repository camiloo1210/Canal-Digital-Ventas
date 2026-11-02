export const IMAGE_COMPRESS_THRESHOLD_BYTES = 1.5 * 1024 * 1024;
export const IMAGE_MAX_SIDE = 2048;
export const IMAGE_UPLOAD_CONCURRENCY = 3;

export interface CompressionPlan {
  compress: boolean;
  width: number;
  height: number;
}

export function planCompression(input: {
  size: number;
  width: number;
  height: number;
}): CompressionPlan {
  const { size, width, height } = input;
  const longest = Math.max(width, height);
  if (size <= IMAGE_COMPRESS_THRESHOLD_BYTES && longest <= IMAGE_MAX_SIDE) {
    return { compress: false, width, height };
  }
  const scale = longest > IMAGE_MAX_SIDE ? IMAGE_MAX_SIDE / longest : 1;
  return {
    compress: true,
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export type UploadFailure = 'uploadFailed' | 'tooLargeAfterCompression';

export interface UploadableFile {
  size: number;
  type: string;
}

export interface UploadSlot {
  path: string;
  token: string;
}

export type UploadOutcome<F> =
  { status: 'done'; path: string; file: F } | { status: 'error'; reason: UploadFailure; file: F };

export interface UploadBatchDeps<F extends UploadableFile> {
  /** Returns a smaller re-encoded file, or null to keep the original. */
  prepare(file: F): Promise<F | null>;
  /** Asks the server for one signed upload per content type; null when refused. */
  requestSlots(contentTypes: string[]): Promise<UploadSlot[] | null>;
  put(slot: UploadSlot, file: F): Promise<boolean>;
}

export interface UploadBatchOptions<F extends UploadableFile> {
  concurrency: number;
  maxBytes: number;
  onOutcome(index: number, outcome: UploadOutcome<F>): void;
}

export async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const lanes = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async (): Promise<void> => {
      while (next < items.length) {
        const index = next;
        next += 1;
        await worker(items[index], index);
      }
    },
  );
  await Promise.all(lanes);
}

/** Picks the smallest candidate and enforces the storage limit. */
export function chooseUploadFile<F extends UploadableFile>(
  original: F,
  compressed: F | null,
  maxBytes: number,
): F | null {
  const candidate = compressed !== null && compressed.size < original.size ? compressed : original;
  return candidate.size <= maxBytes ? candidate : null;
}

/**
 * Prepares, authorizes and uploads files. A failure only affects its own file.
 * onOutcome is called exactly once per input index.
 */
export async function uploadBatch<F extends UploadableFile>(
  files: F[],
  deps: UploadBatchDeps<F>,
  options: UploadBatchOptions<F>,
): Promise<void> {
  const prepared: Array<{ index: number; file: F }> = [];
  await runPool(files, options.concurrency, async (file, index): Promise<void> => {
    let compressed: F | null = null;
    try {
      compressed = await deps.prepare(file);
    } catch {
      compressed = null;
    }
    const chosen = chooseUploadFile(file, compressed, options.maxBytes);
    if (chosen === null) {
      options.onOutcome(index, { status: 'error', reason: 'tooLargeAfterCompression', file });
      return;
    }
    prepared.push({ index, file: chosen });
  });
  if (prepared.length === 0) return;
  prepared.sort((a, b): number => a.index - b.index);

  let slots: UploadSlot[] | null = null;
  try {
    slots = await deps.requestSlots(prepared.map((entry): string => entry.file.type));
  } catch {
    slots = null;
  }
  if (slots === null || slots.length !== prepared.length) {
    for (const entry of prepared) {
      options.onOutcome(entry.index, { status: 'error', reason: 'uploadFailed', file: entry.file });
    }
    return;
  }
  const granted = slots;
  await runPool(prepared, options.concurrency, async (entry, position): Promise<void> => {
    let ok = false;
    try {
      ok = await deps.put(granted[position], entry.file);
    } catch {
      ok = false;
    }
    options.onOutcome(
      entry.index,
      ok
        ? { status: 'done', path: granted[position].path, file: entry.file }
        : { status: 'error', reason: 'uploadFailed', file: entry.file },
    );
  });
}
