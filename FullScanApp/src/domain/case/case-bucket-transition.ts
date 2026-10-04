import { LoggerService } from '@/infrastructure/logger';

import type { CaseBucket } from './case.entity';

const FILE_NAME = 'case-bucket-transition.ts';

/** A case component leaving one workflow bucket for another as the result of a field executive's action. */
export interface CaseBucketTransition {
  readonly from: CaseBucket;
  readonly to: CaseBucket;
}

/** Accepting claims a New component, which moves it to Pending/In Progress. */
export function resolveAcceptTransition(): CaseBucketTransition {
  const transition: CaseBucketTransition = { from: 'new', to: 'pending' };
  LoggerService.info(`${FILE_NAME}: resolveAcceptTransition: resolved`, {
    from: transition.from,
    to: transition.to,
  });
  return transition;
}

/** Submitting a verification outcome closes the component from whichever bucket it was worked in. */
export function resolveVerificationOutcomeTransition(
  currentBucket: CaseBucket,
): CaseBucketTransition {
  const transition: CaseBucketTransition = { from: currentBucket, to: 'completed' };
  LoggerService.info(`${FILE_NAME}: resolveVerificationOutcomeTransition: resolved`, {
    from: transition.from,
    to: transition.to,
  });
  return transition;
}
