import { tr, useLocale } from '../i18n/locale';
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  LoaderCircle,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';

import { readImportWorkbook } from '../services/importWorkbookService';

import {
  createAutomaticMapping,
  getImportFields,
  validateMappedRows,
  type ImportFieldMapping,
} from '../services/importMappingService';

import {
  importClients,
  prepareClientImportRows,
  scanClientImportDuplicates,
  type ClientImportResult,
  type ClientImportScanResult,
} from '../services/clientImportService';

import type {
  ImportEntityType,
  ImportWorkbook,
} from '../types/import';

import './Imports.css';

export function Imports() {
  const interfaceLanguage = useLocale();
  const [workbook, setWorkbook] =
    useState<ImportWorkbook | null>(null);

  const [selectedSheetName, setSelectedSheetName] =
    useState('');

  const [entityType, setEntityType] =
    useState<ImportEntityType>('clients');

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);
    const [mapping, setMapping] =
  useState<ImportFieldMapping>({});

  const [clientScan, setClientScan] =
    useState<ClientImportScanResult | null>(null);

  const [importResult, setImportResult] =
    useState<ClientImportResult | null>(null);

  const [scanning, setScanning] =
    useState(false);

  const [importing, setImporting] =
    useState(false);

  const [confirmingImport, setConfirmingImport] =
    useState(false);

  const [importError, setImportError] =
    useState<string | null>(null);

  const selectedSheet = useMemo(
    () =>
      workbook?.sheets.find(
        (sheet) =>
          sheet.name === selectedSheetName,
      ) ??
      workbook?.sheets[0] ??
      null,
    [workbook, selectedSheetName, interfaceLanguage],
  );

  const importFields = useMemo(
  () => getImportFields(entityType),
  [entityType, interfaceLanguage],
);

const validation = useMemo(
  () =>
    selectedSheet
      ? validateMappedRows(
          selectedSheet.rows,
          entityType,
          mapping,
        )
      : null,
  [
    selectedSheet,
    entityType,
    mapping,
  , interfaceLanguage],
);

