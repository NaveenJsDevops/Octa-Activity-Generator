import { ActivityIdeationResult } from "@/lib/api/activityIdeation";

export function GenerationSummary({ result }: { result: ActivityIdeationResult | null }) {
  if (!result) return null;

  return (
    <div className="mb-8">
      <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Latest Generation Summary</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Generated</div>
          <div className="text-2xl font-bold text-slate-900">{result.generated_count}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-sm text-center">
          <div className="text-xs font-semibold text-emerald-700 uppercase mb-1">Accepted</div>
          <div className="text-2xl font-bold text-emerald-700">{result.accepted_count}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm text-center">
          <div className="text-xs font-semibold text-amber-700 uppercase mb-1">Duplicates</div>
          <div className="text-2xl font-bold text-amber-700">{result.duplicate_count}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm text-center">
          <div className="text-xs font-semibold text-red-700 uppercase mb-1">Rejected</div>
          <div className="text-2xl font-bold text-red-700">{result.rejected_count}</div>
        </div>
      </div>
    </div>
  );
}
