import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import {
  getHearings,
  createHearing,
  updateHearing,
  deleteHearing,
  markHearingCompleted,
  markHearingAdjourned,
  markHearingCancelled,
} from '../services/hearingService';
import type { Hearing, HearingInsert, HearingUpdate, HearingStatus, HearingType } from '../types/hearing';
import { HearingFormModal } from '../components/hearings/HearingFormModal';
import { DeleteHearingModal } from '../components/hearings/DeleteHearingModal';
import { HearingDetailsModal } from '../components/hearings/HearingDetailsModal';
import './Hearings.css';

export function Hearings() {
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<HearingStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<HearingType | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedHearing, setSelectedHearing] = useState<Hearing | null>(null);

  useEffect(() => {
    loadHearings();
  }, [searchQuery, statusFilter, typeFilter, currentPage]);

  const loadHearings = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getHearings({
        page: currentPage,
        pageSize,
        search: searchQuery,
        filters: {
          status: statusFilter || undefined,
          hearing_type: typeFilter || undefined,
        },
      });
      setHearings(result.data);
      setTotalCount(result.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hearings');
      setHearings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddHearing = () => {
    setSelectedHearing(null);
    setShowFormModal(true);
  };

  const handleEditHearing = (hearing: Hearing) => {
    setSelectedHearing(hearing);
    setShowFormModal(true);
  };

  const handleViewHearing = (hearing: Hearing) => {
    setSelectedHearing(hearing);
    setShowDetailsModal(true);
  };

  const handleDeleteHearing = (hearing: Hearing) => {
    setSelectedHearing(hearing);
    setShowDeleteModal(true);
  };

  const handleMarkCompleted = async (hearing: Hearing) => {
    try {
      await markHearingCompleted(hearing.id);
      await loadHearings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update hearing');
    }
  };

  const handleMarkAdjourned = async (hearing: Hearing) => {
    try {
      await markHearingAdjourned(hearing.id);
      await loadHearings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update hearing');
    }
  };

  const handleSaveHearing = async (data: HearingInsert | HearingUpdate) => {
    try {
      if (selectedHearing) {
        await updateHearing(selectedHearing.id, data);
      } else {
        await createHearing(data as HearingInsert);
      }
      setShowFormModal(false);
      await loadHearings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save hearing');
      throw err;
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedHearing) return;
    try {
      await deleteHearing(selectedHearing.id);
      setShowDeleteModal(false);
      await loadHearings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete hearing');
      throw err;
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalCount);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-AE', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusBadgeClass = (status: HearingStatus) => {
    const statusClass = status.toLowerCase().replace(/\s+/g, '-');
    return `hearing-status-badge hearing-status-${statusClass}`;
  };

  const getTypeTagClass = (type: HearingType) => {
    const typeClass = type.toLowerCase().replace(/\s+/g, '-');
    return `hearing-type-tag hearing-type-${typeClass}`;
  };

  return (
    <div className="hearings-container">
      <div className="hearings-header">
        <h1>Hearings</h1>
        <button className="hearings-add-button" onClick={handleAddHearing}>
          <Plus size={18} />
          Add Hearing
        </button>
      </div>

      {error && <div className="hearings-error">{error}</div>}

      <div className="hearings-controls">
        <div className="hearings-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by case, title, or court..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="hearings-filters">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as HearingStatus | '');
              setCurrentPage(1);
            }}
            className="hearings-filter-select"
          >
            <option value="">All Status</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
            <option value="Adjourned">Adjourned</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as HearingType | '');
              setCurrentPage(1);
            }}
            className="hearings-filter-select"
          >
            <option value="">All Types</option>
            <option value="Preliminary">Preliminary</option>
            <option value="Case Management">Case Management</option>
            <option value="Final Hearing">Final Hearing</option>
            <option value="Appeal">Appeal</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="hearings-loading">Loading hearings...</div>
      ) : hearings.length === 0 ? (
        <div className="hearings-empty">
          <p>No hearings found</p>
          <button className="hearings-empty-button" onClick={handleAddHearing}>
            <Plus size={18} />
            Create your first hearing
          </button>
        </div>
      ) : (
        <>
          <div className="hearings-table-wrapper">
            <table className="hearings-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Hearing</th>
                  <th>Court</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hearings.map((hearing) => (
                  <tr key={hearing.id} className="hearings-table-row">
                    <td className="hearings-cell-datetime">
                      {formatDateTime(hearing.hearing_at)}
                    </td>
                    <td className="hearings-cell-title">
                      <strong>{hearing.title}</strong>
                    </td>
                    <td className="hearings-cell-court">{hearing.court}</td>
                    <td className="hearings-cell-type">
                      <span className={getTypeTagClass(hearing.hearing_type)}>
                        {hearing.hearing_type}
                      </span>
                    </td>
                    <td className="hearings-cell-status">
                      <span className={getStatusBadgeClass(hearing.status)}>
                        {hearing.status}
                      </span>
                    </td>
                    <td className="hearings-cell-actions">
                      <div className="hearings-actions">
                        <button
                          title="View"
                          onClick={() => handleViewHearing(hearing)}
                          className="hearings-action-button"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          title="Edit"
                          onClick={() => handleEditHearing(hearing)}
                          className="hearings-action-button"
                        >
                          <Edit2 size={16} />
                        </button>
                        {hearing.status === 'Scheduled' && (
                          <>
                            <button
                              title="Mark Completed"
                              onClick={() => handleMarkCompleted(hearing)}
                              className="hearings-action-button hearings-action-complete"
                            >
                              <CheckCircle size={16} />
                            </button>
                            <button
                              title="Mark Adjourned"
                              onClick={() => handleMarkAdjourned(hearing)}
                              className="hearings-action-button hearings-action-adjourn"
                            >
                              <Clock size={16} />
                            </button>
                          </>
                        )}
                        <button
                          title="Delete"
                          onClick={() => handleDeleteHearing(hearing)}
                          className="hearings-action-button hearings-action-delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="hearings-pagination">
            <div className="hearings-pagination-info">
              Showing {startIndex} to {endIndex} of {totalCount} hearings
            </div>
            <div className="hearings-pagination-controls">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="hearings-pagination-button"
              >
                Previous
              </button>
              <span className="hearings-pagination-pages">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                className="hearings-pagination-button"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {showFormModal && (
        <HearingFormModal
          hearing={selectedHearing || undefined}
          onClose={() => setShowFormModal(false)}
          onSave={handleSaveHearing}
        />
      )}

      {showDeleteModal && selectedHearing && (
        <DeleteHearingModal
          hearing={selectedHearing}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {showDetailsModal && selectedHearing && (
        <HearingDetailsModal
          hearing={selectedHearing}
          onClose={() => setShowDetailsModal(false)}
        />
      )}
    </div>
  );
}
