import {describe, expect, it} from 'vitest';
import {getResourcePickerSelectionImage} from '../resourcePicker';

describe('getResourcePickerSelectionImage', () => {
  it('prefers the product image for single-variant products', () => {
    expect(
      getResourcePickerSelectionImage(
        {
          totalVariants: 1,
          images: [{originalSrc: 'product-image.jpg', altText: 'Product image'}],
        },
        {
          image: {originalSrc: 'variant-image.jpg', altText: 'Variant image'},
        },
      ),
    ).toEqual({
      url: 'product-image.jpg',
      altText: 'Product image',
    });
  });

  it('falls back to the product image for multi-variant products when the variant image is missing', () => {
    expect(
      getResourcePickerSelectionImage(
        {
          totalVariants: 2,
          images: [{originalSrc: 'product-image.jpg', altText: 'Product image'}],
        },
        {
          image: null,
        },
      ),
    ).toEqual({
      url: 'product-image.jpg',
      altText: 'Product image',
    });
  });

  it('prefers the variant image for multi-variant products when available', () => {
    expect(
      getResourcePickerSelectionImage(
        {
          totalVariants: 2,
          images: [{originalSrc: 'product-image.jpg', altText: 'Product image'}],
        },
        {
          image: {originalSrc: 'variant-image.jpg', altText: 'Variant image'},
        },
      ),
    ).toEqual({
      url: 'variant-image.jpg',
      altText: 'Variant image',
    });
  });
});
