import React from 'react';
import { createIcon } from '@gluestack-ui/themed';
import { Path } from 'react-native-svg';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'face-id-icon.tsx';

/**
 * Gluestack UI ships no Face ID icon — follows the same `createIcon` + svg
 * pattern as `CameraIcon`/`ShieldIcon`, so it's theme-aware and sizeable via
 * `Icon` props exactly like the bundled icons. Shown on the Login screen
 * when the device's enrolled biometry is face-based.
 */
export const FaceIdIcon = createIcon({
  viewBox: '0 0 24 24',
  path: (
    <>
      <Path
        d="M7 3.5H5.5a2 2 0 0 0-2 2V7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17 3.5h1.5a2 2 0 0 1 2 2V7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 20.5H5.5a2 2 0 0 1-2-2V17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17 20.5h1.5a2 2 0 0 0 2-2V17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M9 10v1.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <Path d="M15 10v1.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <Path
        d="M12 10v3h-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 15.5c.8.7 1.9 1 3 1s2.2-.3 3-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
});
FaceIdIcon.displayName = 'FaceIdIcon';

LoggerService.info(`${FILE_NAME}: FaceIdIcon: icon component defined`);
