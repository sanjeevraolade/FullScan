import type { CaseEvidence } from './case-evidence.types.js';

/**
 * Evidence lists as the FE web portal and the back office see them. Both include web
 * uploads and mobile captures; the record shape itself is in `case-evidence.types.ts`.
 */

/** One evidence record as the web app sees it — web uploads and mobile captures alike. */
export type FeWebEvidence = CaseEvidence;

export interface FeWebEvidenceList {
  readonly componentId: string;
  /** Newest first. */
  readonly evidence: readonly FeWebEvidence[];
}

/** Evidence as the back office sees it: the FE view plus who uploaded it. */
export type AdminCaseEvidence = CaseEvidence & {
  readonly uploadedBy: { readonly id: string; readonly name: string; readonly username: string };
};

export interface AdminCaseEvidenceList {
  readonly caseId: string;
  /** Every component's evidence (web uploads and mobile captures), newest first. */
  readonly evidence: readonly AdminCaseEvidence[];
}
