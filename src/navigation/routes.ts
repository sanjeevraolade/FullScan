/**
 * Centralized route registration (per the navigation skill: avoid magic
 * route-name strings scattered through the codebase). Every screen a
 * navigator can reach is named here once and typed in `RootStackParamList`.
 */
export const ROUTE_NAMES = {
  LOGIN: 'Login',
  MAIN: 'Main',
  CASE_LIST: 'CaseList',
  CASE_DETAILS: 'CaseDetails',
} as const;

export interface CaseDetailsRouteParams {
  readonly caseId: string;
}

export type RootStackParamList = {
  [ROUTE_NAMES.LOGIN]: undefined;
  [ROUTE_NAMES.MAIN]: undefined;
  [ROUTE_NAMES.CASE_DETAILS]: CaseDetailsRouteParams;
};

/** Screens reachable from the drawer, nested under the root stack's Main route. */
export type DrawerParamList = {
  [ROUTE_NAMES.CASE_LIST]: undefined;
};
