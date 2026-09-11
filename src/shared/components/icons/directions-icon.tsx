import React from 'react';
import { createIcon } from '@gluestack-ui/themed';
import { Path } from 'react-native-svg';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'directions-icon.tsx';

/**
 * Gluestack UI ships no navigation/directions icon — same `createIcon`
 * pattern as `MapPinIcon`, so it is theme-aware and sizeable via `Icon`.
 */
export const DirectionsIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <Path
      d="M3 11 22 2l-9 19-2-8-8-2z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
});
DirectionsIcon.displayName = 'DirectionsIcon';

LoggerService.info(`${FILE_NAME}: DirectionsIcon: icon component defined`);
