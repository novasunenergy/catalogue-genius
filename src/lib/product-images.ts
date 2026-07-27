import { supabase } from "@/integrations/supabase/client";

const PRODUCT_IMAGE_BUCKET = "product-images";
const SIGNED_IMAGE_TTL_SECONDS = 60 * 60 * 24 * 365 * 10;

export async function createProductImageUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .createSignedUrl(path, SIGNED_IMAGE_TTL_SECONDS);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Failed to resolve image URL");
  return data.signedUrl;
}

function extractProductImagePath(imageUrl: string) {
  const marker = `/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/`;
  const markerIndex = imageUrl.indexOf(marker);
  if (markerIndex === -1) return null;
  const pathWithQuery = imageUrl.slice(markerIndex + marker.length);
  const path = pathWithQuery.split("?")[0];
  return path ? decodeURIComponent(path) : null;
}

export async function normalizeProductImageUrl(imageUrl: string | null) {
  if (!imageUrl) return null;
  const path = extractProductImagePath(imageUrl);
  if (!path) return imageUrl;
  return createProductImageUrl(path);
}

export async function normalizeProductImageUrls<T extends { image_url: string | null }>(products: T[]) {
  return Promise.all(
    products.map(async (product) => ({
      ...product,
      image_url: await normalizeProductImageUrl(product.image_url),
    })),
  );
}