import { useCallback, useEffect, useMemo, useReducer, useState, type FormEvent } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import { casesApi } from '../api/cases-api';
import { ApiError, toErrorMessage } from '../api/client';
import { Alert } from '../components/alert';
import { CaseComponentCard, componentFieldId } from '../components/case-component-card';
import { ConfirmDialog } from '../components/confirm-dialog';
import { SelectField, TextField } from '../components/form-fields';
import { PageHeader } from '../components/page-header';
import { Spinner } from '../components/spinner';
import { useCaseListStore } from '../stores/case-list-store';
import { useReferenceStore } from '../stores/reference-store';
import type { AdminCaseDetail } from '../types/cases';
import {
  caseToDraft,
  createBlankCase,
  createBlankComponent,
  describeProblem,
  draftToPayload,
  isDraftChanged,
  validateCaseDraft,
  type CaseDraft,
  type CaseField,
  type ComponentField,
  type DraftProblem,
} from '../utils/case-draft';
import { pluralize } from '../utils/labels';
import { useApiResource } from '../utils/use-api-resource';

type DraftAction =
  | { readonly type: 'load'; readonly draft: CaseDraft }
  | { readonly type: 'setCaseField'; readonly field: CaseField; readonly value: string }
  | { readonly type: 'setComponentField'; readonly key: string; readonly field: ComponentField; readonly value: string }
  | { readonly type: 'addComponent' }
  | { readonly type: 'removeComponent'; readonly key: string };

function draftReducer(draft: CaseDraft, action: DraftAction): CaseDraft {
  switch (action.type) {
    case 'load':
      return action.draft;
    case 'setCaseField':
      return { ...draft, [action.field]: action.value };
    case 'setComponentField':
      return {
        ...draft,
        components: draft.components.map((component) =>
          component.key === action.key ? { ...component, [action.field]: action.value } : component,
        ),
      };
    case 'addComponent':
      return { ...draft, components: [...draft.components, createBlankComponent()] };
    case 'removeComponent':
      // Only components added in this editor can be removed; the API never deletes one.
      return {
        ...draft,
        components: draft.components.filter((component) => component.key !== action.key || component.id !== null),
      };
  }
}

function caseFieldId(field: CaseField): string {
  return `case-${field}`;
}

function focusProblem(problem: DraftProblem, draft: CaseDraft): void {
  const id =
    problem.path.kind === 'case'
      ? caseFieldId(problem.path.field)
      : problem.path.kind === 'component'
        ? componentFieldId(draft.components[problem.path.index]?.key ?? '', problem.path.field)
        : null;
  if (id) {
    document.getElementById(id)?.focus();
  }
}

interface CaseEditorPageProps {
  readonly mode: 'create' | 'edit';
}

/**
 * Create or edit a case with its components. Create mode is the Add New Case page:
 * a save resets the form for the next case. Edit mode reloads from the server's
 * response, so what is shown after a save is what was stored.
 */
