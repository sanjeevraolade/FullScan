import React from 'react';
import { createIcon } from '@gluestack-ui/themed';
import { Path } from 'react-native-svg';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'refresh-icon.tsx';

/**
 * Circular-arrows "recalculate" glyph. Gluestack UI's `RepeatIcon` reads as
 * "loop/repeat playback" rather than "measure again", so this follows the
 * pattern its own bundled icons use (`createIcon` + svg primitives) to give
 * the Recalculate Distance action an intuitive icon.
 */
export const RefreshIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <>
      <Path
        d="M21 12a9 9 0 1 1-2.64-6.36"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M21 3v6h-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
});
RefreshIcon.displayName = 'RefreshIcon';

LoggerService.info(`${FILE_NAME}: RefreshIcon: icon component defined`);
