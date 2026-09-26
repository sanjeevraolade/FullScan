import { useEffect } from 'react';

const APP_NAME = 'FullScan Admin';

export function useDocumentTitle(pageTitle: string): void {
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} · ${APP_NAME}` : APP_NAME;
  }, [pageTitle]);
}
