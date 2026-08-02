import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText } from 'lucide-react';
import { getRecentDocuments, openDocument, downloadDocument } from '../../services/documentService';
import type { DocumentWithRelations } from '../../types/document';
import './RecentDocuments.css';

export function RecentDocuments() {
  const [documents, setDocuments] = useState<DocumentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDocuments() {
      try {
        setLoading(true);
        setError(null);

        const rows = await getRecentDocuments(5);

        if (active) {
          setDocuments(rows);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load recent documents.',
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadDocuments();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="dashboard-panel recent-documents-panel">
      <div className="recent-documents-header">
        <div>
          <span className="recent-eyebrow">DOCUMENTS</span>
          <h3>Recent documents</h3>
          <p>Latest files uploaded into the central documents module.</p>
        </div>

        <div className="recent-header-icon">
          <FileText size={22} />
        </div>
      </div>

      {loading ? (
        <div className="dashboard-widget-state">
          Loading recent documents...
        </div>
      ) : error ? (
        <div className="dashboard-widget-state error">
          <FileText size={16} />
          <span>{error}</span>
        </div>
      ) : documents.length === 0 ? (
        <div className="dashboard-widget-state">
          <FileText size={22} />
          <span>No documents have been uploaded yet.</span>
        </div>
      ) : (
        <div className="recent-document-list">
          {documents.map((document) => (
            <article
              key={document.id}
              className="recent-document-card"
            >
              <div className="recent-document-main">
                <div className="recent-document-title">
                  <strong>{document.name}</strong>
                  <span>{document.document_type || document.mime_type || 'Document'}</span>
                </div>

                <div className="recent-document-meta">
                  <span>{document.case?.case_number || document.client?.full_name || 'General'}</span>
                  <span>{new Intl.DateTimeFormat('en-AE', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  }).format(new Date(document.created_at))}</span>
                </div>
              </div>

              <div className="recent-document-actions">
                <button
                  type="button"
                  onClick={async () => {
                    setActionId(document.id);
                    try {
                      await openDocument(document);
                    } finally {
                      setActionId(null);
                    }
                  }}
                  disabled={actionId === document.id}
                  title="Open document"
                >
                  <ExternalLink size={16} />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setActionId(document.id);
                    try {
                      await downloadDocument(document);
                    } finally {
                      setActionId(null);
                    }
                  }}
                  disabled={actionId === document.id}
                  title="Download document"
                >
                  <Download size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
