import { CASE_BUCKETS } from '@/domain/case';
import { LoggerService } from '@/infrastructure/logger';
import type { Case, CaseBucket, CaseBucketCounts, CaseBucketTransition } from '@/domain/case';

const FILE_NAME = 'case-list-cache.ts';

/** What has been loaded for one case-list tab: its pages so far, and where the next one starts. */
export interface CaseListTab {
  readonly items: readonly Case[];
  /** `null` once the last page is in. */
  readonly nextCursor: string | null;
}

export type CaseListTabGenerations = Readonly<Record<CaseBucket, number>>;

export interface CaseListCacheSnapshot {
  /** Only tabs that have been opened since the last refresh have an entry. */
  readonly tabs: Readonly<Partial<Record<CaseBucket, CaseListTab>>>;
  /** The last `/cases/counts` result, kept in step with local accept/outcome updates; `null` until one arrives. */
  readonly counts: Readonly<CaseBucketCounts> | null;
  /**
   * Bumped whenever a tab's cached page sequence is discarded or superseded. A
   * page request remembers the generation it started against and its result is
   * only stored if that is still current, so a response that lands after a
   * refresh, an accept elsewhere, or a logout can't resurrect stale items.
   */
  readonly tabGenerations: CaseListTabGenerations;
}

type CacheListener = () => void;

function buildGenerations(previous: CaseListTabGenerations | null): CaseListTabGenerations {
  LoggerService.info(`${FILE_NAME}: buildGenerations: starting a fresh generation set`, {
    hasPrevious: previous !== null,
  });
  return {
    new: (previous?.new ?? -1) + 1,
    pending: (previous?.pending ?? -1) + 1,
    beyondTat: (previous?.beyondTat ?? -1) + 1,
    completed: (previous?.completed ?? -1) + 1,
  };
}

/*
 * Memory only, on purpose: list items carry candidate names and addresses, so
 * they never go to MMKV or disk. Module scope (rather than component state) is
 * what lets the cache outlive the case-list screen unmounting; `clear()` on
 * logout is what stops it outliving the session.
 */
let snapshot: CaseListCacheSnapshot = {
  tabs: {},
  counts: null,
  tabGenerations: buildGenerations(null),
};
let countsGeneration = 0;
const listeners = new Set<CacheListener>();

function publish(next: CaseListCacheSnapshot, reason: string): void {
  LoggerService.info(`${FILE_NAME}: publish: cache updated`, {
    reason,
    cachedTabs: Object.keys(next.tabs),
    hasCounts: next.counts !== null,
    listenerCount: listeners.size,
  });
  snapshot = next;
  listeners.forEach((listener) => listener());
}

/** Appends `incoming` to `existing`, skipping any id already present (in either). */
function mergeUniqueById(existing: readonly Case[], incoming: readonly Case[]): Case[] {
  const seenIds = new Set(existing.map((item) => item.id));
  const merged = [...existing];
  incoming.forEach((item) => {
    if (seenIds.has(item.id)) {
      return;
    }
    seenIds.add(item.id);
    merged.push(item);
  });
  LoggerService.info(`${FILE_NAME}: mergeUniqueById: merged page`, {
    existingCount: existing.length,
    incomingCount: incoming.length,
    duplicateCount: existing.length + incoming.length - merged.length,
  });
  return merged;
}

function withoutTabs(
  tabs: CaseListCacheSnapshot['tabs'],
  buckets: readonly CaseBucket[],
): CaseListCacheSnapshot['tabs'] {
  LoggerService.info(`${FILE_NAME}: withoutTabs: dropping tabs`, { buckets });
  const kept: Partial<Record<CaseBucket, CaseListTab>> = {};
  CASE_BUCKETS.forEach((bucket) => {
    const tab = tabs[bucket];
    if (tab !== undefined && !buckets.includes(bucket)) {
      kept[bucket] = tab;
    }
  });
  return kept;
}

function bumpGenerations(
  generations: CaseListTabGenerations,
  buckets: readonly CaseBucket[],
): CaseListTabGenerations {
  LoggerService.info(`${FILE_NAME}: bumpGenerations: superseding requests`, { buckets });
  const next = { ...generations };
  buckets.forEach((bucket) => {
    next[bucket] += 1;
  });
  return next;
}

