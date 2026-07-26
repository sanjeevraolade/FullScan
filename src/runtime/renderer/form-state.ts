import { createContext, useCallback, useContext } from 'react';

/**
 * Per-screen form state — current field values and validation errors, keyed
 * by `widgetId`. Owned and provided by `ScreenRenderer` (see
 * screen-renderer.tsx), consumed by input-category widgets via
 * `useFormField`. This is a simpler stand-in for the documented "Form Data"
 * slice of Runtime Context (docs/04-Runtime/01-Verification-Runtime-Engine.md
 * §8) — values are keyed by `widgetId` rather than the configured `binding`
 * path, and nothing persists beyond the mounted screen.
 */
export interface FormStateContextValue {
  readonly values: Readonly<Record<string, string>>;
  readonly errors: Readonly<Record<string, string>>;
  setValue(widgetId: string, value: string): void;
}

export const FormStateContext = createContext<FormStateContextValue | undefined>(undefined);

export function useFormField(widgetId: string): {
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
} {
  const context = useContext(FormStateContext);
  if (!context) {
    throw new Error('useFormField() must be used within a ScreenRenderer');
  }

  const { values, errors, setValue } = context;
  const onChange = useCallback((value: string) => setValue(widgetId, value), [widgetId, setValue]);

  return {
    value: values[widgetId] ?? '',
    error: errors[widgetId],
    onChange,
  };
}
