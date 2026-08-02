import {
  Download,
  ExternalLink,
  FileText,
  LockKeyhole,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  DocumentWithRelations,
} from '../../types/document';
import {
  createDocumentSignedUrl,
} from '../../services/documentService';
import './DocumentDetailsModal.css';

type DocumentDetailsModalProps = {
  open: boolean;
  document: DocumentWithRelations | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onOpenFile: () => Promise<void>;
  onDownload: () => Promise<void>;
  onDelete: () => Promise<void>;
};

const TEXT_PREVIEW_MAX_BYTES = 150_000;

function formatDate(value?: string | null): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatFileSize(value?: number | null): string {
  const bytes = Number(value ?? 0);

  if (!bytes) {
    return '—';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeLabel(mimeType?: string | null): string {
  if (!mimeType) {
    return 'File';
  }

  if (mimeType === 'application/pdf') {
    return 'PDF';
  }

  if (mimeType.includes('word')) {
    return 'Word';
  }

  if (
    mimeType.includes('sheet') ||
    mimeType.includes('excel')
  ) {
    return 'Spreadsheet';
  }

  if (mimeType.startsWith('image/')) {
    return 'Image';
  }

  if (mimeType.startsWith('text/')) {
    return 'Text';
  }

  return 'File';
}

export function DocumentDetailsModal({
  open,
  document,
  loading,
  error,
  onClose,
  onDownload,
  onOpenFile,
  onDelete,
}: DocumentDetailsModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const previewType = useMemo(() => {
    if (!document?.mime_type) {
      return 'none';
    }

    if (document.mime_type === 'application/pdf') {
      return 'pdf';
    }

    if (document.mime_type.startsWith('image/')) {
      return 'image';
    }

    if (
      document.mime_type.startsWith('text/') &&
      (document.size_bytes ?? 0) <= TEXT_PREVIEW_MAX_BYTES
    ) {
      return 'text';
    }

    return 'none';
  }, [document]);

  useEffect(() => {
    if (!open || !document) {
      setPreviewUrl(null);
      setTextPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    let active = true;

    async function loadPreview() {
      if (!document) {
        setPreviewLoading(false);
        return;
      }

      setPreviewError(null);
      setPreviewUrl(null);
      setTextPreview(null);
      setPreviewLoading(true);

      try {
        const signedUrl = await createDocumentSignedUrl(
          document,
          300,
        );

        if (!active) {
          return;
        }

        if (previewType === 'text') {
          const response = await fetch(signedUrl);

          if (!response.ok) {
            throw new Error(
              'Unable to load text preview.',
            );
          }

          const rawText = await response.text();

          if (!active) {
            return;
          }

          setTextPreview(rawText.slice(0, 15000));
          setPreviewUrl(signedUrl);
          return;
        }

        setPreviewUrl(signedUrl);
      } catch (previewLoadError) {
        setPreviewError(
          previewLoadError instanceof Error
            ? previewLoadError.message
            : 'Unable to load document preview.',
        );
      } finally {
        if (active) {
          setPreviewLoading(false);
        }
      }
    }

    if (previewType !== 'none') {
      void loadPreview();
    }

    return () => {
      active = false;
    };
  }, [document, open, previewType]);

  if (!open) {
    return null;
  }

  const documentType =
    document?.document_type ||
    getFileTypeLabel(document?.mime_type);

  return (
    <div className="document-details-layer" role="presentation">
      <button
        type="button"
        className="document-details-backdrop"
        onClick={onClose}
        aria-label="Close document details"
      />

      <section className="document-details-modal" role="dialog" aria-modal="true">
        <header className="document-details-header">
          <div>
            <p className="modal-eyebrow">
              Document details
            </p>
            <h3>{document?.name ?? 'Document details'}</h3>
            <p className="modal-description">
              Review document metadata, preview files, and manage access securely.
            </p>
          </div>

          <button
            type="button"
            className="document-details-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="document-details-body">
          {loading ? (
            <div className="document-details-loading">
              Loading document details…
            </div>
          ) : error ? (
            <div className="document-details-error" role="alert">
              {error}
            </div>
          ) : document ? (
            <div className="document-details-grid">
              <div className="document-details-summary">
                <div className="document-details-badge-row">
                  <span className="document-privacy-badge">
                    {document.is_confidential ? 'Confidential' : 'Standard'}
                  </span>
                  <span className="document-type-badge">
                    {documentType}
                  </span>
                </div>

                <div className="document-summary-field">
                  <span>Name</span>
                  <strong>{document.name}</strong>
                </div>

                <div className="document-summary-field">
                  <span>Client</span>
                  <strong>{document.client?.full_name ?? 'Unlinked'}</strong>
                </div>

                <div className="document-summary-field">
                  <span>Case</span>
                  <strong>
                    {document.case?.case_number ?? document.case?.case_type ?? 'Unlinked'}
                  </strong>
                </div>

                <div className="document-summary-field">
                  <span>Uploaded by</span>
                  <strong>
                    {document.uploaded_by_staff?.full_name ?? document.uploaded_by ?? 'Unknown'}
                  </strong>
                </div>

                <div className="document-summary-field">
                  <span>Created</span>
                  <strong>{formatDate(document.created_at)}</strong>
                </div>

                <div className="document-summary-field">
                  <span>Last updated</span>
                  <strong>{formatDate(document.updated_at)}</strong>
                </div>

                <div className="document-summary-field">
                  <span>File size</span>
                  <strong>{formatFileSize(document.size_bytes)}</strong>
                </div>

                <div className="document-summary-field">
                  <span>MIME type</span>
                  <strong>{document.mime_type ?? 'Unknown'}</strong>
                </div>

                <div className="document-summary-field">
                  <span>Version</span>
                  <strong>{document.version}</strong>
                </div>

                {document.description && (
                  <div className="document-summary-field document-summary-description">
                    <span>Description</span>
                    <p>{document.description}</p>
                  </div>
                )}
              </div>

              <div className="document-details-preview-panel">
                <div className="document-details-preview-header">
                  <div>
                    <span>Preview</span>
                    <strong>{documentType}</strong>
                  </div>
                  <div className="document-details-preview-status">
                    {previewLoading ? 'Loading preview…' : previewType === 'none' ? 'Preview unavailable' : 'Preview available'}
                  </div>
                </div>

                {previewLoading ? (
                  <div className="document-details-preview-loading">
                    Preparing preview…
                  </div>
                ) : previewError ? (
                  <div className="document-details-preview-error" role="alert">
                    {previewError}
                  </div>
                ) : previewUrl ? (
                  previewType === 'pdf' ? (
                    <iframe
                      title="Document preview"
                      src={previewUrl}
                      className="document-preview-frame"
                    />
                  ) : previewType === 'image' ? (
                    <img
                      src={previewUrl}
                      alt={document.name}
                      className="document-preview-image"
                    />
                  ) : previewType === 'text' ? (
                    <pre className="document-preview-text">
                      {textPreview || 'Loading preview…'}
                    </pre>
                  ) : null
                ) : (
                  <div className="document-preview-empty">
                    <FileText size={24} />
                    <p>
                      Preview is not available for this file type.
                      Use Open or Download to view the document.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="document-details-empty">
              Document details are not available.
            </div>
          )}
        </div>

        <footer className="document-details-actions">
          <button
            type="button"
            className="secondary-action-button"
            onClick={onClose}
          >
            Close
          </button>

          <div className="document-details-actions-right">
            <button
              type="button"
              className="secondary-action-button"
              onClick={onOpenFile}
              disabled={loading}
            >
              <ExternalLink size={16} />
              Open file
            </button>

            <button
              type="button"
              className="secondary-action-button"
              onClick={onDownload}
              disabled={loading}
            >
              <Download size={16} />
              Download
            </button>

            <button
              type="button"
              className="primary-action-button danger"
              onClick={onDelete}
              disabled={loading}
            >
              <LockKeyhole size={16} />
              Delete
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