function getSnapshot(): CaseListCacheSnapshot {
  LoggerService.info(`${FILE_NAME}: getSnapshot: snapshot read`, {
    cachedTabCount: Object.keys(snapshot.tabs).length,
  });
  return snapshot;
}

function subscribe(listener: CacheListener): () => void {
  LoggerService.info(`${FILE_NAME}: subscribe: listener added`, {
    listenerCount: listeners.size + 1,
  });
  listeners.add(listener);
  return () => {
    LoggerService.info(`${FILE_NAME}: subscribe: listener removed`);
    listeners.delete(listener);
  };
}

/**
 * Invalidates any in-flight request for `bucket` while keeping what is cached
 * on screen — a refresh shows the old list until the new first page lands.
 * Returns the generation the superseding request must store against.
 */
function supersedeTabRequests(bucket: CaseBucket): number {
  LoggerService.info(`${FILE_NAME}: supersedeTabRequests: superseding`, { bucket });
  const tabGenerations = bumpGenerations(snapshot.tabGenerations, [bucket]);
  publish({ ...snapshot, tabGenerations }, 'supersedeTabRequests');
  return tabGenerations[bucket];
}

/** Replaces the tab with its first page. Returns false (and stores nothing) for a superseded request. */
function storeFirstPage(bucket: CaseBucket, generation: number, page: CaseListTab): boolean {
  if (generation !== snapshot.tabGenerations[bucket]) {
    LoggerService.warn(`${FILE_NAME}: storeFirstPage: superseded response dropped`, {
      bucket,
      generation,
      currentGeneration: snapshot.tabGenerations[bucket],
    });
    return false;
  }
  const tab: CaseListTab = { items: mergeUniqueById([], page.items), nextCursor: page.nextCursor };
  LoggerService.info(`${FILE_NAME}: storeFirstPage: storing`, {
    bucket,
    count: tab.items.length,
    hasNextPage: tab.nextCursor !== null,
  });
  publish({ ...snapshot, tabs: { ...snapshot.tabs, [bucket]: tab } }, 'storeFirstPage');
  return true;
}

/** Appends a next page, de-duplicating by id. Returns false (and stores nothing) for a superseded request. */
function appendNextPage(bucket: CaseBucket, generation: number, page: CaseListTab): boolean {
  const existing = snapshot.tabs[bucket];
  if (generation !== snapshot.tabGenerations[bucket] || existing === undefined) {
    LoggerService.warn(`${FILE_NAME}: appendNextPage: superseded response dropped`, {
      bucket,
      generation,
      currentGeneration: snapshot.tabGenerations[bucket],
      isTabCached: existing !== undefined,
    });
    return false;
  }
  const tab: CaseListTab = {
    items: mergeUniqueById(existing.items, page.items),
    nextCursor: page.nextCursor,
  };
  LoggerService.info(`${FILE_NAME}: appendNextPage: appending`, {
    bucket,
    count: tab.items.length,
    hasNextPage: tab.nextCursor !== null,
  });
  publish({ ...snapshot, tabs: { ...snapshot.tabs, [bucket]: tab } }, 'appendNextPage');
  return true;
}

/** Starts a counts request; any counts response still in flight is superseded by it. */
function supersedeCountsRequests(): number {
  countsGeneration += 1;
  LoggerService.info(`${FILE_NAME}: supersedeCountsRequests: superseding`, { countsGeneration });
  return countsGeneration;
}

function storeCounts(generation: number, counts: CaseBucketCounts): boolean {
  if (generation !== countsGeneration) {
    LoggerService.warn(`${FILE_NAME}: storeCounts: superseded response dropped`, {
      generation,
      countsGeneration,
    });
    return false;
  }
  LoggerService.info(`${FILE_NAME}: storeCounts: storing`, { ...counts });
  publish({ ...snapshot, counts: { ...counts } }, 'storeCounts');
  return true;
}

/** Drops the tabs' items and supersedes their in-flight requests, so each re-fetches when next opened. */
function discardTabs(buckets: readonly CaseBucket[], reason: string): void {
  LoggerService.info(`${FILE_NAME}: discardTabs: discarding`, { buckets, reason });
  publish(
    {
      ...snapshot,
      tabs: withoutTabs(snapshot.tabs, buckets),
      tabGenerations: bumpGenerations(snapshot.tabGenerations, buckets),
    },
    reason,
  );
}

