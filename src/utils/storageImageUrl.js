import { supabase } from "../supabase/supabaseClient";

/**
 * Turn DB value into a URI React Native Image can load:
 * - data URLs pass through
 * - http(s) get cache-bust query
 * - storage object paths become public URLs for the given bucket
 */
export function resolveStorageImageUrl(rawUrlOrPath, bucket = "avatars") {
  if (!rawUrlOrPath) return null;
  if (rawUrlOrPath.startsWith("data:image/")) return rawUrlOrPath;
  if (rawUrlOrPath.startsWith("http")) {
    const sep = rawUrlOrPath.includes("?") ? "&" : "?";
    return `${rawUrlOrPath}${sep}t=${Date.now()}`;
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(rawUrlOrPath);
  return data?.publicUrl ? `${data.publicUrl}?t=${Date.now()}` : null;
}
