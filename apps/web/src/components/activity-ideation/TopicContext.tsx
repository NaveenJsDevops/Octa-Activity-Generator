/* eslint-disable @typescript-eslint/no-explicit-any */

export function TopicContext({ topicData }: { topicData: any }) {
  if (!topicData) return null;

  const topic = topicData.topic;
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
      <div className="border-b border-slate-200 bg-slate-50/50 p-6">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">SELECTED TOPIC</h2>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{topic.topic}</h1>
        <p className="text-slate-600 font-medium">{topic.topic_hook}</p>
      </div>
      
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-2">Full Description</h3>
          <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-100">{topic.why_interesting}</p>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase">Topic Family</span>
              <span className="text-sm font-medium text-slate-900">{topicData.topic_family_name}</span>
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase">Age Range</span>
              <span className="text-sm font-medium text-slate-900">{topic.age_min}–{topic.age_max}</span>
            </div>
          </div>
          
          <div>
            <span className="block text-xs font-semibold text-slate-500 uppercase mb-1">Mapped Skills</span>
            <div className="flex flex-wrap gap-2">
              {topicData.skills.map((s: any, idx: number) => (
                <span key={idx} className="px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-xs font-medium">
                  {s.skill_name}
                </span>
              ))}
            </div>
          </div>
          
          <div>
            <span className="block text-xs font-semibold text-slate-500 uppercase mb-1">Keywords</span>
            <div className="flex flex-wrap gap-2">
              {topicData.keywords.map((kw: string, idx: number) => (
                <span key={idx} className="px-2 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded text-xs font-medium">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
