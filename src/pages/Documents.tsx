import { tr, getLocale, useLocale } from '../i18n/locale';
import {
  Download,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  LayoutGrid,
  List,
  LockKeyhole,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  useSearchParams,
} from 'react-router-dom';

import {
  deleteDocument,
  downloadDocument,
  getDocumentById,
  getDocuments,
  openDocument,
  uploadDocument,
} from '../services/documentService';

import {
  getClientOptions,
  getCaseOptions,
  type ClientOption,
  type CaseOption,
} from '../services/taskService';

import type {
  DocumentWithRelations,
  DocumentUploadInput,
} from '../types/document';

import { DocumentDetailsModal } from '../components/documents/DocumentDetailsModal';
import { DeletionRequestModal } from '../components/staff/DeletionRequestModal';
import { useAccessProfile } from '../hooks/useAccessProfile';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import './Documents.css';

const PAGE_SIZE = 15;

type UploadFormState = {
  name: string;
  document_type: string;
  client_id: string;
  case_id: string;
  description: string;
  is_confidential: boolean;
};

type DocumentFolder = {
  id: string;
  name: string;
  cases: Array<{
    id: string;
    name: string;
    documents: DocumentWithRelations[];
  }>;
  documentCount: number;
};

const emptyUploadForm: UploadFormState = {
  name: '',
  document_type: '',
  client_id: '',
  case_id: '',
  description: '',
  is_confidential: true,
};

