/**
 * Ambient module declarations for static image assets. Metro resolves
 * `require('*.png')` (and picks up `@2x`/`@3x` density variants
 * automatically) to a numeric asset id at runtime — these declarations only
 * make that shape visible to the TypeScript compiler, which otherwise has no
 * loader for non-JS/TS imports under `strict` mode.
 */
declare module '*.png' {
  const assetSource: number;
  export default assetSource;
}

declare module '*.jpg' {
  const assetSource: number;
  export default assetSource;
}

declare module '*.jpeg' {
  const assetSource: number;
  export default assetSource;
}
