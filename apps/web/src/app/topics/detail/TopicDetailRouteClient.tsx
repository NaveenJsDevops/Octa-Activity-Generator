"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TopicDetailClient from "../[id]/TopicDetailClient";

export default function TopicDetailRouteClient() {
  const topicId = useSearchParams().get("id");

  if (!topicId) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-12 text-center">
        <h1 className="text-xl font-bold text-slate-900">Topic Not Found</h1>
        <p className="mt-2 text-sm text-slate-500">A topic ID is required to open this page.</p>
        <Link
          href="/topics/library"
          className="mt-5 inline-flex rounded-xl bg-[#5B50F5] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back to Topic Library
        </Link>
      </div>
    );
  }

  return <TopicDetailClient topicId={topicId} />;
}
