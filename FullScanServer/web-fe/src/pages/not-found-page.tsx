import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../utils/use-document-title';

export function NotFoundPage() {
  useDocumentTitle('Page not found');

  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">That page does not exist.</p>
      <Link to="/" className="btn-primary mt-6">
        Go to dashboard
      </Link>
    </div>
  );
}
