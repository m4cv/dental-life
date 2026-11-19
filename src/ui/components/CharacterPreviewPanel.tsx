import { usePreviewStore, type PreviewAnim, type PreviewView } from '@/state/usePreviewStore'

const ANIMS: { id: PreviewAnim; label: string }[] = [
  { id: 'idle', label: 'Idle' },
  { id: 'walk', label: 'Walk' },
  { id: 'run', label: 'Run' },
]

const VIEWS: { id: PreviewView; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'back', label: 'Back' },
  { id: 'face', label: 'Face' },
  { id: 'orbit', label: 'Orbit' },
]

function Segment<T extends string>({
  title,
  items,
  value,
  onSelect,
  testPrefix,
}: {
  title: string
  items: { id: T; label: string }[]
  value: T
  onSelect: (id: T) => void
  testPrefix: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-white/70">{title}</span>
      <div className="flex flex-1 gap-1">
        {items.map((item) => {
          const active = item.id === value
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`${testPrefix}-${item.id}`}
              aria-pressed={active}
              onClick={() => onSelect(item.id)}
              className={
                'min-h-11 flex-1 rounded-xl text-sm font-semibold transition-colors ' +
                (active ? 'bg-white text-slate-900' : 'bg-white/15 text-white active:bg-white/30')
              }
            >
              {item.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Stage 2 preview: pick an animation and a camera angle to inspect the character. */
export function CharacterPreviewPanel() {
  const anim = usePreviewStore((s) => s.anim)
  const view = usePreviewStore((s) => s.view)
  const setAnim = usePreviewStore((s) => s.setAnim)
  const setView = usePreviewStore((s) => s.setView)

  return (
    <div
      data-testid="char-preview"
      className="pointer-events-auto flex w-full max-w-md flex-col gap-1.5 rounded-2xl bg-black/50 p-2 backdrop-blur"
    >
      <p className="px-1 text-center text-[11px] leading-4 text-white/80">
        Stage 2 · Character preview — movement controls arrive in Stage 3
      </p>
      <Segment title="Motion" items={ANIMS} value={anim} onSelect={setAnim} testPrefix="anim" />
      <Segment title="Camera" items={VIEWS} value={view} onSelect={setView} testPrefix="view" />
    </div>
  )
}
