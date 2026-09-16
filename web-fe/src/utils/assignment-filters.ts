import type {
  Assignment,
  AssignmentBucket,
  AssignmentFilter,
  AssignmentGroup,
} from '../types/assignment';
import { parseWallClock } from './format';

const HOUR_MS = 60 * 60 * 1000;

/** Flattens the server's groups, tagging each assignment with its bucket. */
export function flattenAssignmentGroups(groups: readonly AssignmentGroup[]): Assignment[] {
  return groups.flatMap((group) => group.cases.map((entry) => ({ ...entry, bucket: group.bucket })));
}

export function filterAssignments(assignments: readonly Assignment[], filter: AssignmentFilter): Assignment[] {
  const terms = filter.query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  return assignments.filter((assignment) => {
    if (filter.bucket !== 'all' && assignment.bucket !== filter.bucket) {
      return false;
    }
    if (terms.length === 0) {
      return true;
    }

    const haystack = [
      assignment.caseRef,
      assignment.candidateName,
      assignment.clientName,
      assignment.verificationType,
      assignment.address,
      assignment.componentStatusLabel,
    ]
      .join(' ')
      .toLowerCase();

    return terms.every((term) => haystack.includes(term));
  });
}

export type AssignmentCounts = Readonly<Record<AssignmentBucket, number>>;

export function countAssignments(groups: readonly AssignmentGroup[]): AssignmentCounts {
  const counts: Record<AssignmentBucket, number> = { pending: 0, beyond_tat: 0, completed: 0 };
  for (const group of groups) {
    counts[group.bucket] = group.caseCount;
  }
  return counts;
}

/** Pending work whose TAT falls within the next `withinHours`. */
export function findDueSoon(assignments: readonly Assignment[], now: Date, withinHours = 24): Assignment[] {
  const start = now.getTime();
  const horizon = start + withinHours * HOUR_MS;

  return assignments.filter((assignment) => {
    if (assignment.bucket !== 'pending') {
      return false;
    }
    const dueAt = parseWallClock(assignment.tatDueAt)?.getTime();
    return dueAt !== undefined && dueAt >= start && dueAt <= horizon;
  });
}

/** Beyond TAT first, then Pending by soonest TAT — what the executive should look at next. */
export function findNeedsAttention(assignments: readonly Assignment[], limit = 5): Assignment[] {
  const rank = (assignment: Assignment): number => (assignment.bucket === 'beyond_tat' ? 0 : 1);

  return assignments
    .filter((assignment) => assignment.bucket !== 'completed')
    .sort((left, right) => rank(left) - rank(right) || left.tatDueAt.localeCompare(right.tatDueAt))
    .slice(0, limit);
}

export function isAssignmentBucket(value: string | null): value is AssignmentBucket {
  return value === 'pending' || value === 'beyond_tat' || value === 'completed';
}
