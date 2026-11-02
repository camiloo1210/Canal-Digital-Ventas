import { createClient } from '@/lib/supabase/server';

export interface StorageSignedUpload {
  path: string;
  token: string;
}

export interface StorageObjectInfo {
  exists: boolean;
  size: number | null;
  contentType: string | null;
}

export class SupabaseStorageAdapter {
  constructor(private readonly bucket: string = 'products') {}

  async uploadImage(file: File, path: string): Promise<string> {
    const supabase = await createClient();

    const { data, error } = await supabase.storage.from(this.bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

    if (error) {
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage.from(this.bucket).getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  }

  /** Issues a single-use upload token for `path`, authorized by the caller's session. */
  async createSignedUpload(path: string): Promise<StorageSignedUpload> {
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from(this.bucket).createSignedUploadUrl(path);
    if (error || !data) {
      throw new Error(`Failed to create signed upload: ${error?.message ?? 'no data'}`);
    }
    return { path: data.path, token: data.token };
  }

  /** Reads storage metadata; a missing object yields `exists: false`. */
  async objectInfo(path: string): Promise<StorageObjectInfo> {
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from(this.bucket).info(path);
    if (error || !data) return { exists: false, size: null, contentType: null };
    return {
      exists: true,
      size: typeof data.size === 'number' ? data.size : null,
      contentType: typeof data.contentType === 'string' ? data.contentType : null,
    };
  }

  async publicUrl(path: string): Promise<string> {
    const supabase = await createClient();
    return supabase.storage.from(this.bucket).getPublicUrl(path).data.publicUrl;
  }
}
