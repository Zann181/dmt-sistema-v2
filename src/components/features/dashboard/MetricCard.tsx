import React from "react"

interface MetricCardProps {
  title: string
  value: string | number
  description?: string
  icon: React.ReactNode
  gradient?: string
}

export function MetricCard({ title, value, description, icon, gradient }: MetricCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-950 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.01] group">
      {/* Decorative gradient glow on hover */}
      <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full opacity-10 blur-2xl group-hover:scale-150 transition-transform duration-500 ${gradient || "bg-indigo-500"}`} />
      
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-lime-400 dark:text-lime-300">{title}</span>
        <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-850 text-zinc-650 dark:text-zinc-300 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/30 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {icon}
        </div>
      </div>
      
      <div className="mt-4 space-y-1">
        <h3 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white font-mono">{value}</h3>
        {description && (
          <p className="text-xs text-lime-300 dark:text-lime-400 font-medium">{description}</p>
        )}
      </div>
    </div>
  )
}


