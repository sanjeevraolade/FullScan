/**
 * Centralized route registration (per the navigation skill: avoid magic
 * route-name strings scattered through the codebase). Route names are the
 * same `screenId`s the Configuration Engine already uses, so a screen keeps
 * one identity end-to-end instead of a separate navigation alias.
 */
export const ROUTE_NAMES = {
  LOGIN: 'login',
} as const;

export type RootStackParamList = {
  [ROUTE_NAMES.LOGIN]: undefined;
};
