import { useId, type ChangeEvent, type ReactNode } from 'react';

interface FieldShellProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
  readonly isWide?: boolean;
  readonly children: ReactNode;
}

function FieldShell({ id, label, hint, error, isWide = false, children }: FieldShellProps) {
  return (
    <div className={isWide ? 'sm:col-span-2 lg:col-span-3' : undefined}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: string): string | undefined {
  if (error) {
    return `${id}-error`;
  }
  return hint ? `${id}-hint` : undefined;
}

interface TextFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly hint?: string;
  readonly error?: string;
  readonly placeholder?: string;
  readonly type?: 'text' | 'email' | 'number';
  readonly isRequired?: boolean;
  readonly isWide?: boolean;
  readonly maxLength?: number;
  readonly autoComplete?: string;
  readonly inputId?: string;
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  error,
  placeholder,
  type = 'text',
  isRequired = false,
  isWide = false,
  maxLength,
  autoComplete = 'off',
  inputId,
}: TextFieldProps) {
  const generatedId = useId();
  const id = inputId ?? generatedId;
  return (
    <FieldShell id={id} label={isRequired ? `${label} *` : label} hint={hint} error={error} isWide={isWide}>
      <input
        id={id}
        type={type}
        step={type === 'number' ? 'any' : undefined}
        className="input"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        required={isRequired}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      />
    </FieldShell>
  );
}

interface TextAreaFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error?: string;
  readonly hint?: string;
  readonly inputId?: string;
}

export function TextAreaField({ label, value, onChange, error, hint, inputId }: TextAreaFieldProps) {
  const generatedId = useId();
  const id = inputId ?? generatedId;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} isWide>
      <textarea
        id={id}
        className="textarea"
        rows={2}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  );
}

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

interface SelectFieldProps {
  readonly label: string;
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly onChange: (value: string) => void;
  /** Adds an empty first option with this text. */
  readonly placeholder?: string;
  readonly error?: string;
  readonly hint?: string;
  readonly isRequired?: boolean;
  readonly isWide?: boolean;
  readonly inputId?: string;
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  error,
  hint,
  isRequired = false,
  isWide = false,
  inputId,
}: SelectFieldProps) {
  const generatedId = useId();
  const id = inputId ?? generatedId;
  // A stored value missing from the options (e.g. a retired code) still shows, rather than silently changing.
  const hasValue = value === '' || options.some((option) => option.value === value);

  return (
    <FieldShell id={id} label={isRequired ? `${label} *` : label} hint={hint} error={error} isWide={isWide}>
      <select
        id={id}
        className="select"
        value={value}
        required={isRequired}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        onChange={(event) => onChange(event.target.value)}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {!hasValue ? <option value={value}>{value}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
