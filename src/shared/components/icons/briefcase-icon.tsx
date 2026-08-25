import React from 'react';
import { createIcon } from '@gluestack-ui/themed';
import { Path, Rect } from 'react-native-svg';

/**
 * Gluestack UI ships no briefcase/work icon — this follows the exact pattern
 * its own bundled icons use (`createIcon` + svg primitives), so it behaves
 * identically to e.g. `SearchIcon` (theme-aware, sizeable via `Icon` props).
 */
export const BriefcaseIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <>
      <Path
        d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect width="20" height="14" x="2" y="6" rx="2" stroke="currentColor" strokeWidth="2" />
    </>
  ),
});
BriefcaseIcon.displayName = 'BriefcaseIcon';