export function CaseEditorPage({ mode }: CaseEditorPageProps) {
  const { caseId = '' } = useParams();
  const navigate = useNavigate();
  const isCreate = mode === 'create';

  const formOptions = useReferenceStore((state) => state.formOptions);
  const fieldExecutives = useReferenceStore((state) => state.fieldExecutives);
  const referenceStatus = useReferenceStore((state) => state.status);
  const referenceError = useReferenceStore((state) => state.error);
  const ensureReference = useReferenceStore((state) => state.ensureLoaded);
  const reloadReference = useReferenceStore((state) => state.reload);
  const fetchCaseList = useCaseListStore((state) => state.fetchCases);

  const [draft, dispatch] = useReducer(draftReducer, undefined, createBlankCase);
  const [baseline, setBaseline] = useState<CaseDraft | null>(isCreate ? draft : null);
  const [problems, setProblems] = useState<readonly DraftProblem[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void ensureReference();
  }, [ensureReference]);

  const caseResource = useApiResource((signal) => casesApi.fetchCase(caseId, signal), [caseId], {
    isEnabled: !isCreate && caseId !== '',
    fallbackError: 'Could not load this case.',
  });
  const evidenceResource = useApiResource((signal) => casesApi.fetchCaseEvidence(caseId, signal), [caseId], {
    isEnabled: !isCreate && caseId !== '',
    fallbackError: 'Could not load web evidence.',
  });

  const applyLoadedCase = useCallback((detail: AdminCaseDetail): void => {
    const loaded = caseToDraft(detail);
    dispatch({ type: 'load', draft: loaded });
    setBaseline(loaded);
    setProblems([]);
  }, []);

  useEffect(() => {
    if (caseResource.data) {
      applyLoadedCase(caseResource.data);
    }
  }, [caseResource.data, applyLoadedCase]);

  const isDirty = baseline !== null && isDraftChanged(draft, baseline);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => isDirty && !isSaving && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (!isDirty) {
      return;
    }
    const warn = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const caseErrors = useMemo(() => {
    const errors: Partial<Record<CaseField, string>> = {};
    for (const problem of problems) {
      if (problem.path.kind === 'case') {
        errors[problem.path.field] ??= problem.message;
      }
    }
    return errors;
  }, [problems]);

  const componentErrors = (index: number): Partial<Record<ComponentField, string>> => {
    const errors: Partial<Record<ComponentField, string>> = {};
    for (const problem of problems) {
      if (problem.path.kind === 'component' && problem.path.index === index) {
        errors[problem.path.field] ??= problem.message;
      }
    }
    return errors;
  };

  const setCaseField = (field: CaseField) => (value: string) => {
    dispatch({ type: 'setCaseField', field, value });
    setSuccessMessage(null);
  };

  const save = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (isSaving) {
      return;
    }

    setSaveError(null);
    setSuccessMessage(null);
    const found = validateCaseDraft(draft);
    setProblems(found);
    const [firstProblem] = found;
    if (firstProblem) {
      focusProblem(firstProblem, draft);
      return;
    }

    setIsSaving(true);
    try {
      const payload = draftToPayload(draft);
      const saved = isCreate ? await casesApi.createCase(payload) : await casesApi.updateCase(caseId, payload);
      const summary = pluralize(saved.components.length, 'component');
      void fetchCaseList();

      if (isCreate) {
        const blank = createBlankCase();
        dispatch({ type: 'load', draft: blank });
        setBaseline(blank);
        setSuccessMessage(`Case ${saved.caseRef} created with ${summary}. The form is ready for the next case.`);
        window.scrollTo({ top: 0 });
        return;
      }

      // The loaded-case effect turns this into the new draft and baseline.
      caseResource.setData(saved);
      setSuccessMessage(`Case ${saved.caseRef} saved with ${summary}.`);
      window.scrollTo({ top: 0 });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setProblems([{ path: { kind: 'case', field: 'caseRef' }, message: error.message }]);
        document.getElementById(caseFieldId('caseRef'))?.focus();
      }
      setSaveError(toErrorMessage(error, 'Could not save this case.'));
      window.scrollTo({ top: 0 });
    } finally {
      setIsSaving(false);
    }
  };

  const title = isCreate ? 'Add New Case' : caseResource.data ? `Case ${caseResource.data.caseRef}` : 'Case';
  const subtitle = isCreate
    ? 'Create a case with one or more verification components, ready to be assigned.'
    : 'Edit the case record and its components. Components left untouched are not changed.';

  const header = (
    <PageHeader
      title={title}
      subtitle={subtitle}
      actions={
        <Link to="/cases" className="btn-secondary">
          Back to cases
        </Link>
      }
    />
  );

  if (referenceStatus === 'error' && !formOptions) {
    return (
      <>
        {header}
        <Alert
          variant="error"
          action={
            <button type="button" className="btn-secondary" onClick={() => void reloadReference()}>
              Retry
            </button>
          }
        >
          {referenceError}
        </Alert>
      </>
    );
  }

  if (!isCreate && caseResource.status === 'error') {
    return (
      <>
        {header}
        <Alert
          variant="error"
          action={
            <button type="button" className="btn-secondary" onClick={() => void caseResource.reload()}>
              Retry
            </button>
          }
        >
          {caseResource.error}
        </Alert>
      </>
    );
  }

  if (!formOptions || (!isCreate && !baseline)) {
    return (
      <>
        {header}
        <Spinner label={isCreate ? 'Loading form…' : 'Loading case…'} />
      </>
    );
  }

  return (
    <>
      {header}

      <form className="grid grid-cols-1 gap-5 pb-24" onSubmit={(event) => void save(event)} noValidate>
        {successMessage ? <Alert variant="success">{successMessage}</Alert> : null}
        {saveError ? <Alert variant="error">{saveError}</Alert> : null}
        {problems.length > 0 && !saveError ? (
          <Alert variant="error" title="Fix these before saving">
            <ul className="list-disc pl-5">
              {problems.map((problem) => (
                <li key={`${JSON.stringify(problem.path)}-${problem.message}`}>{describeProblem(problem)}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {!isCreate && evidenceResource.status === 'error' ? (
          <Alert variant="warning">{evidenceResource.error}</Alert>
        ) : null}

        <section aria-labelledby="case-heading" className="card">
          <header className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 id="case-heading" className="text-base font-semibold">
              Case
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              The candidate/client record every component below belongs to.
            </p>
          </header>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <TextField inputId={caseFieldId('caseRef')} label="Case reference" isRequired value={draft.caseRef} onChange={setCaseField('caseRef')} error={caseErrors.caseRef} />
            <TextField inputId={caseFieldId('clientName')} label="Client" isRequired value={draft.clientName} onChange={setCaseField('clientName')} error={caseErrors.clientName} />
            <TextField inputId={caseFieldId('candidateName')} label="Candidate" isRequired value={draft.candidateName} onChange={setCaseField('candidateName')} error={caseErrors.candidateName} />
            <TextField inputId={caseFieldId('fatherOrSpouseName')} label="Father / spouse name" value={draft.fatherOrSpouseName} onChange={setCaseField('fatherOrSpouseName')} error={caseErrors.fatherOrSpouseName} />
            <TextField inputId={caseFieldId('employerName')} label="Employer" value={draft.employerName} onChange={setCaseField('employerName')} error={caseErrors.employerName} />
            <TextField inputId={caseFieldId('primaryContactNumber')} label="Primary contact number" value={draft.primaryContactNumber} onChange={setCaseField('primaryContactNumber')} error={caseErrors.primaryContactNumber} />
            <TextField inputId={caseFieldId('secondaryContactNumber')} label="Secondary contact number" value={draft.secondaryContactNumber} onChange={setCaseField('secondaryContactNumber')} error={caseErrors.secondaryContactNumber} />
            <SelectField
              inputId={caseFieldId('profileStatus')}
              label="Profile status"
              isRequired
              value={draft.profileStatus}
              placeholder="Select a profile status"
              options={formOptions.profileStatuses.map((option) => ({ value: option.code, label: option.label }))}
              onChange={setCaseField('profileStatus')}
              error={caseErrors.profileStatus}
            />
          </div>
        </section>

        {draft.components.map((component, index) => (
          <CaseComponentCard
            key={component.key}
            component={component}
            index={index}
            formOptions={formOptions}
            fieldExecutives={fieldExecutives}
            errors={componentErrors(index)}
            evidence={evidenceResource.data?.evidence ?? null}
            onChange={(field, value) => {
              dispatch({ type: 'setComponentField', key: component.key, field, value });
              setSuccessMessage(null);
            }}
            onRemove={() => dispatch({ type: 'removeComponent', key: component.key })}
          />
        ))}

        <div>
          <button type="button" className="btn-secondary" onClick={() => dispatch({ type: 'addComponent' })}>
            Add component
          </button>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur lg:left-68 dark:border-slate-800 dark:bg-slate-950/95">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-3 px-4 py-3 sm:px-6">
            <span className={`mr-auto text-sm ${isDirty ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-slate-500'}`} aria-live="polite">
              {isDirty ? 'Unsaved changes' : isCreate ? 'A case needs at least one component.' : 'No unsaved changes'}
            </span>
            <button type="button" className="btn-secondary" onClick={() => void navigate('/cases')}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving…' : isCreate ? 'Create case' : 'Save changes'}
            </button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        request={
          blocker.state === 'blocked'
            ? {
                title: 'Discard unsaved changes?',
                message: 'You have changes to this case that are not saved. Leaving now discards them.',
                confirmLabel: 'Discard changes',
                tone: 'danger',
              }
            : null
        }
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </>
  );
}

/** Keyed by case id so switching cases (or to Add New Case) never carries a draft across. */
export function EditCaseRoute() {
  const { caseId = '' } = useParams();
  return <CaseEditorPage key={`edit-${caseId}`} mode="edit" />;
}

export function NewCaseRoute() {
  return <CaseEditorPage key="create" mode="create" />;
}
