export function LoadingScreen({ label = 'Loading world…' }: { label?: string }) {
  return (
    <div
      className="menu-bg fixed inset-0 flex flex-col items-center justify-center gap-4 text-slate-800"
      role="status"
    >
      <div className="spinner" />
      <p className="text-base font-medium">{label}</p>
    </div>
  )
}
