"use client";

import { useState, useEffect } from "react";
import { Check, ChevronDown, Cpu, Activity, AlertCircle, CheckCircle2 } from "lucide-react";
import { fetchAiSettings, fetchAiModels, invalidateCache } from "@/lib/apiCache";
import { API_BASE_URL } from "@/lib/apiBase";

export function ModelSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testMessage, setTestMessage] = useState<string>("");

  useEffect(() => {
    // Both calls are served from the module-level cache after the first load.
    Promise.allSettled([
      fetchAiSettings().then(data => setCurrentModel(data.model)),
      fetchAiModels().then(data => setAvailableModels(data.models))
    ]).finally(() => {
      setIsLoading(false);
    });
  }, []);

  const handleSelect = async (model: string) => {
    if (model === currentModel) {
      setIsOpen(false);
      return;
    }

    setIsUpdating(true);
    setTestStatus("idle");
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings/ai`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentModel(data.settings.model);
        // Invalidate the cache so the next read picks up the new model
        invalidateCache("ai_settings");
      }
    } catch (err) {
      console.error("Failed to update model", err);
    } finally {
      setIsUpdating(false);
      setIsOpen(false);
    }
  };

  const handleTestConnection = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setTestStatus("testing");
    setTestMessage("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings/ai/test`);
      const data = await res.json();

      if (data.status === "ok") {
        setTestStatus("ok");
        setTestMessage("Working!");
      } else {
        setTestStatus("error");
        setTestMessage(data.message || "Failed");
      }
    } catch {
      setTestStatus("error");
      setTestMessage("Network error");
    }

    setTimeout(() => {
      setTestStatus("idle");
      setTestMessage("");
    }, 4000);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors border border-slate-200 bg-white shadow-sm text-sm font-medium"
        >
          <Cpu className={`w-3.5 h-3.5 ${currentModel ? "text-[#5B50F5]" : "text-slate-400"}`} />
          <span className="max-w-[120px] truncate">
            {isUpdating ? "Updating..." : isLoading ? "Loading..." : (currentModel || "AI Offline")}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>

        <button
          onClick={handleTestConnection}
          disabled={testStatus === "testing"}
          title="Test if the model has credits and is working"
          className="p-1.5 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors text-slate-500 disabled:opacity-50"
        >
          {testStatus === "testing" && <Activity className="w-4 h-4 animate-pulse text-[#5B50F5]" />}
          {testStatus === "ok" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          {testStatus === "error" && <AlertCircle className="w-4 h-4 text-red-500" />}
          {testStatus === "idle" && <Activity className="w-4 h-4" />}
        </button>
      </div>

      {testMessage && (
        <div className={`absolute top-full right-0 mt-2 px-3 py-2 text-xs font-medium rounded-xl shadow-lg whitespace-nowrap z-50 ${testStatus === "error" ? "bg-red-600 text-white" : "bg-emerald-600 text-white"}`}>
          {testMessage}
        </div>
      )}

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden py-1">
            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Model</span>
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {availableModels.length > 0 ? availableModels.map((model) => (
                <button
                  key={model}
                  onClick={() => handleSelect(model)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-[#ECEFFE] flex items-center justify-between group transition-colors"
                >
                  <span className={`font-medium ${model === currentModel ? "text-[#5B50F5]" : "text-slate-700 group-hover:text-[#5B50F5]"}`}>
                    {model}
                  </span>
                  {model === currentModel && (
                    <Check className="w-4 h-4 text-[#5B50F5]" />
                  )}
                </button>
              )) : (
                <div className="px-3 py-2 text-sm text-slate-500 text-center">Loading models...</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
