import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

interface Props {
  onGenerate: (count: number) => Promise<void>;
  isGenerating: boolean;
  isDisabled?: boolean;
}

export function GenerationControls({ onGenerate, isGenerating, isDisabled = false }: Props) {
  const [count, setCount] = useState(5);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-indigo-500" /> Generate Activity Ideas
          </h2>
          <p className="text-sm text-slate-600">
            Create complete Pre-Activity, Main Activity, and Post-Activity ideas for the selected topic.
          </p>
        </div>
        
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-slate-500 uppercase mb-1">Number of ideas</label>
            <input 
              type="number" 
              min={1} 
              max={10} 
              value={count} 
              onChange={e => setCount(parseInt(e.target.value) || 1)}
              disabled={isGenerating || isDisabled}
              className="w-20 p-2 border border-slate-300 rounded-lg text-center focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          
          <button
            onClick={() => onGenerate(count)}
            disabled={isGenerating || isDisabled}
            className="self-end px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Generating...
              </>
            ) : isDisabled ? (
              "Review current activities first"
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Generate Activity Ideas
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
