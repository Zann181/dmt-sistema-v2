import React from "react"

interface PieSegment {
  name: string
  value: number
  color: string
}

interface PieChartSvgProps {
  data: PieSegment[]
  size?: number
}

export function PieChartSvg({ data, size = 160 }: PieChartSvgProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  
  if (total === 0) {
    return (
      <div className="flex items-center justify-center text-lime-300 text-xs font-semibold py-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
        Sin transacciones registradas
      </div>
    )
  }

  let accumulatedPercent = 0

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
      {/* Circle SVG */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 42 42" className="w-full h-full transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="21"
            cy="21"
            r="15.91549430918954"
            fill="transparent"
            stroke="var(--border, rgba(120,120,120,0.1))"
            strokeWidth="5"
          />
          {data.map((segment, idx) => {
            const percent = (segment.value / total) * 100
            if (percent === 0) return null
            
            const strokeDasharray = `${percent} ${100 - percent}`
            const strokeDashoffset = 100 - accumulatedPercent
            accumulatedPercent += percent

            return (
              <circle
                key={idx}
                cx="21"
                cy="21"
                r="15.91549430918954"
                fill="transparent"
                stroke={segment.color}
                strokeWidth="5.5"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-300 ease-out hover:scale-105 origin-center cursor-pointer"
              />
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="space-y-2.5 flex-1 min-w-[120px] w-full">
        {data.map((segment, idx) => {
          const percent = total > 0 ? ((segment.value / total) * 100) : 0
          return (
            <div key={idx} className="flex items-center justify-between text-xs border-b border-zinc-50 dark:border-zinc-900/50 pb-1.5 last:border-0 last:pb-0">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: segment.color }} />
                <span className="font-bold text-zinc-600 dark:text-lime-300">{segment.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-lime-300 font-mono">${segment.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span className="font-extrabold text-zinc-900 dark:text-white font-mono">
                  {percent.toFixed(0)}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


