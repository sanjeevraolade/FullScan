import { resolveAcceptTransition, resolveVerificationOutcomeTransition } from '@/domain/case';
import type { Case, CaseBucket } from '@/domain/case';

import { CaseListCache } from './case-list-cache';

function buildCase(id: string): Case {
  return {
    id,
    checkId: id,
    caseRef: `FS-${id}`,
    clientName: 'ABC Pvt Ltd',
    candidateName: 'Rahul Sharma',
    verificationType: 'Address',
    address: 'Flat 204, Madhapur, Hyderabad',
    updatedAt: new Date('2026-10-04T09:15:02.000Z'),
  };
}

function storeTab(bucket: CaseBucket, ids: string[], nextCursor: string | null): void {
  const generation = CaseListCache.getSnapshot().tabGenerations[bucket];
  CaseListCache.storeFirstPage(bucket, generation, { items: ids.map(buildCase), nextCursor });
}

function readTabIds(bucket: CaseBucket): string[] | null {
  return CaseListCache.getSnapshot().tabs[bucket]?.items.map((item) => item.id) ?? null;
}

const COUNTS = { new: 3, pending: 10, beyondTat: 4, completed: 2 };

describe('CaseListCache', () => {
  beforeEach(() => {
    CaseListCache.clear();
  });

  afterEach(() => {
    CaseListCache.clear();
  });

  it('starts empty, with no counts', () => {
    expect(CaseListCache.getSnapshot().tabs).toEqual({});
    expect(CaseListCache.getSnapshot().counts).toBeNull();
  });

  it('appends next pages, de-duplicating by id', () => {
    storeTab('pending', ['a', 'b'], 'cursor-1');
    const { tabGenerations } = CaseListCache.getSnapshot();

    const isStored = CaseListCache.appendNextPage('pending', tabGenerations.pending, {
      items: [buildCase('b'), buildCase('c'), buildCase('c')],
      nextCursor: null,
    });

    expect(isStored).toBe(true);
    expect(readTabIds('pending')).toEqual(['a', 'b', 'c']);
    expect(CaseListCache.getSnapshot().tabs.pending?.nextCursor).toBeNull();
  });

  it('drops a response for a superseded request', () => {
    storeTab('pending', ['a'], 'cursor-1');
    const staleGeneration = CaseListCache.getSnapshot().tabGenerations.pending;

    const refreshGeneration = CaseListCache.supersedeTabRequests('pending');

    expect(refreshGeneration).not.toBe(staleGeneration);
    // The old list stays on screen while the refresh is in flight.
    expect(readTabIds('pending')).toEqual(['a']);
    expect(
      CaseListCache.appendNextPage('pending', staleGeneration, {
        items: [buildCase('b')],
        nextCursor: null,
      }),
    ).toBe(false);
    expect(readTabIds('pending')).toEqual(['a']);
    expect(
      CaseListCache.storeFirstPage('pending', refreshGeneration, {
        items: [buildCase('z')],
        nextCursor: null,
      }),
    ).toBe(true);
    expect(readTabIds('pending')).toEqual(['z']);
  });

  it('discards every other tab on refresh, keeping the refreshed one and the counts', () => {
    storeTab('new', ['n1'], null);
    storeTab('pending', ['p1'], 'cursor-1');
    storeTab('completed', ['c1'], null);
    CaseListCache.storeCounts(CaseListCache.supersedeCountsRequests(), COUNTS);

    CaseListCache.discardTabsExcept('pending');

    expect(Object.keys(CaseListCache.getSnapshot().tabs)).toEqual(['pending']);
    expect(CaseListCache.getSnapshot().counts).toEqual(COUNTS);
  });

  it('keeps only the latest counts response', () => {
    const firstGeneration = CaseListCache.supersedeCountsRequests();
    const secondGeneration = CaseListCache.supersedeCountsRequests();

    expect(CaseListCache.storeCounts(secondGeneration, COUNTS)).toBe(true);
    expect(CaseListCache.storeCounts(firstGeneration, { ...COUNTS, new: 99 })).toBe(false);
    expect(CaseListCache.getSnapshot().counts).toEqual(COUNTS);
  });

  it('applies an accept: out of New, Pending discarded, counts moved', () => {
    storeTab('new', ['n1', 'n2'], null);
    storeTab('pending', ['p1'], 'cursor-1');
    CaseListCache.storeCounts(CaseListCache.supersedeCountsRequests(), COUNTS);

    CaseListCache.applyCaseTransition('n1', resolveAcceptTransition());

    expect(readTabIds('new')).toEqual(['n2']);
    expect(readTabIds('pending')).toBeNull();
    expect(CaseListCache.getSnapshot().counts).toEqual({ ...COUNTS, new: 2, pending: 11 });
  });

  it('applies an outcome: out of its own tab, Completed discarded, counts moved', () => {
    storeTab('beyondTat', ['t1', 't2'], 'cursor-1');
    storeTab('completed', ['c1'], null);
    CaseListCache.storeCounts(CaseListCache.supersedeCountsRequests(), COUNTS);

    CaseListCache.applyCaseTransition('t2', resolveVerificationOutcomeTransition('beyondTat'));

    expect(readTabIds('beyondTat')).toEqual(['t1']);
    expect(CaseListCache.getSnapshot().tabs.beyondTat?.nextCursor).toBe('cursor-1');
    expect(readTabIds('completed')).toBeNull();
    expect(CaseListCache.getSnapshot().counts).toEqual({ ...COUNTS, beyondTat: 3, completed: 3 });
  });

  it('never takes a count below zero and leaves absent counts absent', () => {
    CaseListCache.applyCaseTransition('n1', resolveAcceptTransition());
    expect(CaseListCache.getSnapshot().counts).toBeNull();

    CaseListCache.storeCounts(CaseListCache.supersedeCountsRequests(), { ...COUNTS, new: 0 });
    CaseListCache.applyCaseTransition('n1', resolveAcceptTransition());

    expect(CaseListCache.getSnapshot().counts?.new).toBe(0);
    expect(CaseListCache.getSnapshot().counts?.pending).toBe(11);
  });

  it('supersedes a request for the tab a transition discards', () => {
    const pendingGeneration = CaseListCache.getSnapshot().tabGenerations.pending;

    CaseListCache.applyCaseTransition('n1', resolveAcceptTransition());

    expect(
      CaseListCache.storeFirstPage('pending', pendingGeneration, {
        items: [buildCase('p1')],
        nextCursor: null,
      }),
    ).toBe(false);
    expect(readTabIds('pending')).toBeNull();
  });

  it('clears everything on logout and drops anything still in flight', () => {
    storeTab('new', ['n1'], null);
    const newGeneration = CaseListCache.getSnapshot().tabGenerations.new;
    const countsGeneration = CaseListCache.supersedeCountsRequests();

    CaseListCache.clear();

    expect(CaseListCache.getSnapshot().tabs).toEqual({});
    expect(CaseListCache.getSnapshot().counts).toBeNull();
    expect(
      CaseListCache.storeFirstPage('new', newGeneration, {
        items: [buildCase('n2')],
        nextCursor: null,
      }),
    ).toBe(false);
    expect(CaseListCache.storeCounts(countsGeneration, COUNTS)).toBe(false);
    expect(CaseListCache.getSnapshot().tabs).toEqual({});
    expect(CaseListCache.getSnapshot().counts).toBeNull();
  });

  it('notifies subscribers of every change until they unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = CaseListCache.subscribe(listener);

    storeTab('new', ['n1'], null);
    CaseListCache.discardAllTabs();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    storeTab('new', ['n1'], null);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
