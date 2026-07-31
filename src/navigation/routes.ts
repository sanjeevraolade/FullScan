/**
 * Centralized route registration (per the navigation skill: avoid magic
 * route-name strings scattered through the codebase). Every screen a
 * navigator can reach is named here once and typed in `RootStackParamList`.
 */
export const ROUTE_NAMES = {
  LOGIN: 'Login',
  CASE_LIST: 'CaseList',
  CASE_DETAILS: 'CaseDetails',
} as const;

/**
 * Display fields carried over from the already-fetched case list so the
 * details placeholder can render immediately, without a second network
 * round-trip. Once the real Case Details screen is built (fetching the full
 * case + verification workflow by id), this shrinks to `{ caseId: string }`.
 */
export interface CaseDetailsRouteParams {
  readonly caseId: string;
  readonly caseRef: string;
  readonly candidateName: string;
  readonly clientName: string;
}

export type RootStackParamList = {
  [ROUTE_NAMES.LOGIN]: undefined;
  [ROUTE_NAMES.CASE_LIST]: undefined;
  [ROUTE_NAMES.CASE_DETAILS]: CaseDetailsRouteParams;
};
