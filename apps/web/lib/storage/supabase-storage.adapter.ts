import { createClient } from '@/lib/supabase/server';

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
}
