interface SpinnerProps {
  readonly label?: string;
  readonly className?: string;
}

export function Spinner({ label = 'Loading…', className = '' }: SpinnerProps) {
  return (
    <span role="status" className={`inline-flex items-center gap-2 text-sm text-slate-500 ${className}`}>
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500 motion-reduce:animate-none"
      />
      <span>{label}</span>
    </span>
  );
}

export function FullPageSpinner({ label }: { readonly label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner label={label} />
    </div>
  );
}
