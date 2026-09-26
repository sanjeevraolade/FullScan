import type { NavIcon } from '../utils/navigation';

type IconName = NavIcon | 'menu' | 'close' | 'chevron' | 'logout';

const PATHS: Readonly<Record<IconName, string>> = {
  briefcase: 'M9 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1m-9 0h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm-2 6h16',
  shield: 'M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3 15h2',
  plus: 'M12 5v14M5 12h14',
  sliders: 'M4 6h10m4 0h2M4 12h4m4 0h8M4 18h12m4 0h0M14 4v4M8 10v4M16 16v4',
  userPlus: 'M15 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1m16-11v6m3-3h-6M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6 6 18',
  chevron: 'm9 6 6 6-6 6',
  logout: 'M15 17l5-5-5-5m5 5H9m4 9H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7',
};

interface IconProps {
  readonly name: IconName;
  readonly className?: string;
}

/** Decorative only — every icon sits next to visible or screen-reader text. */
export function Icon({ name, className = 'size-5' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
