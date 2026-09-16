interface FilterTab<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
  readonly count?: number;
}

interface FilterTabsProps<TValue extends string> {
  readonly label: string;
  readonly tabs: readonly FilterTab<TValue>[];
  readonly selected: TValue;
  readonly onSelect: (value: TValue) => void;
}

/** A row of toggle buttons filtering one list — `aria-pressed`, not a tab widget, since nothing else switches. */
export function FilterTabs<TValue extends string>({ label, tabs, selected, onSelect }: FilterTabsProps<TValue>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isSelected = tab.value === selected;
        return (
          <button
            key={tab.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(tab.value)}
            className={`btn min-h-10 rounded-full border px-3.5 ${
              isSelected
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className={`rounded-full px-1.5 text-xs ${isSelected ? 'bg-white/25' : 'bg-slate-100 dark:bg-slate-800'}`}>
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
