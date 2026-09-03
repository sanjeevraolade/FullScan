import React from 'react';
import { createIcon } from '@gluestack-ui/themed';
import { Path } from 'react-native-svg';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'filter-icon.tsx';

/**
 * Gluestack UI ships no funnel/filter icon — this follows the exact pattern
 * its own bundled icons use (`createIcon` + an svg Path), so it behaves
 * identically to e.g. `SearchIcon` (theme-aware, sizeable via `Icon` props).
 */
export const FilterIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <Path
      d="M4 5H20L14 12.5V19L10 21V12.5L4 5Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
});
FilterIcon.displayName = 'FilterIcon';

LoggerService.info(`${FILE_NAME}: FilterIcon: icon component defined`);
