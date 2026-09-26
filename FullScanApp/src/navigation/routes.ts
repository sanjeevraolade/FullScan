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
  CASE_CAMERA: 'CaseCamera',
  CASE_PHOTO_VIEWER: 'CasePhotoViewer',
} as const;

/** Captured-photo shape carried through navigation params — must stay JSON-serializable. */
export interface SerializedCapturedPhotoEvidence {
  readonly filePath: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  readonly isMockLocation: boolean;
  readonly capturedAtIso: string;
  readonly documentTypeCode: string;
}

export interface CaseDetailsRouteParams {
  readonly caseId: string;
  /**
   * The full, current set of captured evidence photos for this case —
   * always the complete list, never a delta. `CaseDetailsScreen` treats this
   * as its source of truth for captured photos (no separate local copy), and
   * hands it to `CaseCamera` (as `existingPhotos`) so a round trip through
   * the camera can merge its new captures back in and return the complete
   * set again. This avoids depending on `CaseDetailsScreen` staying the same
   * mounted instance across the round trip.
   */
  readonly capturedPhotos?: readonly SerializedCapturedPhotoEvidence[];
}

export interface CaseCameraRouteParams {
  readonly caseId: string;
  readonly photoTagCode: string;
  /** The case's captured photos as of opening the camera — merged with this session's captures on "Done". */
  readonly existingPhotos: readonly SerializedCapturedPhotoEvidence[];
}

export type CasePhotoViewerRouteParams = SerializedCapturedPhotoEvidence & {
  readonly documentTypeLabel: string;
};

export type RootStackParamList = {
  [ROUTE_NAMES.LOGIN]: undefined;
  [ROUTE_NAMES.MAIN]: undefined;
  [ROUTE_NAMES.CASE_DETAILS]: CaseDetailsRouteParams;
  [ROUTE_NAMES.CASE_CAMERA]: CaseCameraRouteParams;
  [ROUTE_NAMES.CASE_PHOTO_VIEWER]: CasePhotoViewerRouteParams;
};

/** Screens reachable from the drawer, nested under the root stack's Main route. */
export type DrawerParamList = {
  [ROUTE_NAMES.CASE_LIST]: undefined;
};
