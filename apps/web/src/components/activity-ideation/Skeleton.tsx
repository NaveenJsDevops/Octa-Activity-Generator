export function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-48 mb-6"></div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 h-96">
        <div className="h-8 bg-slate-200 rounded w-1/2 mb-8"></div>
        <div className="h-4 bg-slate-200 rounded w-full mb-4"></div>
        <div className="h-4 bg-slate-200 rounded w-full mb-4"></div>
        <div className="h-4 bg-slate-200 rounded w-2/3 mb-4"></div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 h-48">
        <div className="h-6 bg-slate-200 rounded w-1/4 mb-6"></div>
        <div className="h-10 bg-slate-200 rounded w-32"></div>
      </div>
    </div>
  );
}
