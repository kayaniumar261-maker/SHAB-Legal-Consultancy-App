import { tr, getLocale, useLocale, trEnum } from '../../i18n/locale';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Hearing } from '../../types/hearing';
import { getHearingCaseReference } from '../../utils/hearingReference';
import './HearingDetailsModal.css';

type HearingDetailsModalProps = {
  hearing: Hearing;
  caseNumber?: string;
  clientName?: string;
  staffName?: string;
  onClose: () => void;
};

export function HearingDetailsModal({
  hearing,
  caseNumber = getHearingCaseReference(hearing),
  clientName = hearing.case?.client?.full_name?.trim(),
  staffName,
  onClose,
}: HearingDetailsModalProps) {
  const interfaceLanguage = useLocale();
  const hearingDate = new Date(hearing.hearing_at);
  const endDate = hearing.end_at ? new Date(hearing.end_at) : null;
  const createdDate = new Date(hearing.created_at);
  const updatedDate = new Date(hearing.updated_at);

  const formatDateTime = (date: Date) =>
    date.toLocaleString(getLocale("en-AE"), {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

  const formatDate = (date: Date) =>
    date.toLocaleDateString(getLocale("en-AE"), {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });

  const getStatusBadgeClass = (status: string) => {
    const statusClass = status.toLowerCase().replace(/\s+/g, '-');
    return `hearing-status-badge hearing-status-${statusClass}`;
  };

  const getHearingTypeBadgeClass = (type: string) => {
    const typeClass = type.toLowerCase().replace(/\s+/g, '-');
    return `hearing-type-badge hearing-type-${typeClass}`;
  };

  return (
    <div className="hearing-details-overlay" onClick={onClose}>
      <div
        className="hearing-details-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hearing-details-header">
          <h2>{hearing.title}</h2>
          <button
            type="button"
            className="hearing-details-close"
            onClick={onClose}
            aria-label={tr("Close modal")}
          >
            <X size={20} />
          </button>
        </div>

        <div className="hearing-details-content">
          {/* Date & Time */}
          <div className="hearing-details-section">
            <h3>{tr("Date & Time")}</h3>
            <div className="hearing-details-row">
              <span className="hearing-details-label">{tr("Hearing Date & Time")}</span>
              <span className="hearing-details-value">
                {formatDateTime(hearingDate)}
              </span>
            </div>
            {endDate && (
              <div className="hearing-details-row">
                <span className="hearing-details-label">{tr("End Date & Time")}</span>
                <span className="hearing-details-value">
                  {formatDateTime(endDate)}
                </span>
              </div>
            )}
          </div>

          {/* Case & Client */}
          <div className="hearing-details-section">
            <h3>{tr("Case Information")}</h3>
            {caseNumber && (
              <div className="hearing-details-row">
                <span className="hearing-details-label">{tr("Case Number")}</span>
                <span className="hearing-details-value">{caseNumber}</span>
              </div>
            )}
            {clientName && (
              <div className="hearing-details-row">
                <span className="hearing-details-label">{tr("Client")}</span>
                <span className="hearing-details-value">{clientName}</span>
              </div>
            )}
            {hearing.case?.matter_number?.trim() && (
              <div className="hearing-details-row">
                <span className="hearing-details-label">{tr("Matter Reference")}</span>
                <span className="hearing-details-value"><bdi dir="ltr">{hearing.case.matter_number}</bdi></span>
              </div>
            )}
          </div>

          {/* Court Information */}
          <div className="hearing-details-section">
            <h3>{tr("Court Information")}</h3>
            <div className="hearing-details-row">
              <span className="hearing-details-label">{tr("Court")}</span>
              <span className="hearing-details-value">{hearing.court}</span>
            </div>
            {hearing.courtroom && (
              <div className="hearing-details-row">
                <span className="hearing-details-label">{tr("Courtroom")}</span>
                <span className="hearing-details-value">
                  {hearing.courtroom}
                </span>
              </div>
            )}
            {hearing.location && (
              <div className="hearing-details-row">
                <span className="hearing-details-label">{tr("Location")}</span>
                <span className="hearing-details-value">
                  {hearing.location}
                </span>
              </div>
            )}
          </div>

          {/* Hearing Details */}
          <div className="hearing-details-section">
            <h3>{tr("Hearing Details")}</h3>
            <div className="hearing-details-row">
              <span className="hearing-details-label">{tr("Hearing Type")}</span>
              <span className={getHearingTypeBadgeClass(hearing.hearing_type)}>
                {trEnum(hearing.hearing_type)}
              </span>
            </div>
            <div className="hearing-details-row">
              <span className="hearing-details-label">{tr("Status")}</span>
              <span className={getStatusBadgeClass(hearing.status)}>
                {trEnum(hearing.status)}
              </span>
            </div>
            {staffName && (
              <div className="hearing-details-row">
                <span className="hearing-details-label">{tr("Assigned Staff")}</span>
                <span className="hearing-details-value">{staffName}</span>
              </div>
            )}
          </div>

          {/* Outcome & Notes */}
          {(hearing.outcome || hearing.notes) && (
            <div className="hearing-details-section">
              <h3>{tr("Additional Information")}</h3>
              {hearing.outcome && (
                <div className="hearing-details-row">
                  <span className="hearing-details-label">{tr("Outcome")}</span>
                  <span className="hearing-details-value">
                    {hearing.outcome}
                  </span>
                </div>
              )}
              {hearing.notes && (
                <div className="hearing-details-row hearing-details-row-full">
                  <span className="hearing-details-label">{tr("Notes")}</span>
                  <p className="hearing-details-notes">{hearing.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Reminder & Metadata */}
          <div className="hearing-details-section hearing-details-meta">
            {hearing.reminder_minutes && (
              <div className="hearing-details-row">
                <span className="hearing-details-label">{tr("Reminder")}</span>
                <span className="hearing-details-value">
                  {hearing.reminder_minutes}{" "}{tr("minutes before")}</span>
              </div>
            )}
            <div className="hearing-details-row">
              <span className="hearing-details-label">{tr("Created")}</span>
              <span className="hearing-details-value">
                {formatDate(createdDate)}
              </span>
            </div>
            <div className="hearing-details-row">
              <span className="hearing-details-label">{tr("Updated")}</span>
              <span className="hearing-details-value">
                {formatDate(updatedDate)}
              </span>
            </div>
          </div>
        </div>

        <div className="hearing-details-footer">
          <button
            type="button"
            className="hearing-details-close-button"
            onClick={onClose}
          >{tr("Close")}</button>
        </div>
      </div>
    </div>
  );
}
