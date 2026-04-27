type ResourcePickerImage = {
  originalSrc?: string | null;
  altText?: string | null;
} | null | undefined;

type ResourcePickerVariant = {
  image?: ResourcePickerImage;
} | null;

type ResourcePickerProduct = {
  totalVariants?: number | null;
  images?: ResourcePickerImage[] | null;
} | null;

export function getResourcePickerSelectionImage(
  product: ResourcePickerProduct,
  variant: ResourcePickerVariant,
) {
  const variantImage = normalizeResourcePickerImage(variant?.image);
  const productImage = normalizeResourcePickerImage(product?.images?.[0] ?? null);

  if ((product?.totalVariants ?? 0) > 1) {
    return variantImage ?? productImage;
  }

  return productImage ?? variantImage;
}

function normalizeResourcePickerImage(image: ResourcePickerImage) {
  if (!image?.originalSrc) {
    return null;
  }

  return {
    url: image.originalSrc,
    altText: image.altText ?? '',
  };
}
