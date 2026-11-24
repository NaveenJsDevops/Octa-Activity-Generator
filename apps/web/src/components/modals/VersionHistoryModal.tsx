"use client";

import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/apiBase";

export interface VersionDiffItem {
  field: string;
  old_value?: string | null;
  new_value?: string | null;
}

export interface VersionItem {
  version_id: string;
  entity_id: string;
  version_number: number;
  change_summary?: string | null;
  changes: VersionDiffItem[];
  created_at: string;
  created_by: string;
  content?: Record<string, any> | null;
}

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  entityType: "topic" | "activity";
  entityId: string;
  onRestoreSuccess?: () => void;
}

export default function VersionHistoryModal({
  isOpen,
  onClose,
  title,
  entityType,
  entityId,
  onRestoreSuccess,
}: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchVersions = async () => {
    if (!entityId) return;
    setLoading(true);
    setError(null);
    try {
      const endpoint =
        entityType === "topic"
          ? `${API_BASE_URL}/api/topics/${entityId}/versions`
          : `${API_BASE_URL}/api/activities/${entityId}/versions`;
      const res = await fetch(endpoint);
      if (!res.ok) {
        throw new Error(`Failed to load versions (${res.status})`);
      }
      const data = await res.json();
      setVersions(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch version history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSuccessMsg(null);
      fetchVersions();
    }
  }, [isOpen, entityId]);

  const handleRestore = async (version: VersionItem) => {
    const confirmMsg = `Are you sure you want to restore to Version ${version.version_number}?\n\nThis will roll back the current record to this version's state and record a restoration entry in the history.`;
    if (!window.confirm(confirmMsg)) return;

    setRestoringId(version.version_id);
    setError(null);
    try {
      const endpoint =
        entityType === "topic"
          ? `${API_BASE_URL}/api/topics/${entityId}/restore/${version.version_id}`
          : `${API_BASE_URL}/api/activities/${entityId}/restore/${version.version_id}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to restore version: ${text}`);
      }

      setSuccessMsg(`Successfully restored to Version ${version.version_number}`);
      await fetchVersions();
      if (onRestoreSuccess) {
        onRestoreSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Restore failed");
    } finally {
      setRestoringId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Version History &amp; Audit Log</h3>
              <p className="text-xs text-slate-500 font-medium truncate max-w-md">{title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
              <span className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span> {successMsg}
              </span>
              <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">✕</button>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800">
              <span className="flex items-center gap-2">
                <span className="text-rose-600 font-bold">⚠</span> {error}
              </span>
              <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">✕</button>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium">Loading version timeline...</p>
            </div>
          ) : versions.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm font-medium">No previous versions found.</p>
              <p className="text-xs text-slate-500 mt-1">Changes made to this record will automatically create versions here.</p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
              {versions.map((ver, idx) => {
                const isCurrent = idx === 0;
                const formattedDate = ver.created_at
                  ? new Date(ver.created_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : "Original Record";

                return (
                  <div key={ver.version_id} className="relative group">
                    {/* Timeline Dot */}
                    <div
                      className={`absolute -left-6 top-3 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${
                        isCurrent
                          ? "border-indigo-600 ring-4 ring-indigo-50"
                          : "border-slate-300 group-hover:border-indigo-400"
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${isCurrent ? "bg-indigo-600" : "bg-slate-300"}`} />
                    </div>

                    {/* Card */}
                    <div
                      className={`p-4 rounded-xl border transition-all ${
                        isCurrent
                          ? "bg-indigo-50/20 border-indigo-200 shadow-sm"
                          : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 font-bold text-xs rounded-md">
                              v{ver.version_number}
                            </span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-semibold text-[11px] rounded-md">
                                Current Active
                              </span>
                            )}
                            <span className="text-xs font-semibold text-slate-700">
                              {ver.change_summary || (ver.version_number === 1 ? "Baseline Snapshot" : "Changes updated")}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Recorded by <span className="font-medium text-slate-600">{ver.created_by || "editor"}</span> · {formattedDate}
                          </p>
                        </div>

                        {!isCurrent && (
                          <button
                            onClick={() => handleRestore(ver)}
                            disabled={restoringId === ver.version_id}
                            className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {restoringId === ver.version_id ? (
                              <>
                                <span className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                Restoring...
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                </svg>
                                Restore
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Diff Details */}
                      {ver.changes && ver.changes.length > 0 ? (
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Field Modifications ({ver.changes.length})</p>
                          <div className="space-y-1">
                            {ver.changes.map((diff, dIdx) => (
                              <div
                                key={dIdx}
                                className="text-xs bg-slate-50 border border-slate-100 rounded-lg p-2 flex flex-col gap-1 font-mono"
                              >
                                <span className="text-slate-500 font-sans font-bold text-[11px]">
                                  {diff.field.replace(/_/g, " ").toUpperCase()}
                                </span>
                                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                                  <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded border border-rose-100 line-through truncate max-w-xs">
                                    {diff.old_value || "—"}
                                  </span>
                                  <span className="text-slate-400">➔</span>
                                  <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100 font-semibold truncate max-w-xs">
                                    {diff.new_value || "—"}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : ver.version_number === 1 ? (
                        <div className="mt-2 text-[11px] text-slate-400 italic">
                          Baseline record created upon first ingestion or system approval.
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
