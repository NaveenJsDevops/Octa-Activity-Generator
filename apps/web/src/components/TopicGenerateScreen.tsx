"use client";

import { useEffect, useState } from "react";
import TopicDiscoveryPanel from "@/components/TopicDiscoveryPanel";
import { fetchHealth } from "@/lib/apiCache";

export default function TopicGenerateScreen() {
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetchHealth()
      .then(data => setAiConfigured(data.ai?.configured ?? false))
      .catch(() => setAiConfigured(false));
  }, []);

  return (
    <TopicDiscoveryPanel
      onTopicsGenerated={() => {}}
      aiConfigured={aiConfigured}
    />
  );
}
