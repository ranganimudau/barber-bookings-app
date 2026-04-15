import { supabase } from "../supabase/supabaseClient";
import { resolveStorageImageUrl } from "./storageImageUrl";

export async function fetchServiceImages(serviceId) {
  if (!serviceId) return [];

  const { data, error } = await supabase.storage
    .from("avatars")
    .list("services", {
      limit: 100,
      search: `${serviceId}-`,
      sortBy: { column: "name", order: "desc" },
    });

  if (error || !data) return [];

  return data
    .filter((file) => file?.name?.startsWith(`${serviceId}-`))
    .map((file) => {
      const path = `services/${file.name}`;
      return {
        path,
        url: resolveStorageImageUrl(path),
      };
    })
    .filter((item) => item.url);
}

export async function fetchServiceImageUrls(serviceId) {
  const images = await fetchServiceImages(serviceId);
  return images.map((item) => item.url);
}
