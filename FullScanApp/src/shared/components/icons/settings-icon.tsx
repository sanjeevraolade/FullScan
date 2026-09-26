import React from 'react';
import { createIcon } from '@gluestack-ui/themed';
import { Circle, Path } from 'react-native-svg';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'settings-icon.tsx';

/**
 * Gear glyph for "open device settings" actions. Follows the pattern
 * Gluestack UI's own bundled icons use (`createIcon` + svg primitives).
 */
export const SettingsIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <>
      <Path
        d="M12 2.5l1.6 2.2 2.7-.4.6 2.6 2.4 1.3-1.2 2.4 1.2 2.4-2.4 1.3-.6 2.6-2.7-.4L12 21.5l-1.6-2.2-2.7.4-.6-2.6L4.7 15.6 5.9 13.2 4.7 10.8l2.4-1.3.6-2.6 2.7.4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </>
  ),
});
SettingsIcon.displayName = 'SettingsIcon';

LoggerService.info(`${FILE_NAME}: SettingsIcon: icon component defined`);
