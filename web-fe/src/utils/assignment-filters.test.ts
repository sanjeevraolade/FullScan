import { describe, expect, it } from 'vitest';
import type { AssignmentGroup, AssignmentSummary } from '../types/assignment';
import {
  countAssignments,
  filterAssignments,
  findDueSoon,
  findNeedsAttention,
  flattenAssignmentGroups,
} from './assignment-filters';

function summary(componentId: string, overrides: Partial<AssignmentSummary> = {}): AssignmentSummary {
  return {
    componentId,
    caseId: `case-${componentId}`,
    caseRef: `FS-${componentId}`,
    clientName: 'Acme Corp',
    candidateName: 'Meera Joshi',
    verificationType: 'Address',
    addressType: 'present',
    address: 'Chanda Nagar, Hyderabad',
    componentStatus: 'new_component',
    componentStatusLabel: 'New Component',
    tatDueAt: '2026-09-20 18:00:00',
    updatedAt: '2026-09-10 10:00:00',
    ...overrides,
  };
}

const groups: AssignmentGroup[] = [
  {
    bucket: 'pending',
    caseCount: 2,
    cases: [
      summary('p1', { tatDueAt: '2026-09-17 09:00:00', candidateName: 'Ravi Kumar' }),
      summary('p2', { tatDueAt: '2026-09-25 09:00:00', address: 'Nizampet, Hyderabad' }),
    ],
  },
  { bucket: 'beyond_tat', caseCount: 1, cases: [summary('b1', { tatDueAt: '2026-09-01 09:00:00' })] },
  { bucket: 'completed', caseCount: 1, cases: [summary('c1')] },
];

describe('assignment filters', () => {
  const assignments = flattenAssignmentGroups(groups);

  it('tags every assignment with its bucket', () => {
    expect(assignments.map((entry) => [entry.componentId, entry.bucket])).toEqual([
      ['p1', 'pending'],
      ['p2', 'pending'],
      ['b1', 'beyond_tat'],
      ['c1', 'completed'],
    ]);
  });

  it('counts per bucket from the server totals', () => {
    expect(countAssignments(groups)).toEqual({ pending: 2, beyond_tat: 1, completed: 1 });
  });

  it('filters by bucket and by every search term, case-insensitively', () => {
    expect(filterAssignments(assignments, { bucket: 'pending', query: '' }).map((entry) => entry.componentId)).toEqual([
      'p1',
      'p2',
    ]);
    expect(filterAssignments(assignments, { bucket: 'all', query: 'RAVI hyderabad' }).map((entry) => entry.componentId)).toEqual([
      'p1',
    ]);
    expect(filterAssignments(assignments, { bucket: 'all', query: 'nizampet' }).map((entry) => entry.componentId)).toEqual([
      'p2',
    ]);
    expect(filterAssignments(assignments, { bucket: 'completed', query: 'ravi' })).toEqual([]);
  });

  it('finds pending work due within 24 hours', () => {
    const now = new Date(2026, 8, 16, 12, 0, 0);

    expect(findDueSoon(assignments, now).map((entry) => entry.componentId)).toEqual(['p1']);
  });

  it('puts Beyond TAT first, then Pending by soonest TAT, and skips Completed', () => {
    expect(findNeedsAttention(assignments).map((entry) => entry.componentId)).toEqual(['b1', 'p1', 'p2']);
  });
});
