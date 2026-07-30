/**
 * Centralized route registration (per the navigation skill: avoid magic
 * route-name strings scattered through the codebase). Every screen a
 * navigator can reach is named here once and typed in `RootStackParamList`.
 */
export const ROUTE_NAMES = {
  LOGIN: 'Login',
} as const;

export type RootStackParamList = {
  [ROUTE_NAMES.LOGIN]: undefined;
};
