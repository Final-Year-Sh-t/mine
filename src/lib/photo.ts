import { supabase } from '@/integrations/supabase/client';

/**
 * Photos stored in the identity-photos bucket are saved as their storage path
 * (e.g. `{institutionId}/{uuid}.jpg`), while external images are saved as full
 * http(s) URLs. This helper distinguishes the two.
 */
export const isStoragePhoto = (url: string | null | undefined): boolean =>
  !!url && !/^https?:\/\//i.test(url);

/**
 * Resolves a stored photo value into a URL an <img> tag can load.
 * Storage paths are converted to short-lived signed URLs (RLS-gated bucket);
 * external URLs pass through unchanged.
 */
export async function resolvePhotoUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (!isStoragePhoto(url)) return url;

  const { data, error } = await supabase.storage
    .from('identity-photos')
    .createSignedUrl(url, 3600); // 1 hour, refreshed on each render

  if (error || !data) return null;
  return data.signedUrl;
}