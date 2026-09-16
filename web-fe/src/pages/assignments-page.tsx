import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert } from '../components/alert';
import { AssignmentFilterBar } from '../components/assignment-filter-bar';
import { AssignmentList } from '../components/assignment-list';
import { Spinner } from '../components/spinner';
import { useAssignmentStore } from '../stores/assignment-store';
import type { AssignmentFilter } from '../types/assignment';
import {
  countAssignments,
  filterAssignments,
  flattenAssignmentGroups,
  isAssignmentBucket,
} from '../utils/assignment-filters';
import { useDocumentTitle } from '../utils/use-document-title';

export function AssignmentsPage() {
  useDocumentTitle('Assignments');
  const [searchParams, setSearchParams] = useSearchParams();

  const groups = useAssignmentStore((state) => state.groups);
  const filter = useAssignmentStore((state) => state.filter);
  const listStatus = useAssignmentStore((state) => state.listStatus);
  const listError = useAssignmentStore((state) => state.listError);
  const listLoadedAt = useAssignmentStore((state) => state.listLoadedAt);
  const fetchAssignments = useAssignmentStore((state) => state.fetchAssignments);
  const setFilter = useAssignmentStore((state) => state.setFilter);

  useEffect(() => {
    void fetchAssignments();
  }, [fetchAssignments]);

  // `?bucket=` (e.g. from a dashboard card) is the entry point for the category filter.
  const bucketParam = searchParams.get('bucket');
  useEffect(() => {
    setFilter({ bucket: isAssignmentBucket(bucketParam) ? bucketParam : 'all' });
  }, [bucketParam, setFilter]);

  const counts = useMemo(() => countAssignments(groups), [groups]);
  const visible = useMemo(() => filterAssignments(flattenAssignmentGroups(groups), filter), [groups, filter]);

  const changeFilter = (changes: Partial<AssignmentFilter>): void => {
    setFilter(changes);
    if (changes.bucket !== undefined) {
      const nextParams = new URLSearchParams(searchParams);
      if (changes.bucket === 'all') {
        nextParams.delete('bucket');
      } else {
        nextParams.set('bucket', changes.bucket);
      }
      setSearchParams(nextParams, { replace: true });
    }
  };

  const hasData = listLoadedAt !== null;
  const isFiltered = filter.bucket !== 'all' || filter.query.trim() !== '';

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assignments</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Cases assigned to you. New cases are claimed in the mobile app.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void fetchAssignments()}
          disabled={listStatus === 'loading'}
        >
          {listStatus === 'loading' ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {listStatus === 'error' && listError ? (
        <Alert
          variant="error"
          action={
            <button type="button" className="btn-secondary" onClick={() => void fetchAssignments()}>
              Retry
            </button>
          }
        >
          {listError}
        </Alert>
      ) : null}

      {!hasData && listStatus === 'loading' ? (
        <Spinner label="Loading your assignments…" />
      ) : hasData ? (
        <>
          <AssignmentFilterBar filter={filter} counts={counts} onChange={changeFilter} />
          <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
            Showing {visible.length} {visible.length === 1 ? 'assignment' : 'assignments'}
          </p>
          <AssignmentList
            assignments={visible}
            emptyMessage={isFiltered ? 'No assignments match these filters.' : 'You have no assignments.'}
          />
        </>
      ) : null}
    </div>
  );
}
