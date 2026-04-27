import {describe, expect, test} from 'vitest';

import {mergeContentSecurityPolicyHeaders} from './entry.server';

describe('mergeContentSecurityPolicyHeaders', () => {
  test('preserves Shopify frame ancestors without comma-joining CSP policies', () => {
    const headers = new Headers({
      'Content-Security-Policy':
        'frame-ancestors https://tecompany-dev.myshopify.com https://admin.shopify.com;',
    });

    mergeContentSecurityPolicyHeaders(headers);

    const csp = headers.get('Content-Security-Policy');
    expect(csp).toContain(
      'frame-ancestors https://tecompany-dev.myshopify.com https://admin.shopify.com;',
    );
    expect(csp).toContain("default-src 'self';");
    expect(csp).not.toContain(';, default-src');
  });
});
