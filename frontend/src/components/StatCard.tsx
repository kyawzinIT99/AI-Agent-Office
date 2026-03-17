interface Props {
  label: string
  value: number | string
  icon: string
  color: string
}

export function StatCard({ label, value, icon, color }: Props) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-center gap-4">
      <div className={`text-3xl w-12 h-12 flex items-center justify-center rounded-lg ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{label}</p>
        <p className="text-white text-2xl font-bold">{value}</p>
      </div>
    </div>
  )
}
