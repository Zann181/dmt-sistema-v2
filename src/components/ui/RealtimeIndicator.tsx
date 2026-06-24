"use client"

export function RealtimeIndicator({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
      <span className="text-zinc-500 dark:text-zinc-400">
        {isConnected ? "En vivo" : "Desconectado"}
      </span>
    </div>
  )
}
