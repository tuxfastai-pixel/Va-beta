type PauseAutonomyButtonProps = {
  paused: boolean
  onToggle: () => void
}

export default function PauseAutonomyButton({ paused, onToggle }: PauseAutonomyButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`rounded-lg px-3 py-2 text-xs font-semibold ${
        paused ? "bg-amber-100 text-amber-800" : "bg-slate-900 text-white"
      }`}
    >
      {paused ? "Autonomy paused" : "Pause autonomy"}
    </button>
  )
}