export function Documents() {
  const interfaceLanguage = useLocale();
  const { profile } = useAccessProfile();
  const administrator = profile?.access_role === 'administrator' && profile.is_active;
  const [documents, setDocuments] =
    useState<DocumentWithRelations[]>([]);

  const [clients, setClients] =
    useState<ClientOption[]>([]);

  const [cases, setCases] =
    useState<CaseOption[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState('');

  const [searchParams, setSearchParams] =
    useSearchParams();

  const staffIdFromUrl =
    searchParams.get('staffId') ?? 'all';

  const [clientFilter, setClientFilter] =
    useState<string | 'all'>('all');

  const [caseFilter, setCaseFilter] =
    useState<string | 'all'>('all');

  const [documentDetailsOpen, setDocumentDetailsOpen] =
    useState(false);

  const [selectedDocument, setSelectedDocument] =
    useState<DocumentWithRelations | null>(null);

  const [deletionRequestTarget, setDeletionRequestTarget] =
    useState<DocumentWithRelations | null>(null);

  const [detailsLoading, setDetailsLoading] =
    useState(false);

  const [confidentialFilter, setConfidentialFilter] =
    useState<'all' | 'confidential' | 'standard'>('all');

  const [page, setPage] =
    useState(1);

  const [totalCount, setTotalCount] =
    useState(0);

  const [uploadOpen, setUploadOpen] =
    useState(false);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [uploadForm, setUploadForm] =
    useState<UploadFormState>(emptyUploadForm);

  const [uploadLoading, setUploadLoading] =
    useState(false);

  const [actionDocumentId, setActionDocumentId] =
    useState<string | null>(null);

  const [viewMode, setViewMode] =
    useState<'folders' | 'list'>('folders');

  const [detailsError, setDetailsError] =
    useState<string | null>(null);

  const openDocumentDetails = useCallback(
    async (documentId: string) => {
      setDetailsLoading(true);
      setDetailsError(null);

      try {
        const document = await getDocumentById(documentId);

        if (!document) {
          throw new Error('Document not found.');
        }

        setSelectedDocument(document);
        setDocumentDetailsOpen(true);
      } catch (detailsFetchError) {
        setDetailsError(
          detailsFetchError instanceof Error
            ? detailsFetchError.message
            : 'Unable to load document details.',
        );
      } finally {
        setDetailsLoading(false);
      }
    },
    [],
  );

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getDocuments({
        search,
        clientId: clientFilter,
        caseId: caseFilter,
        staffId: staffIdFromUrl,
        confidential:
          confidentialFilter === 'all'
            ? 'all'
            : confidentialFilter === 'confidential',
        page,
        pageSize: PAGE_SIZE,
      });

      setDocuments(result.data);
      setTotalCount(result.count);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Unable to load documents.',
      );
    } finally {
      setLoading(false);
    }
  }, [
    search,
    clientFilter,
    caseFilter,
    staffIdFromUrl,
    confidentialFilter,
    page,
  ]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  useRealtimeRefresh(
    ['documents', 'clients', 'cases'],
    fetchDocuments,
  );

  useEffect(() => {
    async function loadOptions() {
      try {
        const [clientOptions, caseOptions] =
          await Promise.all([
            getClientOptions(),
            getCaseOptions(),
          ]);

        setClients(clientOptions);
        setCases(caseOptions);

        const caseId = searchParams.get('caseId');
        const clientId = searchParams.get('clientId');
        const upload = searchParams.get('upload');
        const documentId = searchParams.get('documentId');

        if (clientId) {
          setClientFilter(clientId);
        }

        if (caseId) {
          setCaseFilter(caseId);
        }

        if (upload === '1') {
          let resolvedClientId = clientId;

          if (!resolvedClientId && caseId) {
            const matched = caseOptions.find(
              (caseItem) => caseItem.id === caseId,
            );
            resolvedClientId = matched?.client_id ?? null;
          }

          setUploadForm((current) => ({
            ...current,
            client_id: resolvedClientId ?? current.client_id,
            case_id: caseId ?? current.case_id,
          }));

          setUploadOpen(true);
          const nextParams = new URLSearchParams(searchParams);
          nextParams.delete('upload');
          setSearchParams(nextParams, { replace: true });
        }

        if (documentId) {
          void openDocumentDetails(documentId);
        }
      } catch (optionsError) {
        setError(
          optionsError instanceof Error
            ? optionsError.message
            : 'Unable to load client and case options.',
        );
      }
    }

    void loadOptions();
  }, [searchParams, setSearchParams, openDocumentDetails]);

  const filteredUploadCases = useMemo(() => {
    if (!uploadForm.client_id) {
      return [];
    }

    return cases.filter(
      (caseItem) =>
        caseItem.client_id === uploadForm.client_id,
    );
  }, [cases, uploadForm.client_id, interfaceLanguage]);

  const filteredCaseOptions = useMemo(() => {
    if (clientFilter === 'all') {
      return cases;
    }

    return cases.filter(
      (caseItem) =>
        caseItem.client_id === clientFilter,
    );
  }, [cases, clientFilter, interfaceLanguage]);

  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / PAGE_SIZE),
  );

  const documentFolders = useMemo<DocumentFolder[]>(() => {
    const clientFolders = new Map<
      string,
      {
        id: string;
        name: string;
        cases: Map<
          string,
          {
            id: string;
            name: string;
            documents: DocumentWithRelations[];
          }
        >;
      }
    >();

    documents.forEach((document) => {
      const clientId = document.client?.id ?? 'unlinked';
      const clientName = document.client?.full_name ?? 'Unlinked documents';
      const caseId = document.case?.id ?? 'client-files';
      const caseName = document.case
        ? document.case.case_number || document.case.case_type
        : 'General client documents';

      let clientFolder = clientFolders.get(clientId);

      if (!clientFolder) {
        clientFolder = {
          id: clientId,
          name: clientName,
          cases: new Map(),
        };
        clientFolders.set(clientId, clientFolder);
      }

      let caseFolder = clientFolder.cases.get(caseId);

      if (!caseFolder) {
        caseFolder = {
          id: caseId,
          name: caseName,
          documents: [],
        };
        clientFolder.cases.set(caseId, caseFolder);
      }

      caseFolder.documents.push(document);
    });

    return Array.from(clientFolders.values())
      .map((clientFolder) => {
        const caseFolders = Array.from(clientFolder.cases.values())
          .sort((left, right) => left.name.localeCompare(right.name));

        return {
          id: clientFolder.id,
          name: clientFolder.name,
          cases: caseFolders,
          documentCount: caseFolders.reduce(
            (total, caseFolder) => total + caseFolder.documents.length,
            0,
          ),
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [documents, interfaceLanguage]);

  const clearFilters = () => {
    setSearch('');
    setClientFilter('all');
    setCaseFilter('all');
    setConfidentialFilter('all');
    setPage(1);
  };

  const closeUpload = () => {
    if (uploadLoading) {
      return;
    }

    setUploadOpen(false);
    setSelectedFile(null);
    setUploadForm(emptyUploadForm);
  };

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file =
      event.target.files?.[0] ?? null;

    setSelectedFile(file);

    if (file && !uploadForm.name) {
      setUploadForm((current) => ({
        ...current,
        name: file.name,
      }));
    }
  };

  const handleUpload = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!selectedFile) {
      setError('Please select a file.');
      return;
    }

    setUploadLoading(true);
    setError(null);

    try {
      const input: DocumentUploadInput = {
        file: selectedFile,

        name:
          uploadForm.name.trim() ||
          selectedFile.name,

        document_type:
          uploadForm.document_type.trim() ||
          null,

        client_id:
          uploadForm.client_id ||
          null,

        case_id:
          uploadForm.case_id ||
          null,

        uploaded_by_staff_id:
          null,

        is_confidential:
          uploadForm.is_confidential,

        description:
          uploadForm.description.trim() ||
          null,
      };

      await uploadDocument(input);

      closeUpload();

      if (page !== 1) {
        setPage(1);
      } else {
        await fetchDocuments();
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Unable to upload document.',
      );
    } finally {
      setUploadLoading(false);
    }
  };

  const handleShowDetails = (
    document: DocumentWithRelations,
  ) => {
    setSelectedDocument(document);
    setDocumentDetailsOpen(true);
    setDetailsError(null);
  };

  const handleOpenFile = async () => {
    if (!selectedDocument) {
      return;
    }

    setDetailsError(null);

    try {
      await openDocument(selectedDocument);
    } catch (actionError) {
      setDetailsError(
        actionError instanceof Error
          ? actionError.message
          : 'Unable to open document.',
      );
    }
  };

  const handleDownload = async (
    document: DocumentWithRelations,
  ) => {
    setActionDocumentId(document.id);
    setError(null);

    try {
      await downloadDocument(document);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'Unable to download document.',
      );
    } finally {
      setActionDocumentId(null);
    }
  };

  const closeDetails = () => {
    if (detailsLoading) {
      return;
    }

    setDocumentDetailsOpen(false);
    setSelectedDocument(null);
    setDetailsError(null);
  };

  const handleDelete = async (
    document: DocumentWithRelations,
  ) => {
    const confirmed = window.confirm(
      tr("Delete \"{0}\"? This will remove both the database record and the stored file.", [document.name]),
    );

    if (!confirmed) {
      return;
    }

    setActionDocumentId(document.id);
    setError(null);

    try {
      await deleteDocument(document);

      if (
        documents.length === 1 &&
        page > 1
      ) {
        setPage((current) =>
          Math.max(1, current - 1),
        );
      } else {
        await fetchDocuments();
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Unable to delete document.',
      );
    } finally {
      setActionDocumentId(null);
    }
  };

  const beginDelete = async (document: DocumentWithRelations) => {
    if (!administrator) {
      setDeletionRequestTarget(document);
      return;
    }
    await handleDelete(document);
  };

  const hasFilters =
    search.trim().length > 0 ||
    clientFilter !== 'all' ||
    caseFilter !== 'all' ||
    confidentialFilter !== 'all';

  return (
    <div className="documents-page page-container">
      <section className="page-heading documents-heading">
        <div>
          <p className="page-eyebrow">{tr("Document management")}</p>

          <h2>{tr("Documents")}</h2>

          <p className="page-intro">{tr("Store, review and manage confidential legal files linked to clients and matters.")}</p>
        </div>

        <button
          type="button"
          className="primary-action-button"
          onClick={() => setUploadOpen(true)}
        >
          <Upload size={18} />{tr("Upload Document")}</button>
      </section>

      {(clientFilter !== 'all' || caseFilter !== 'all') && (
        <section className="documents-context-banner">
          <div>
            <strong>
              {caseFilter !== 'all'
                ? tr("Documents for case")
                : tr("Documents for client")}
              <span>
                {caseFilter !== 'all'
                  ? cases.find((caseItem) => caseItem.id === caseFilter)
                      ?.case_number ?? caseFilter
                  : clients.find((client) => client.id === clientFilter)
                      ?.full_name ?? clientFilter}
              </span>
            </strong>
          </div>

          <button
            type="button"
            className="secondary-action-button"
            onClick={() => {
              setClientFilter('all');
              setCaseFilter('all');
              setPage(1);
              setSearchParams({}, { replace: true });
            }}
          >{tr("Clear context")}</button>
        </section>
      )}

      <section className="documents-summary-grid">
        <article className="document-summary-card">
          <div className="document-summary-icon">
            <FileText size={20} />
          </div>

          <div>
            <span>{tr("Total Documents")}</span>
            <strong>{totalCount}</strong>
          </div>
        </article>

        <article className="document-summary-card">
          <div className="document-summary-icon">
            <LockKeyhole size={20} />
          </div>

          <div>
            <span>{tr("Confidential")}</span>
            <strong>
              {
                documents.filter(
                  (document) =>
                    document.is_confidential,
                ).length
              }
            </strong>
          </div>
        </article>
      </section>

      <section className="documents-toolbar">
        <div className="documents-search">
          <Search size={18} />

          <input dir="auto"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={tr("Search document name, type or description")}
          />
        </div>

        <div className="documents-filters">
          <label>
            <span>{tr("Client")}</span>

            <select
              value={clientFilter}
              onChange={(event) => {
                const value =
                  event.target.value;

                setClientFilter(value);
                setCaseFilter('all');
                setPage(1);
              }}
            >
              <option value="all">{tr("All clients")}</option>

              {clients.map((client) => (
                <option
                  key={client.id}
                  value={client.id}
                >
                  {client.full_name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>{tr("Case")}</span>

            <select
              value={caseFilter}
              onChange={(event) => {
                setCaseFilter(
                  event.target.value,
                );
                setPage(1);
              }}
            >
              <option value="all">{tr("All cases")}</option>

              {filteredCaseOptions.map(
                (caseItem) => (
                  <option
                    key={caseItem.id}
                    value={caseItem.id}
                  >
                    {caseItem.case_number ||
                      caseItem.case_type}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            <span>{tr("Privacy")}</span>

            <select
              value={confidentialFilter}
              onChange={(event) => {
                setConfidentialFilter(
                  event.target.value as
                    | 'all'
                    | 'confidential'
                    | 'standard',
                );

                setPage(1);
              }}
            >
              <option value="all">{tr("All documents")}</option>

              <option value="confidential">{tr("Confidential")}</option>

              <option value="standard">{tr("Standard")}</option>
            </select>
          </label>
        </div>
      </section>

      <section className="documents-register-heading">
        <div>
          <strong>
            {hasFilters
              ? tr("Filtered Documents")
              : tr("Document Register")}
          </strong>

          <span>
            {totalCount}{' '}
            {totalCount === 1
              ? tr("document")
              : tr("documents")}
          </span>
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
          >{tr("Clear filters")}</button>
        )}

        <div className="documents-view-switch" aria-label={tr("Document view")}>
          <button
            type="button"
            className={viewMode === 'folders' ? 'active' : ''}
            onClick={() => setViewMode('folders')}
            aria-pressed={viewMode === 'folders'}
          >
            <LayoutGrid size={15} />{tr("Folders")}</button>
          <button
            type="button"
            className={viewMode === 'list' ? 'active' : ''}
            onClick={() => setViewMode('list')}
            aria-pressed={viewMode === 'list'}
          >
            <List size={15} />{tr("List")}</button>
        </div>
      </section>

      {error && (
        <div
          className="documents-error"
          role="alert"
        >
          {tr(error)}
        </div>
      )}

      {viewMode === 'folders' && (
        <section className="documents-folder-view">
          {loading ? (
            <div className="documents-folder-state">{tr("Loading folders…")}</div>
          ) : documentFolders.length === 0 ? (
            <div className="documents-folder-state">{tr("No documents found.")}</div>
          ) : (
            documentFolders.map((clientFolder) => (
              <details
                className="documents-client-folder"
                key={clientFolder.id}
                open
              >
                <summary>
                  <span className="documents-folder-icon">
                    <FolderOpen size={21} />
                  </span>
                  <span>
                    <strong>{clientFolder.name}</strong>
                    <small>
                      {clientFolder.documentCount}{' '}
                      {clientFolder.documentCount === 1
                        ? tr("document")
                        : tr("documents")}
                    </small>
                  </span>
                </summary>

                <div className="documents-case-folders">
                  {clientFolder.cases.map((caseFolder) => (
                    <details
                      className="documents-case-folder"
                      key={caseFolder.id}
                      open
                    >
                      <summary>
                        <Folder size={18} />
                        <strong>{caseFolder.name}</strong>
                        <small>{caseFolder.documents.length}</small>
                      </summary>

                      <div className="documents-folder-files">
                        {caseFolder.documents.map((document) => {
                          const actionLoading = actionDocumentId === document.id;

                          return (
                            <article
                              className="documents-folder-file"
                              key={document.id}
                            >
                              <div className="document-file-icon">
                                <FileText size={18} />
                              </div>
                              <div className="documents-folder-file-main">
                                <strong>{document.name}</strong>
                                <span>
                                  {document.document_type ??
                                    getFileTypeLabel(document.mime_type)}
                                  {' · '}
                                  {formatFileSize(document.size_bytes)}
                                  {' · '}{tr("Uploaded by")}{' '}
                                  {document.uploaded_by_name ??
                                    document.uploaded_by_staff?.full_name ??
                                    tr("Unknown")}
                                </span>
                              </div>
                              <time>{formatDate(document.created_at)}</time>
                              <div className="document-actions">
                                <button
                                  type="button"
                                  onClick={() => handleShowDetails(document)}
                                  disabled={actionLoading}
                                  title={tr("View details")}
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDownload(document)}
                                  disabled={actionLoading}
                                  title={tr("Download")}
                                >
                                  <Download size={16} />
                                </button>
                                <button
                                  type="button"
                                  className="danger"
                                  onClick={() => void beginDelete(document)}
                                  disabled={actionLoading}
                                  title={administrator ? tr("Delete") : tr("Request deletion")}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            ))
          )}
        </section>
      )}

      {viewMode === 'list' && (
        <section className="documents-table-wrapper">
        <table className="documents-table">
          <thead>
            <tr>
              <th>{tr("Document")}</th>
              <th>{tr("Client")}</th>
              <th>{tr("Case")}</th>
              <th>{tr("Type")}</th>
              <th>{tr("Privacy")}</th>
              <th>{tr("Size")}</th>
              <th>{tr("Uploaded")}</th>
              <th>{tr("Uploaded by")}</th>
              <th>{tr("Actions")}</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={9}
                  className="documents-state-cell"
                >{tr("Loading documents…")}</td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="documents-state-cell"
                >{tr("No documents found.")}</td>
              </tr>
            ) : (
              documents.map((document) => {
                const actionLoading =
                  actionDocumentId ===
                  document.id;

                return (
                  <tr key={document.id}>
                    <td className="document-name-cell">
                      <div className="document-file-icon">
                        <FileText size={18} />
                      </div>

                      <div>
                        <strong>
                          {document.name}
                        </strong>

                        {document.description && (
                          <span>
                            {document.description}
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      {document.client?.full_name ??
                        '—'}
                    </td>

                    <td>
                      {document.case?.case_number ??
                        document.case?.case_type ??
                        '—'}
                    </td>

                    <td>
                      {document.document_type ??
                        getFileTypeLabel(
                          document.mime_type,
                        )}
                    </td>

                    <td>
                      <span
                        className={
                          document.is_confidential
                            ? 'document-privacy-badge confidential'
                            : 'document-privacy-badge standard'
                        }
                      >
                        {document.is_confidential
                          ? tr("Confidential")
                          : tr("Standard")}
                      </span>
                    </td>

                    <td>
                      {formatFileSize(
                        document.size_bytes,
                      )}
                    </td>

                    <td>
                      {formatDate(
                        document.created_at,
                      )}
                    </td>

                    <td>
                      {document.uploaded_by_name ??
                        document.uploaded_by_staff?.full_name ??
                        tr("Unknown")}
                    </td>

                    <td>
                      <div className="document-actions">
                        <button
                          type="button"
                          onClick={() =>
                            handleShowDetails(
                              document,
                            )
                          }
                          disabled={actionLoading}
                          title={tr("View details")}
                        >
                          <Eye size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void handleDownload(
                              document,
                            )
                          }
                          disabled={actionLoading}
                          title={tr("Download")}
                        >
                          <Download size={16} />
                        </button>

                        <button
                          type="button"
                          className="danger"
                          onClick={() =>
                            void beginDelete(
                              document,
                            )
                          }
                          disabled={actionLoading}
                          title={administrator ? tr("Delete") : tr("Request deletion")}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </section>
      )}

      {totalPages > 1 && (
        <section className="documents-pagination">
          <button
            type="button"
            onClick={() =>
              setPage((current) =>
                Math.max(1, current - 1),
              )
            }
            disabled={page <= 1 || loading}
          >{tr("Previous")}</button>

          <span>{tr("Page")}{" "}{page}{" "}{tr("of")}{" "}{totalPages}
          </span>

          <button
            type="button"
            onClick={() =>
              setPage((current) =>
                Math.min(
                  totalPages,
                  current + 1,
                ),
              )
            }
            disabled={
              page >= totalPages || loading
            }
          >{tr("Next")}</button>
        </section>
      )}

      {uploadOpen && (
        <div className="document-modal-layer">
          <button
            type="button"
            className="document-modal-backdrop"
            onClick={closeUpload}
            aria-label={tr("Close upload form")}
          />

          <section
            className="document-modal"
            role="dialog"
            aria-modal="true"
          >
            <header className="document-modal-header">
              <div>
                <p className="page-eyebrow">{tr("Secure file upload")}</p>

                <h3>{tr("Upload Document")}</h3>
              </div>

              <button
                type="button"
                onClick={closeUpload}
                disabled={uploadLoading}
              >
                ×
              </button>
            </header>

            <form
              className="document-upload-form"
              onSubmit={handleUpload}
            >
              <label className="document-form-field document-form-wide">
                <span>{tr("File")}</span>

                <input
                  type="file"
                  required
                  onChange={handleFileChange}
                />
              </label>

              <label className="document-form-field document-form-wide">
                <span>{tr("Document Name")}</span>

                <input dir="auto"
                  value={uploadForm.name}
                  onChange={(event) =>
                    setUploadForm(
                      (current) => ({
                        ...current,
                        name:
                          event.target.value,
                      }),
                    )
                  }
                  placeholder={tr("Document name")}
                />
              </label>

              <label className="document-form-field">
                <span>{tr("Client")}</span>

                <select
                  value={uploadForm.client_id}
                  onChange={(event) =>
                    setUploadForm(
                      (current) => ({
                        ...current,
                        client_id:
                          event.target.value,
                        case_id: '',
                      }),
                    )
                  }
                >
                  <option value="">{tr("No client")}</option>

                  {clients.map((client) => (
                    <option
                      key={client.id}
                      value={client.id}
                    >
                      {client.full_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="document-form-field">
                <span>{tr("Case")}</span>

                <select
                  value={uploadForm.case_id}
                  onChange={(event) =>
                    setUploadForm(
                      (current) => ({
                        ...current,
                        case_id:
                          event.target.value,
                      }),
                    )
                  }
                  disabled={
                    !uploadForm.client_id
                  }
                >
                  <option value="">{tr("No case")}</option>

                  {filteredUploadCases.map(
                    (caseItem) => (
                      <option
                        key={caseItem.id}
                        value={caseItem.id}
                      >
                        {caseItem.case_number ||
                          caseItem.case_type}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="document-form-field">
                <span>{tr("Document Type")}</span>

                <input dir="auto"
                  value={
                    uploadForm.document_type
                  }
                  onChange={(event) =>
                    setUploadForm(
                      (current) => ({
                        ...current,
                        document_type:
                          event.target.value,
                      }),
                    )
                  }
                  placeholder={tr("Legal notice, evidence, contract...")}
                />
              </label>

              <label className="document-confidential-field">
                <input
                  type="checkbox"
                  checked={
                    uploadForm.is_confidential
                  }
                  onChange={(event) =>
                    setUploadForm(
                      (current) => ({
                        ...current,
                        is_confidential:
                          event.target.checked,
                      }),
                    )
                  }
                />

                <span>{tr("Confidential document")}</span>
              </label>

              <label className="document-form-field document-form-wide">
                <span>{tr("Description")}</span>

                <textarea dir="auto"
                  value={
                    uploadForm.description
                  }
                  onChange={(event) =>
                    setUploadForm(
                      (current) => ({
                        ...current,
                        description:
                          event.target.value,
                      }),
                    )
                  }
                  rows={4}
                  placeholder={tr("Internal document description")}
                />
              </label>

              <footer className="document-form-actions">
                <button
                  type="button"
                  className="secondary-action-button"
                  onClick={closeUpload}
                  disabled={uploadLoading}
                >{tr("Cancel")}</button>

                <button
                  type="submit"
                  className="primary-action-button"
                  disabled={uploadLoading}
                >
                  <Plus size={17} />

                  {uploadLoading
                    ? tr("Uploading…")
                    : tr("Upload Document")}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      <DocumentDetailsModal
        open={documentDetailsOpen}
        document={selectedDocument}
        loading={detailsLoading}
        error={tr(detailsError)}
        onClose={closeDetails}
        onOpenFile={handleOpenFile}
        onDownload={async () => {
          if (!selectedDocument) {
            return;
          }
          await downloadDocument(selectedDocument);
        }}
        onDelete={async () => {
          if (!selectedDocument) {
            return;
          }
          if (!administrator) {
            setDeletionRequestTarget(selectedDocument);
            closeDetails();
            return;
          }
          const confirmed = window.confirm(
            tr("Delete \"{0}\"? This will remove both the database record and the stored file.", [selectedDocument.name]),
          );
          if (!confirmed) {
            return;
          }

          try {
            await deleteDocument(selectedDocument);
            closeDetails();
            await fetchDocuments();
          } catch (deleteError) {
            setDetailsError(
              deleteError instanceof Error
                ? deleteError.message
                : 'Unable to delete document.',
            );
          }
        }}
      />

      <DeletionRequestModal
        open={!administrator && Boolean(deletionRequestTarget)}
        entityType="document"
        recordId={deletionRequestTarget?.id ?? null}
        recordLabel={deletionRequestTarget?.name ?? tr("Document record")}
        onClose={() => setDeletionRequestTarget(null)}
      />
    </div>
  );
}

function formatDate(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat(getLocale("en-GB"), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatFileSize(
  value?: number | null,
): string {
  const bytes = Number(value ?? 0);

  if (!bytes) {
    return '—';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function getFileTypeLabel(
  mimeType?: string | null,
): string {
  if (!mimeType) {
    return 'File';
  }

  if (
    mimeType ===
    'application/pdf'
  ) {
    return 'PDF';
  }

  if (
    mimeType.includes('word')
  ) {
    return 'Word';
  }

  if (
    mimeType.includes('sheet') ||
    mimeType.includes('excel')
  ) {
    return 'Spreadsheet';
  }

  if (
    mimeType.startsWith('image/')
  ) {
    return 'Image';
  }

  return 'File';
}
