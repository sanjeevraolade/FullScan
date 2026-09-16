import { useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CASE_PAGE_SIZE } from '../api/cases-api';
import { Alert } from '../components/alert';
import { BucketBadge } from '../components/badges';
import { FilterTabs } from '../components/filter-tabs';
import { PageHeader } from '../components/page-header';
import { Pagination } from '../components/pagination';
import { Spinner } from '../components/spinner';
import { useCaseListStore } from '../stores/case-list-store';
import { useReferenceStore } from '../stores/reference-store';
import { CASE_BUCKETS, type CaseBucketFilter } from '../types/cases';
import { formatUtcTimestamp } from '../utils/format';
import { ADDRESS_TYPE_LABELS, BUCKET_LABELS, labelFor, labelForCode } from '../utils/labels';
import { useDebouncedValue } from '../utils/use-debounced-value';

export function CasesPage() {
  const searchId = useId();
  const executiveId = useId();
  const navigate = useNavigate();

  const filter = useCaseListStore((state) => state.filter);
  const result = useCaseListStore((state) => state.result);
  const status = useCaseListStore((state) => state.status);
  const error = useCaseListStore((state) => state.error);
  const setFilter = useCaseListStore((state) => state.setFilter);
  const fetchCases = useCaseListStore((state) => state.fetchCases);

  const formOptions = useReferenceStore((state) => state.formOptions);
  const fieldExecutives = useReferenceStore((state) => state.fieldExecutives);
  const referenceError = useReferenceStore((state) => state.error);
  const ensureReference = useReferenceStore((state) => state.ensureLoaded);

  const [searchText, setSearchText] = useState(filter.search);
  const debouncedSearch = useDebouncedValue(searchText);

  useEffect(() => {
    void ensureReference();
  }, [ensureReference]);

  useEffect(() => {
    if (debouncedSearch.trim() !== filter.search) {
      setFilter({ search: debouncedSearch.trim() });
    }
  }, [debouncedSearch, filter.search, setFilter]);

  useEffect(() => {
    void fetchCases();
  }, [filter, fetchCases]);

  const categories = result?.categories ?? [];
  const total = categories.reduce((sum, category) => sum + category.count, 0);
  const countFor = (bucket: CaseBucketFilter): number =>
    bucket === 'all' ? total : (categories.find((category) => category.bucket === bucket)?.count ?? 0);

  const openCase = (caseId: string): void => {
    void navigate(`/cases/${encodeURIComponent(caseId)}`);
  };

  return (
    <>
      <PageHeader
        title="Cases"
        subtitle="Every case in the system, by workflow category — create new ones and edit existing ones."
        actions={
          <Link to="/cases/new" className="btn-primary">
            New case
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4">
        {referenceError ? <Alert variant="error">{referenceError}</Alert> : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div>
            <label htmlFor={searchId} className="sr-only">
              Search cases
            </label>
            <input
              id={searchId}
              type="search"
              className="input"
              placeholder="Search case ref, candidate, client or address"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor={executiveId} className="sr-only">
              Filter by field executive
            </label>
            <select
              id={executiveId}
              className="select"
              value={filter.fieldExecutiveId}
              onChange={(event) => setFilter({ fieldExecutiveId: event.target.value })}
            >
              <option value="">All field executives</option>
              {fieldExecutives.map((executive) => (
                <option key={executive.id} value={executive.id}>
                  {executive.name} ({executive.username})
                </option>
              ))}
            </select>
          </div>
        </div>

        <FilterTabs<CaseBucketFilter>
          label="Case category"
          selected={filter.bucket}
          onSelect={(bucket) => setFilter({ bucket })}
          tabs={[
            { value: 'all', label: 'All', count: countFor('all') },
            ...CASE_BUCKETS.map((bucket) => ({ value: bucket, label: BUCKET_LABELS[bucket], count: countFor(bucket) })),
          ]}
        />

        {status === 'error' && error ? (
          <Alert
            variant="error"
            action={
              <button type="button" className="btn-secondary" onClick={() => void fetchCases()}>
                Retry
              </button>
            }
          >
            {error}
          </Alert>
        ) : null}

        {!result && status === 'loading' ? <Spinner label="Loading cases…" /> : null}

        {result ? (
          result.items.length === 0 ? (
            <p className="card px-4 py-10 text-center text-sm text-slate-500">No cases match these filters.</p>
          ) : (
            <div aria-busy={status === 'loading'}>
              <div className="table-frame">
                <table className="data-table">
                  <caption className="sr-only">Case components. Select a case reference to open the case.</caption>
                  <thead>
                    <tr>
                      <th scope="col">Case</th>
                      <th scope="col">Candidate</th>
                      <th scope="col">Component</th>
                      <th scope="col">Address</th>
                      <th scope="col">Assigned to</th>
                      <th scope="col">Category</th>
                      <th scope="col">Status</th>
                      <th scope="col">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((item) => (
                      <tr
                        key={item.id}
                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        onClick={() => openCase(item.caseId)}
                      >
                        <td>
                          <Link
                            to={`/cases/${encodeURIComponent(item.caseId)}`}
                            className="cell-strong text-brand-600 hover:underline dark:text-brand-100"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {item.caseRef}
                          </Link>
                          <span className="cell-muted">{item.clientName}</span>
                        </td>
                        <td>{item.candidateName}</td>
                        <td>
                          <span className="block">{item.verificationType}</span>
                          {item.addressType ? (
                            <span className="cell-muted">{labelFor(ADDRESS_TYPE_LABELS, item.addressType)}</span>
                          ) : null}
                        </td>
                        <td className="max-w-xs">{item.address}</td>
                        <td>{item.assignedFieldExecutiveName || item.assignedToName || 'Unassigned'}</td>
                        <td>
                          <BucketBadge bucket={item.bucket} />
                        </td>
                        <td>{formOptions ? labelForCode(formOptions.componentStatuses, item.componentStatus) : item.componentStatus}</td>
                        <td className="whitespace-nowrap">
                          <span className="cell-muted">{formatUtcTimestamp(item.updatedAt)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                offset={result.offset}
                pageSize={CASE_PAGE_SIZE}
                shownCount={result.items.length}
                total={result.total}
                isBusy={status === 'loading'}
                onChange={(offset) => setFilter({ offset })}
              />
            </div>
          )
        ) : null}
      </div>
    </>
  );
}
