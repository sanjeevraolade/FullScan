import type { AdminCaseEvidence, CaseFormOptions } from '../types/cases';
import type { AdminFieldExecutiveListItem } from '../types/field-executives';
import type { ComponentDraft, ComponentField } from '../utils/case-draft';
import { ADDRESS_TYPE_LABELS, BUCKET_LABELS, RESIDENCE_TYPE_LABELS } from '../utils/labels';
import { CaseEvidenceList } from './case-evidence-list';
import { SelectField, TextAreaField, TextField, type SelectOption } from './form-fields';

interface CaseComponentCardProps {
  readonly component: ComponentDraft;
  readonly index: number;
  readonly formOptions: CaseFormOptions;
  readonly fieldExecutives: readonly AdminFieldExecutiveListItem[];
  readonly errors: Partial<Record<ComponentField, string>>;
  /** Null when not loaded (create mode, or the evidence call failed). */
  readonly evidence: readonly AdminCaseEvidence[] | null;
  readonly onChange: (field: ComponentField, value: string) => void;
  readonly onRemove: () => void;
}

export function componentFieldId(componentKey: string, field: ComponentField): string {
  return `${componentKey}-${field}`;
}

function toLabelled(values: readonly string[], labels: Readonly<Record<string, string>>): SelectOption[] {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export function CaseComponentCard({
  component,
  index,
  formOptions,
  fieldExecutives,
  errors,
  evidence,
  onChange,
  onRemove,
}: CaseComponentCardProps) {
  const headingId = `${component.key}-heading`;
  const text = (field: ComponentField, label: string, options: { hint?: string; placeholder?: string; type?: 'text' | 'number'; isRequired?: boolean } = {}) => (
    <TextField
      inputId={componentFieldId(component.key, field)}
      label={label}
      value={component[field]}
      onChange={(value) => onChange(field, value)}
      error={errors[field]}
      {...options}
    />
  );
  const area = (field: ComponentField, label: string) => (
    <TextAreaField
      inputId={componentFieldId(component.key, field)}
      label={label}
      value={component[field]}
      onChange={(value) => onChange(field, value)}
      error={errors[field]}
    />
  );
  const select = (field: ComponentField, label: string, options: readonly SelectOption[], placeholder?: string, isRequired = false) => (
    <SelectField
      inputId={componentFieldId(component.key, field)}
      label={label}
      value={component[field]}
      options={options}
      placeholder={placeholder}
      onChange={(value) => onChange(field, value)}
      error={errors[field]}
      isRequired={isRequired}
    />
  );

  return (
    <section aria-labelledby={headingId} className="card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="min-w-0">
          <h2 id={headingId} className="text-base font-semibold">
            Component {index + 1}
          </h2>
          <p className="text-sm break-all text-slate-500 dark:text-slate-400">
            {component.id ? `Existing component · ${component.id}` : 'New component — added to this case on save'}
          </p>
        </div>
        {component.id ? null : (
          <button type="button" className="btn-danger-ghost btn-sm" onClick={onRemove}>
            Remove<span className="sr-only"> component {index + 1}</span>
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {select('bucket', 'Category', toLabelled(formOptions.buckets, BUCKET_LABELS), undefined, true)}
        {select(
          'componentStatus',
          'Component status',
          formOptions.componentStatuses.map((option) => ({ value: option.code, label: option.label })),
          undefined,
          true,
        )}
        {select(
          'actionStatus',
          'Action status',
          formOptions.actionStatuses.map((option) => ({ value: option.code, label: option.label })),
          'No action yet',
        )}
        {text('verificationType', 'Verification type', { placeholder: 'Address, Employment, Education…', isRequired: true })}
        {select('addressType', 'Address type', toLabelled(formOptions.addressTypes, ADDRESS_TYPE_LABELS), 'Not applicable')}
        {select('residenceType', 'Residence type', toLabelled(formOptions.residenceTypes, RESIDENCE_TYPE_LABELS), 'Not recorded')}
        <TextAreaField
          inputId={componentFieldId(component.key, 'address')}
          label="Address *"
          value={component.address}
          onChange={(value) => onChange('address', value)}
          error={errors.address}
        />
        {text('location', 'Locality')}
        {select(
          'assignedFieldExecutiveId',
          'Assigned field executive',
          fieldExecutives.map((executive) => ({ value: executive.id, label: `${executive.name} (${executive.username})` })),
          'Unassigned',
        )}
        {text('assignedToName', 'Assignee name (free text)', {
          hint: 'Used when the source system names someone outside the roster.',
        })}
        {text('tatDueAt', 'TAT due', { placeholder: 'YYYY-MM-DD HH:MM:SS' })}
        {text('targetLatitude', 'Target latitude', { type: 'number' })}
        {text('targetLongitude', 'Target longitude', { type: 'number' })}
        {text('maskedPrimaryPhone', 'Masked primary phone', {
          hint: 'Masked on purpose — the app never receives a raw candidate number.',
        })}
        {text('maskedSecondaryPhone', 'Masked secondary phone')}
        {area('clientInstructions', 'Client instructions')}
        {area('fieldExecutiveNotes', 'Field executive notes')}
        {area('remarks', 'Remarks')}
        {area('additionalVerificationInstructions', 'Additional verification instructions')}
        {area('additionalVerificationRemarks', 'Additional verification remarks')}
      </div>

      {component.id && evidence ? (
        <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <h3 className="mb-2 text-sm font-semibold">Evidence</h3>
          <CaseEvidenceList evidence={evidence.filter((item) => item.componentId === component.id)} />
        </div>
      ) : null}
    </section>
  );
}