/** Refresh: every tab but the one being refreshed re-fetches the next time it is opened. */
function discardTabsExcept(keptBucket: CaseBucket): void {
  LoggerService.info(`${FILE_NAME}: discardTabsExcept: keeping one tab`, { keptBucket });
  discardTabs(
    CASE_BUCKETS.filter((bucket) => bucket !== keptBucket),
    'discardTabsExcept',
  );
}

/** Used when it is unknown which tabs a change touched. Counts are left alone. */
function discardAllTabs(): void {
  LoggerService.info(`${FILE_NAME}: discardAllTabs: discarding every tab`);
  discardTabs(CASE_BUCKETS, 'discardAllTabs');
}

/**
 * A component moved buckets on the server (accepted, or its outcome
 * submitted): drop it from the tab it left and discard the tab it entered —
 * it arrives there with a fresh `updated_at`, so it sits on that tab's first
 * page and the next open re-fetches it. Counts follow the move.
 */
function applyCaseTransition(caseId: string, transition: CaseBucketTransition): void {
  LoggerService.info(`${FILE_NAME}: applyCaseTransition: applying`, {
    caseId,
    from: transition.from,
    to: transition.to,
  });
  if (transition.from === transition.to) {
    LoggerService.warn(`${FILE_NAME}: applyCaseTransition: no-op transition — tab discarded only`, {
      caseId,
      bucket: transition.to,
    });
    discardTabs([transition.to], 'applyCaseTransition');
    return;
  }
  const source = snapshot.tabs[transition.from];
  const tabs = withoutTabs(snapshot.tabs, [transition.to]);
  const nextTabs =
    source === undefined
      ? tabs
      : {
          ...tabs,
          [transition.from]: {
            items: source.items.filter((item) => item.id !== caseId),
            nextCursor: source.nextCursor,
          },
        };
  const counts =
    snapshot.counts === null
      ? null
      : {
          ...snapshot.counts,
          [transition.from]: Math.max(0, snapshot.counts[transition.from] - 1),
          [transition.to]: snapshot.counts[transition.to] + 1,
        };
  LoggerService.info(`${FILE_NAME}: applyCaseTransition: resolved`, {
    caseId,
    wasSourceCached: source !== undefined,
    sourceCount: nextTabs[transition.from]?.items.length ?? null,
    hasCounts: counts !== null,
  });
  publish(
    {
      tabs: nextTabs,
      counts,
      tabGenerations: bumpGenerations(snapshot.tabGenerations, [transition.to]),
    },
    'applyCaseTransition',
  );
}

/** Logout: drops every tab and the counts, and supersedes anything still in flight. */
function clear(): void {
  LoggerService.info(`${FILE_NAME}: clear: clearing the case-list cache`, {
    cachedTabs: Object.keys(snapshot.tabs),
    hasCounts: snapshot.counts !== null,
  });
  countsGeneration += 1;
  publish(
    { tabs: {}, counts: null, tabGenerations: buildGenerations(snapshot.tabGenerations) },
    'clear',
  );
}

export interface ICaseListCache {
  getSnapshot(): CaseListCacheSnapshot;
  subscribe(listener: CacheListener): () => void;
  supersedeTabRequests(bucket: CaseBucket): number;
  storeFirstPage(bucket: CaseBucket, generation: number, page: CaseListTab): boolean;
  appendNextPage(bucket: CaseBucket, generation: number, page: CaseListTab): boolean;
  supersedeCountsRequests(): number;
  storeCounts(generation: number, counts: CaseBucketCounts): boolean;
  discardTabsExcept(keptBucket: CaseBucket): void;
  discardAllTabs(): void;
  applyCaseTransition(caseId: string, transition: CaseBucketTransition): void;
  clear(): void;
}

/**
 * The case list's per-tab pages and tab counts for the current session. A
 * feature-level service rather than a Zustand store: business entities don't
 * belong in the app-wide stores, and the hooks read it through
 * `useSyncExternalStore` so a change made from Case Details shows on the list
 * as soon as the field executive navigates back.
 */
export const CaseListCache: ICaseListCache = {
  getSnapshot,
  subscribe,
  supersedeTabRequests,
  storeFirstPage,
  appendNextPage,
  supersedeCountsRequests,
  storeCounts,
  discardTabsExcept,
  discardAllTabs,
  applyCaseTransition,
  clear,
};
