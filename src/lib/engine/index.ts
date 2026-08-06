/**
 * The financial engine's public surface.
 *
 * Pure TypeScript: no database, Svelte or Cloudflare imports anywhere under this
 * directory. Everything here is deterministic and unit-tested.
 */
export * from './money';
export * from './currency';
export * from './types';
export * from './net-worth';
export * from './allocation';
export * from './cashflow';
export * from './debt';
export * from './returns';
export * from './risk';
export * from './projection';
export * from './health-score';
export * from './analysis';
export * from './findings';
