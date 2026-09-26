import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

export interface ConfirmRequest {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly tone?: 'primary' | 'danger';
  /** When set, the dialog asks for an optional note of at most this length. */
  readonly note?: { readonly label: string; readonly maxLength: number };
}

interface ConfirmDialogProps {
  /** Open while non-null. */
  readonly request: ConfirmRequest | null;
  readonly onConfirm: (note: string) => void;
  readonly onCancel: () => void;
}

/**
 * A native modal `<dialog>`: focus is trapped and restored by the browser, Escape
 * cancels, and the rest of the page is inert while it is open.
 */
export function ConfirmDialog({ request, onConfirm, onCancel }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();
  const noteId = useId();
  const [note, setNote] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (request && !dialog.open) {
      setNote('');
      dialog.showModal();
    } else if (!request && dialog.open) {
      dialog.close();
    }
  }, [request]);

  const noteTooLong = request?.note ? note.trim().length > request.note.maxLength : false;

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!noteTooLong) {
      onConfirm(note.trim());
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      {request ? (
        <form onSubmit={submit} className="p-6">
          <h2 id={titleId} className="text-lg font-semibold">
            {request.title}
          </h2>
          <p id={messageId} className="mt-2 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">
            {request.message}
          </p>

          {request.note ? (
            <div className="mt-4">
              <label htmlFor={noteId} className="label">
                {request.note.label}
              </label>
              <textarea
                id={noteId}
                className="textarea"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                aria-invalid={noteTooLong ? true : undefined}
              />
              <p className={noteTooLong ? 'field-error' : 'field-hint'} aria-live="polite">
                {note.trim().length} / {request.note.maxLength}
              </p>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="submit"
              className={request.tone === 'danger' ? 'btn-danger' : 'btn-primary'}
              disabled={noteTooLong}
              autoFocus
            >
              {request.confirmLabel}
            </button>
          </div>
        </form>
      ) : null}
    </dialog>
  );
}
