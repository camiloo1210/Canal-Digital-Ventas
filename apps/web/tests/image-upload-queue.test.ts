import { describe, expect, it } from 'vitest';
import {
  chooseUploadFile,
  planCompression,
  uploadBatch,
  type UploadBatchDeps,
  type UploadOutcome,
  type UploadSlot,
} from '@/features/products/utils/image-upload-queue';

interface FakeFile {
  name: string;
  size: number;
  type: string;
}
const file = (name: string, size = 1000, type = 'image/png'): FakeFile => ({ name, size, type });
const MAX = 5 * 1024 * 1024;

function harness(overrides: Partial<UploadBatchDeps<FakeFile>> = {}): {
  deps: UploadBatchDeps<FakeFile>;
  stats: { active: number; peak: number; requested: string[][] };
} {
  const stats = { active: 0, peak: 0, requested: [] as string[][] };
  const deps: UploadBatchDeps<FakeFile> = {
    prepare: async (): Promise<FakeFile | null> => null,
    requestSlots: async (types): Promise<UploadSlot[] | null> => {
      stats.requested.push(types);
      return types.map((_type, i): UploadSlot => ({
        path: `t/${stats.requested.length}-${i}.png`,
        token: 'k',
      }));
    },
    put: async (): Promise<boolean> => {
      stats.active += 1;
      stats.peak = Math.max(stats.peak, stats.active);
      await new Promise<void>((resolve): void => {
        setTimeout(resolve, 5);
      });
      stats.active -= 1;
      return true;
    },
    ...overrides,
  };
  return { deps, stats };
}

async function run(
  files: FakeFile[],
  deps: UploadBatchDeps<FakeFile>,
): Promise<Map<number, UploadOutcome<FakeFile>>> {
  const outcomes = new Map<number, UploadOutcome<FakeFile>>();
  await uploadBatch(files, deps, {
    concurrency: 3,
    maxBytes: MAX,
    onOutcome: (index, outcome): void => {
      outcomes.set(index, outcome);
    },
  });
  return outcomes;
}

describe('planCompression', (): void => {
  it('keeps small images with small dimensions untouched', (): void => {
    expect(planCompression({ size: 1_000_000, width: 2048, height: 1000 }).compress).toBe(false);
  });
  it('compresses files above 1.5 MB', (): void => {
    expect(planCompression({ size: 1.5 * 1024 * 1024 + 1, width: 800, height: 600 })).toEqual({
      compress: true,
      width: 800,
      height: 600,
    });
  });
  it('scales the longest side down to 2048 keeping the ratio', (): void => {
    expect(planCompression({ size: 100, width: 4096, height: 3072 })).toEqual({
      compress: true,
      width: 2048,
      height: 1536,
    });
  });
});

describe('chooseUploadFile', (): void => {
  it('prefers the compressed file only when smaller', (): void => {
    const original = file('o', 3000);
    expect(chooseUploadFile(original, file('c', 1000), MAX)?.name).toBe('c');
    expect(chooseUploadFile(original, file('c', 4000), MAX)?.name).toBe('o');
  });
  it('rejects results above the storage limit', (): void => {
    expect(chooseUploadFile(file('o', MAX + 1), null, MAX)).toBeNull();
  });
});

describe('uploadBatch', (): void => {
  it('never runs more than 3 uploads at once and reports every file', async (): Promise<void> => {
    const { deps, stats } = harness();
    const outcomes = await run(
      Array.from({ length: 8 }, (_v, i): FakeFile => file('f' + i)),
      deps,
    );
    expect(stats.peak).toBe(3);
    expect(stats.requested).toHaveLength(1);
    expect(stats.requested[0]).toHaveLength(8);
    expect([...outcomes.values()].every((outcome): boolean => outcome.status === 'done')).toBe(
      true,
    );
  });
  it('isolates one failed upload from the others', async (): Promise<void> => {
    let calls = 0;
    const { deps } = harness({
      put: async (): Promise<boolean> => {
        calls += 1;
        return calls !== 2;
      },
    });
    const outcomes = await run([file('a'), file('b'), file('c')], deps);
    const statuses = [0, 1, 2].map((i): string | undefined => outcomes.get(i)?.status);
    expect(statuses.filter((status): boolean => status === 'done')).toHaveLength(2);
    expect(statuses.filter((status): boolean => status === 'error')).toHaveLength(1);
  });
  it('treats a thrown upload as a failure of that file only', async (): Promise<void> => {
    const { deps } = harness({
      put: async (slot): Promise<boolean> => {
        if (slot.path.endsWith('-0.png')) throw new Error('network');
        return true;
      },
    });
    const outcomes = await run([file('a'), file('b')], deps);
    expect(outcomes.get(0)).toMatchObject({ status: 'error', reason: 'uploadFailed' });
    expect(outcomes.get(1)?.status).toBe('done');
  });
  it('fails every file when the server refuses the batch, then a retry succeeds', async (): Promise<void> => {
    let refuse = true;
    const { deps } = harness({
      requestSlots: async (types): Promise<UploadSlot[] | null> =>
        refuse ? null : types.map((): UploadSlot => ({ path: 't/ok.png', token: 'k' })),
    });
    const first = await run([file('a'), file('b')], deps);
    expect([...first.values()].map((o): string => o.status)).toEqual(['error', 'error']);
    refuse = false;
    const retry = await run([file('a')], deps);
    expect(retry.get(0)).toMatchObject({ status: 'done', path: 't/ok.png' });
  });
  it('flags files still above 5 MB after compression without blocking the rest', async (): Promise<void> => {
    const { deps, stats } = harness();
    const outcomes = await run([file('big', MAX + 10), file('ok')], deps);
    expect(outcomes.get(0)).toMatchObject({ status: 'error', reason: 'tooLargeAfterCompression' });
    expect(outcomes.get(1)?.status).toBe('done');
    expect(stats.requested[0]).toEqual(['image/png']);
  });
  it('requests the content type of the compressed file and uploads it', async (): Promise<void> => {
    const uploaded: FakeFile[] = [];
    const { deps, stats } = harness({
      prepare: async (): Promise<FakeFile | null> => file('small.webp', 200, 'image/webp'),
      put: async (_slot, f): Promise<boolean> => {
        uploaded.push(f);
        return true;
      },
    });
    await run([file('huge.png', 4 * 1024 * 1024)], deps);
    expect(stats.requested[0]).toEqual(['image/webp']);
    expect(uploaded[0].name).toBe('small.webp');
  });
  it('falls back to the original when preparation throws', async (): Promise<void> => {
    const { deps } = harness({
      prepare: async (): Promise<FakeFile | null> => {
        throw new Error('decode');
      },
    });
    const outcomes = await run([file('a')], deps);
    expect(outcomes.get(0)?.status).toBe('done');
  });
});
