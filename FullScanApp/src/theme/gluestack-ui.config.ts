import { config } from '@gluestack-ui/config';

/**
 * Single import point for the Gluestack UI config used across FullScan.
 * Customer branding / white-label token overrides
 * (docs/06-Contracts/01-Configuration-Schema.md §14) will extend this config
 * via `config.extend(...)` once theme configuration is consumed from the
 * backend Configuration Package — not implemented in this Runtime Engine
 * core pass.
 */
export const fullScanGluestackConfig = config;
