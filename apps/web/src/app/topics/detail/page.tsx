import { Suspense } from "react";
import TopicDetailRouteClient from "./TopicDetailRouteClient";

export default function TopicDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto h-64 max-w-5xl animate-pulse rounded-3xl bg-slate-100" />
      }
    >
      <TopicDetailRouteClient />
    </Suspense>
  );
}
