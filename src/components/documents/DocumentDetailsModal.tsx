import { tr, getLocale, useLocale } from '../../i18n/locale';
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
import { createPortal } from 'react-dom';
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

  return new Intl.DateTimeFormat(getLocale("en-GB"), {
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
  const interfaceLanguage = useLocale();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [htmlPreview, setHtmlPreview] = useState<string | null>(null);
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

    if (document.mime_type.startsWith('text/html')) {
      return 'html';
    }

    if (
      document.mime_type.startsWith('text/') &&
      (document.size_bytes ?? 0) <= TEXT_PREVIEW_MAX_BYTES
    ) {
      return 'text';
    }

    return 'none';
  }, [document, interfaceLanguage]);

  useEffect(() => {
    if (!open || !document) {
      setPreviewUrl(null);
      setTextPreview(null);
      setHtmlPreview(null);
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
      setHtmlPreview(null);
      setPreviewLoading(true);

      try {
        const signedUrl = await createDocumentSignedUrl(
          document,
          300,
        );

        if (!active) {
          return;
        }

        if (previewType === 'text' || previewType === 'html') {
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

          if (previewType === 'html') {
            setHtmlPreview(addPreviewContentPolicy(rawText));
          } else {
            setTextPreview(rawText.slice(0, 15000));
          }
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

  return createPortal(
    <div className="document-details-layer" role="presentation">
      <button
        type="button"
        className="document-details-backdrop"
        onClick={onClose}
        aria-label={tr("Close document details")}
      />

      <section className="document-details-modal" role="dialog" aria-modal="true">
        <header className="document-details-header">
          <div>
            <p className="modal-eyebrow">{tr("Document details")}</p>
            <h3>{document?.name ?? tr("Document details")}</h3>
            <p className="modal-description">{tr("Review document metadata, preview files, and manage access securely.")}</p>
          </div>

          <button
            type="button"
            className="document-details-close"
            onClick={onClose}
            aria-label={tr("Close")}
          >
            <X size={18} />
          </button>
        </header>

        <div className="document-details-body">
          {loading ? (
            <div className="document-details-loading">{tr("Loading document details…")}</div>
          ) : error ? (
            <div className="document-details-error" role="alert">
              {tr(error)}
            </div>
          ) : document ? (
            <div className="document-details-grid">
              <div className="document-details-summary">
                <div className="document-details-badge-row">
                  <span className="document-privacy-badge">
                    {document.is_confidential ? tr("Confidential") : tr("Standard")}
                  </span>
                  <span className="document-type-badge">
                    {documentType}
                  </span>
                </div>

                <div className="document-summary-field">
                  <span>{tr("Name")}</span>
                  <strong>{document.name}</strong>
                </div>

                <div className="document-summary-field">
                  <span>{tr("Client")}</span>
                  <strong>{document.client?.full_name ?? tr("Unlinked")}</strong>
                </div>

                <div className="document-summary-field">
                  <span>{tr("Case")}</span>
                  <strong>
                    {document.case?.case_number ?? document.case?.case_type ?? tr("Unlinked")}
                  </strong>
                </div>

                <div className="document-summary-field">
                  <span>{tr("Uploaded by")}</span>
                  <strong>
                    {document.uploaded_by_name ??
                      document.uploaded_by_staff?.full_name ??
                      tr("Unknown")}
                  </strong>
                </div>

                <div className="document-summary-field">
                  <span>{tr("Created")}</span>
                  <strong>{formatDate(document.created_at)}</strong>
                </div>

                <div className="document-summary-field">
                  <span>{tr("Last updated")}</span>
                  <strong>{formatDate(document.updated_at)}</strong>
                </div>

                <div className="document-summary-field">
                  <span>{tr("File size")}</span>
                  <strong>{formatFileSize(document.size_bytes)}</strong>
                </div>

                <div className="document-summary-field">
                  <span>{tr("MIME type")}</span>
                  <strong>{document.mime_type ?? tr("Unknown")}</strong>
                </div>

                <div className="document-summary-field">
                  <span>{tr("Version")}</span>
                  <strong>{document.version}</strong>
                </div>

                {document.description && (
                  <div className="document-summary-field document-summary-description">
                    <span>{tr("Description")}</span>
                    <p>{document.description}</p>
                  </div>
                )}
              </div>

              <div className="document-details-preview-panel">
                <div className="document-details-preview-header">
                  <div>
                    <span>{tr("Preview")}</span>
                    <strong>{documentType}</strong>
                  </div>
                  <div className="document-details-preview-status">
                    {previewLoading ? tr("Loading preview…") : previewType === 'none' ? tr("Preview unavailable") : tr("Preview available")}
                  </div>
                </div>

                {previewLoading ? (
                  <div className="document-details-preview-loading">{tr("Preparing preview…")}</div>
                ) : previewError ? (
                  <div className="document-details-preview-error" role="alert">
                    {previewError}
                  </div>
                ) : previewUrl ? (
                  previewType === 'pdf' ? (
                    <iframe
                      title={tr("Document preview")}
                      src={previewUrl}
                      className="document-preview-frame"
                    />
                  ) : previewType === 'image' ? (
                    <img
                      src={previewUrl}
                      alt={document.name}
                      className="document-preview-image"
                    />
                  ) : previewType === 'html' ? (
                    <iframe
                      title={tr("Agreement preview")}
                      srcDoc={htmlPreview ?? ''}
                      sandbox=""
                      className="document-preview-frame document-preview-html"
                    />
                  ) : previewType === 'text' ? (
                    <pre className="document-preview-text">
                      {textPreview || tr("Loading preview…")}
                    </pre>
                  ) : null
                ) : (
                  <div className="document-preview-empty">
                    <FileText size={24} />
                    <p>{tr("Preview is not available for this file type. Use Open or Download to view the document.")}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="document-details-empty">{tr("Document details are not available.")}</div>
          )}
        </div>

        <footer className="document-details-actions">
          <button
            type="button"
            className="secondary-action-button"
            onClick={onClose}
          >{tr("Close")}</button>

          <div className="document-details-actions-right">
            <button
              type="button"
              className="secondary-action-button"
              onClick={onOpenFile}
              disabled={loading}
            >
              <ExternalLink size={16} />{tr("Open file")}</button>

            <button
              type="button"
              className="secondary-action-button"
              onClick={onDownload}
              disabled={loading}
            >
              <Download size={16} />{tr("Download")}</button>

            <button
              type="button"
              className="primary-action-button danger"
              onClick={onDelete}
              disabled={loading}
            >
              <LockKeyhole size={16} />{tr("Delete")}</button>
          </div>
        </footer>
      </section>
    </div>,
    window.document.body,
  );
}

function addPreviewContentPolicy(html: string) {
  const policy = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: blob: https:; style-src \'unsafe-inline\'; font-src data:;">';

  if (/<head(?:\s[^>]*)?>/i.test(html)) {
    return html.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${policy}`);
  }

  return `<!doctype html><html><head>${policy}</head><body>${html}</body></html>`;
}
