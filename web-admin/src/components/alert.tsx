import type { ReactNode } from 'react';

type AlertVariant = 'error' | 'success' | 'info' | 'warning';

const VARIANT_CLASSES: Readonly<Record<AlertVariant, string>> = {
  error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200',
  info: 'border-brand-100 bg-brand-50 text-brand-700 dark:border-brand-700/50 dark:bg-brand-700/20 dark:text-brand-100',
  warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
};

interface AlertProps {
  readonly variant: AlertVariant;
  readonly title?: string;
  readonly children: ReactNode;
  readonly action?: ReactNode;
  readonly className?: string;
}

/** Errors interrupt screen readers (`alert`); everything else is announced politely (`status`). */
export function Alert({ variant, title, children, action, className = '' }: AlertProps) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${VARIANT_CLASSES[variant]} ${className}`}
    >
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={title ? 'mt-0.5' : undefined}>{children}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
