import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert } from '../components/alert';
import { AssignmentDetail } from '../components/assignment-detail';
import { EvidenceUpload } from '../components/evidence-upload';
import { Spinner } from '../components/spinner';
import { useAssignmentStore } from '../stores/assignment-store';
import { useDocumentTitle } from '../utils/use-document-title';

export function AssignmentDetailPage() {
  const { componentId = '' } = useParams();
  const detail = useAssignmentStore((state) => state.detail);
  const detailStatus = useAssignmentStore((state) => state.detailStatus);
  const detailError = useAssignmentStore((state) => state.detailError);
  const selectAssignment = useAssignmentStore((state) => state.selectAssignment);
  const clearSelection = useAssignmentStore((state) => state.clearSelection);

  useDocumentTitle(detail && detail.componentId === componentId ? detail.candidateName : 'Assignment');

  useEffect(() => {
    if (componentId) {
      void selectAssignment(componentId);
    }
    return () => clearSelection();
  }, [componentId, selectAssignment, clearSelection]);

  const currentDetail = detail?.componentId === componentId ? detail : null;

  return (
    <div className="grid gap-5">
      <Link
        to="/assignments"
        className="inline-flex min-h-11 w-fit items-center text-sm font-medium text-brand-600 hover:underline dark:text-brand-100"
      >
        ← Back to assignments
      </Link>

      {detailStatus === 'error' && detailError ? (
        <Alert
          variant="error"
          action={
            <button type="button" className="btn-secondary" onClick={() => void selectAssignment(componentId)}>
              Retry
            </button>
          }
        >
          {detailError}
        </Alert>
      ) : null}

      {!currentDetail && detailStatus === 'loading' ? <Spinner label="Loading assignment…" /> : null}

      {currentDetail ? (
        <>
          <AssignmentDetail detail={currentDetail} />
          <EvidenceUpload componentId={currentDetail.componentId} canUpload={currentDetail.canUploadEvidence} />
        </>
      ) : null}
    </div>
  );
}
