interface Props {
  role: string
  icon: string
  summary: string | null
  color: string
}

export function AgentPanel({ role, icon, summary, color }: Props) {
  return (
    <div className={`bg-slate-800 border ${color} rounded-xl p-5 flex flex-col gap-3`}>
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <h3 className="text-white font-semibold">{role}</h3>
      </div>
      {summary ? (
        <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
          {summary}
        </div>
      ) : (
        <p className="text-slate-500 text-sm italic">No report yet. Run the agents to generate one.</p>
      )}
    </div>
  )
}
