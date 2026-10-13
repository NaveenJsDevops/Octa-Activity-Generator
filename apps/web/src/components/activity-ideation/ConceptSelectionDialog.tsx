import { ActivityConcept } from "@/lib/api/activityIdeation";
import { AlertCircle } from "lucide-react";

interface Props {
  concept: ActivityConcept | null;
  onConfirm: () => void;
  onCancel: () => void;
  isSelecting: boolean;
}

export function ConceptSelectionDialog({ concept, onConfirm, onCancel, isSelecting }: Props) {
  if (!concept) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-full shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Select this activity concept?</h3>
              <p className="text-sm text-slate-600">
                Only one activity concept can be selected for this topic. This concept will be used as the basis for the next generation phase.
              </p>
            </div>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-6">
            <div className="text-xs font-bold text-slate-500 uppercase mb-1">{concept.activity_type_id}</div>
            <div className="font-semibold text-slate-900">{concept.activity_title}</div>
          </div>
          
          <div className="flex items-center justify-end gap-3">
            <button 
              onClick={onCancel}
              disabled={isSelecting}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              onClick={onConfirm}
              disabled={isSelecting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
            >
              {isSelecting ? "Selecting..." : "Select Concept"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
