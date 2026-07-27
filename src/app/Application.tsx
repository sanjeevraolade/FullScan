import React from 'react';
import type { ReactElement } from 'react';

import { LoggerService } from '@/infrastructure/logger';

import { ApplicationProvider } from './ApplicationProvider';
import { ApplicationShell } from './ApplicationShell';

const FILE_NAME = 'Application.tsx';

export function Application(): ReactElement {
  LoggerService.info(`${FILE_NAME}: Application: rendering`);

  return (
    <ApplicationProvider>
      <ApplicationShell />
    </ApplicationProvider>
  );
}
