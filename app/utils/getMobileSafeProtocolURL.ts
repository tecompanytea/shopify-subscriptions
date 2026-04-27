export function getMobileSafeProtocolURL(path: string) {
  // App Bridge injects `shopify` as a global; in non-admin / test contexts
  // it may not be defined, so fall back to the original path.
  const bridge = (globalThis as any).shopify as
    | {config?: {host?: string}; environment?: {mobile?: boolean}}
    | undefined;
  const host = bridge?.config?.host ? atob(bridge.config.host) : null;
  const mobile = bridge?.environment?.mobile;

  if (host && mobile) {
    return path.replace(/shopify:\/*admin/, `https://${host}`);
  }

  return path;
}