useEffect(() => {
    setClientScan(null);
    setImportResult(null);
    setImportError(null);
    setConfirmingImport(false);

    if (!selectedSheet) {
    setMapping({});
    return;
  }

  setMapping(
    createAutomaticMapping(
      selectedSheet.headers,
      entityType,
    ),
  );
}, [
  selectedSheet,
  entityType,
]);

  async function handleScanClients() {
    if (
      entityType !== 'clients' ||
      !selectedSheet ||
      !workbook
    ) {
      return;
    }

    if (
      !validation ||
      validation.invalidRows > 0
    ) {
      setImportError(
        'Resolve validation errors before scanning for duplicates.',
      );

      return;
    }

    setScanning(true);
    setImportError(null);
    setImportResult(null);

    try {
      const preparedRows =
        prepareClientImportRows(
          selectedSheet.rows,
          mapping,
          workbook.fileName,
        );

      const result =
        await scanClientImportDuplicates(
          preparedRows,
        );

      setClientScan(result);
    } catch (scanError) {
      setImportError(
        scanError instanceof Error
          ? scanError.message
          : 'Unable to scan clients for duplicates.',
      );
    } finally {
      setScanning(false);
    }
  }

  async function handleImportClients() {
    if (
      !clientScan ||
      clientScan.newRows.length === 0
    ) {
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      const result =
        await importClients(
          clientScan.newRows,
        );

      setImportResult({
        ...result,
        processed:
          clientScan.preparedRows.length,
        skipped:
          clientScan.duplicates.length,
      });

      setConfirmingImport(false);
    } catch (clientImportError) {
      setImportError(
        clientImportError instanceof Error
          ? clientImportError.message
          : 'Unable to import clients.',
      );
    } finally {
      setImporting(false);
    }
  }


  async function processFile(file: File) {
    setLoading(true);
    setError(null);

    try {
      const result =
        await readImportWorkbook(file);

      setWorkbook(result);

      setSelectedSheetName(
        result.sheets[0]?.name ?? '',
      );
    } catch (err) {
      setWorkbook(null);

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to read workbook.',
      );
    } finally {
      setLoading(false);
    }
  }

  function handleInput(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (file) {
      void processFile(file);
    }

    event.target.value = '';
  }

  function handleDrop(
    event: DragEvent<HTMLLabelElement>,
  ) {
    event.preventDefault();

    const file =
      event.dataTransfer.files?.[0];

    if (file) {
      void processFile(file);
    }
  }
    function resetImport() {
    setWorkbook(null);
    setSelectedSheetName('');
    setMapping({});
    setError(null);
    setClientScan(null);
    setImportResult(null);
    setImportError(null);
    setConfirmingImport(false);
  }

  return (
    <div className="imports-page">
      <header className="imports-heading">
        <div>
          <span className="imports-eyebrow">{tr("DATA MIGRATION")}</span>

          <h2>{tr("Import Centre")}</h2>

          <p>{tr("Upload existing office records and review them before importing anything into SHAB.")}</p>
        </div>

        {workbook ? (
          <button
            type="button"
            className="imports-secondary-button"
            onClick={resetImport}
          >
            <RefreshCw size={16} />{tr("Start over")}</button>
        ) : null}
      </header>

      <section className="imports-progress">
        {[
          'Upload',
          'Configure',
          'Map fields',
          'Validate',
          'Import',
        ].map((step, index) => (
          <div
            key={step}
            className={
              index === 0 && workbook
                ? 'complete'
                : index === 0
                  ? 'active'
                  : ''
            }
          >
            <span>
              {index === 0 && workbook ? (
                <CheckCircle2 size={15} />
              ) : (
                index + 1
              )}
            </span>

            <strong>{step}</strong>
          </div>
        ))}
      </section>

      {!workbook ? (
        <section className="imports-upload-panel">
          <label
            className="imports-drop-zone"
            onDragOver={(event) =>
              event.preventDefault()
            }
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleInput}
              disabled={loading}
            />

            <div className="imports-upload-icon">
              {loading ? (
                <LoaderCircle
                  size={30}
                  className="imports-spinner"
                />
              ) : (
                <UploadCloud size={30} />
              )}
            </div>

            <h3>
              {loading
                ? tr("Reading workbook…")
                : tr("Upload an Excel or CSV file")}
            </h3>

            <p>{tr("Drag and drop your file here, or click to browse.")}</p>

            <small>{tr("XLSX, XLS or CSV · Maximum 25 MB")}</small>
          </label>

          {error ? (
            <div className="imports-error">
              <AlertCircle size={18} />
              <span>{tr(error)}</span>
            </div>
          ) : null}
        </section>
            ) : (
        <>
          <section className="imports-workbook-summary">
            <div>
              <FileSpreadsheet size={22} />

              <div>
                <span>{tr("Uploaded workbook")}</span>

                <strong>
                  {workbook.fileName}
                </strong>
              </div>
            </div>

            <div className="imports-workbook-stats">
              <span>
                <strong>
                  {workbook.sheets.length}
                </strong>{tr("Sheets")}</span>

              <span>
                <strong>
                  {workbook.sheets.reduce(
                    (total, sheet) =>
                      total + sheet.totalRows,
                    0,
                  )}
                </strong>{tr("Rows")}</span>
            </div>
          </section>

          <section className="imports-configuration-panel">
            <label>
              <span>{tr("Data type")}</span>

              <select
                value={entityType}
                onChange={(event) =>
                  setEntityType(
                    event.target
                      .value as ImportEntityType,
                  )
                }
              >
                <option value="clients">{tr("Clients")}</option>

                <option value="cases">{tr("Cases")}</option>
              </select>
            </label>

            <label>
              <span>{tr("Workbook sheet")}</span>

              <select
                value={selectedSheet?.name ?? ''}
                onChange={(event) =>
                  setSelectedSheetName(
                    event.target.value,
                  )
                }
              >
                {workbook.sheets.map(
                  (sheet) => (
                    <option
                      key={sheet.name}
                      value={sheet.name}
                    >
                      {sheet.name} ({sheet.totalRows}{" "}{tr("rows)")}</option>
                  ),
                )}
              </select>
            </label>
          </section>
          {selectedSheet ? (
            <section className="imports-mapping-panel">
              <header className="imports-mapping-heading">
                <div>
                  <span className="imports-eyebrow">{tr("FIELD MAPPING")}</span>

                  <h3>{tr("Match Excel columns to SHAB fields")}</h3>

                  <p>{tr("SHAB has automatically matched recognised headings. Review each selection before importing.")}</p>
                </div>

                <div className="imports-validation-summary">
                  <span className="valid">
                    <strong>
                      {validation?.validRows ?? 0}
                    </strong>{tr("Valid")}</span>

                  <span
                    className={
                      (validation?.invalidRows ?? 0) > 0
                        ? 'invalid'
                        : 'valid'
                    }
                  >
                    <strong>
                      {validation?.invalidRows ?? 0}
                    </strong>{tr("Errors")}</span>
                </div>
              </header>

              <div className="imports-mapping-grid">
                {importFields.map((field) => {
                  const selectedHeader =
                    mapping[field.key] ?? '';

                  return (
                    <label
                      key={field.key}
                      className={
                        field.required &&
                        !selectedHeader
                          ? 'mapping-missing'
                          : ''
                      }
                    >
                      <div>
                        <strong>
                          {field.label}
                        </strong>

                        {field.required ? (
                          <span>{tr("Required")}</span>
                        ) : (
                          <small>{tr("Optional")}</small>
                        )}
                      </div>

                      <select
                        value={selectedHeader}
                        onChange={(event) =>
                          setMapping((current) => ({
                            ...current,
                            [field.key]:
                              event.target.value,
                          }))
                        }
                      >
                        <option value="">{tr("Do not import")}</option>

                        {selectedSheet.headers.map(
                          (header) => (
                            <option
                              key={header}
                              value={header}
                            >
                              {header}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  );
                })}
              </div>

              {validation &&
              validation.issues.length > 0 ? (
                <div className="imports-validation-panel">
                  <div className="imports-validation-title">
                    <strong>{tr("Validation issues")}</strong>

                    <span>{tr("Showing first")}{' '}
                      {Math.min(
                        validation.issues.length,
                        20,
                      )}{' '}{tr("of")}{" "}{validation.issues.length}
                    </span>
                  </div>

                  <div className="imports-validation-list">
                    {validation.issues
                      .slice(0, 20)
                      .map((issue, index) => (
                        <div
                          key={`${issue.rowNumber}-${issue.field}-${index}`}
                        >
                          <span>{tr("Row")}{" "}{issue.rowNumber}
                          </span>

                          <strong>
                            {issue.field}
                          </strong>

                          <p>
                            {issue.message}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              ) : validation ? (
                <div className="imports-ready-panel">{tr("All mapped rows passed validation and are ready for the next stage.")}</div>
              ) : null}
            </section>
          ) : null}
          {selectedSheet &&
          entityType === 'clients' &&
          validation ? (
            <section className="imports-execution-panel">
              <div className="imports-execution-heading">
                <div>
                  <span className="imports-eyebrow">{tr("DUPLICATE REVIEW")}</span>

                  <h3>{tr("Review clients before import")}</h3>

                  <p>{tr("SHAB checks the workbook and existing client records before importing.")}</p>
                </div>

                {!clientScan ? (
                  <button
                    type="button"
                    className="imports-primary-button"
                    onClick={() =>
                      void handleScanClients()
                    }
                    disabled={
                      scanning ||
                      validation.invalidRows > 0
                    }
                  >
                    {scanning
                      ? tr("Scanning…")
                      : tr("Scan for duplicates")}
                  </button>
                ) : null}
              </div>

              {importError ? (
                <div className="imports-error">
                  <AlertCircle size={18} />
                  <span>{importError}</span>
                </div>
              ) : null}

              {clientScan ? (
                <>
                  <div className="imports-scan-summary">
                    <article>
                      <strong>
                        {clientScan.preparedRows.length}
                      </strong>

                      <span>{tr("Total rows")}</span>
                    </article>

                    <article className="new">
                      <strong>
                        {clientScan.newRows.length}
                      </strong>

                      <span>{tr("Ready to import")}</span>
                    </article>

                    <article className="duplicate">
                      <strong>
                        {clientScan.duplicates.filter(
                          (item) =>
                            item.source === 'workbook',
                        ).length}
                      </strong>

                      <span>{tr("Repeated in workbook")}</span>
                    </article>

                    <article className="database-duplicate">
                      <strong>
                        {clientScan.duplicates.filter(
                          (item) =>
                            item.source === 'database',
                        ).length}
                      </strong>

                      <span>{tr("Already in SHAB")}</span>
                    </article>
                  </div>

                  {clientScan.duplicates.length > 0 ? (
                    <div className="imports-duplicate-list">
                      {clientScan.duplicates
                        .slice(0, 20)
                        .map((duplicate, index) => (
                          <div
                            key={`${duplicate.rowNumber}-${duplicate.reason}-${index}`}
                          >
                            <span>{tr("Row")}{" "}{duplicate.rowNumber}
                            </span>

                            <strong>
                              {duplicate.clientName}
                            </strong>

                            <p>
                              {duplicate.source === 'database'
                                ? tr("Already exists in SHAB")
                                : tr("Repeated inside this workbook")}{' '}{tr("based on")}{' '}
                              {duplicate.reason.replace(
                                /_/g,
                                ' ',
                              )}
                              {duplicate.existingClientName
                                ? tr("— matched with {0}", [duplicate.existingClientName])
                                : ''}
                              .
                            </p>
                          </div>
                        ))}
                    </div>
                  ) : null}

                  {!importResult ? (
                    <>
                      {!confirmingImport ? (
                        <button
                          type="button"
                          className="imports-primary-button imports-import-button"
                          onClick={() =>
                            setConfirmingImport(true)
                          }
                          disabled={
                            importing ||
                            clientScan.newRows.length === 0
                          }
                        >
                          {tr("Review final import of {0} clients", [clientScan.newRows.length])}
                        </button>
                      ) : (
                        <div className="imports-result-panel">
                          <strong>{tr("Final confirmation required")}</strong>

                          <span>{tr("File:")}{" "}{workbook?.fileName}
                          </span>

                          <span>{tr("Sheet:")}{" "}{selectedSheet?.name}
                          </span>

                          <span>{tr("Total rows checked:")}{' '}
                            {clientScan.preparedRows.length}
                          </span>

                          <span>{tr("New clients to create:")}{' '}
                            {clientScan.newRows.length}
                          </span>

                          <span>{tr("Duplicates skipped:")}{' '}
                            {clientScan.duplicates.length}
                          </span>

                          <span>{tr("Rejected by validation:")}{' '}
                            {validation.invalidRows}
                          </span>

                          <p className="imports-execution-note">{tr("Confirming will create these client records in Supabase.")}</p>

                          <div className="imports-confirm-actions">
                            <button
                              type="button"
                              className="imports-secondary-button"
                              onClick={() =>
                                setConfirmingImport(false)
                              }
                              disabled={importing}
                            >{tr("Cancel")}</button>

                            <button
                              type="button"
                              className="imports-primary-button imports-import-button"
                              onClick={() =>
                                void handleImportClients()
                              }
                              disabled={
                                importing ||
                                clientScan.newRows.length === 0
                              }
                            >
                              {importing
                                ? tr("Importing clients…")
                                : tr("Confirm import {0} clients", [clientScan.newRows.length])}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="imports-result-panel">
                      <strong>{tr("Import completed")}</strong>

                      <span>
                        {importResult.imported}{" "}{tr("imported")}</span>

                      <span>
                        {importResult.skipped}{" "}{tr("skipped")}</span>

                      <span>
                        {importResult.failed}{" "}{tr("failed")}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="imports-execution-note">{tr("Run the duplicate scan before importing.")}</p>
              )}
            </section>
          ) : null}


          {selectedSheet ? (
            <section className="imports-preview-panel">
              <header>
                <div>
                  <span>{tr("DATA PREVIEW")}</span>

                  <h3>
                    {selectedSheet.name}
                  </h3>

                  <p>{tr("Showing the first")}{' '}
                    {Math.min(
                      selectedSheet.rows.length,
                      25,
                    )}{' '}{tr("of")}{" "}{selectedSheet.totalRows}{" "}{tr("rows.")}</p>
                </div>

                <strong>
                  {selectedSheet.headers.length}{' '}{tr("columns")}</strong>
              </header>

              <div className="imports-table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>

                      {selectedSheet.headers.map(
                        (header) => (
                          <th key={header}>
                            {header}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                                    <tbody>
                    {selectedSheet.rows
                      .slice(0, 25)
                      .map(
                        (
                          row,
                          rowIndex,
                        ) => (
                          <tr key={rowIndex}>
                            <td>
                              {rowIndex + 1}
                            </td>

                            {selectedSheet.headers.map(
                              (header) => (
                                <td key={header}>
                                  {String(
                                    row[header] ??
                                      '',
                                  )}
                                </td>
                              ),
                            )}
                          </tr>
                        ),
                      )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}