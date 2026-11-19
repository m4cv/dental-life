import { useEffect, useState } from 'react'
import { DEFAULT_QUALITY, GRAPHICS_PROFILES } from '@/config/graphics'
import { useAppStore } from '@/state/useAppStore'

function useViewportSize() {
  const read = () => ({ w: window.innerWidth, h: window.innerHeight })
  const [size, setSize] = useState(read)

  useEffect(() => {
    const onResize = () => setSize(read())
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  return size
}

/** Small read-out for testing on a real phone: frame rate, pixel ratio and viewport. */
export function Diagnostics() {
  const fps = useAppStore((state) => state.fps)
  const { w, h } = useViewportSize()
  const deviceDpr = window.devicePixelRatio
  const renderDpr = Math.min(deviceDpr, GRAPHICS_PROFILES[DEFAULT_QUALITY].maxDpr)

  return (
    <div
      className="rounded-xl bg-black/45 px-3 py-2 font-mono text-[11px] leading-4 text-white backdrop-blur"
      data-testid="diagnostics"
    >
      <div>{fps > 0 ? `${fps} FPS` : '… FPS'}</div>
      <div>
        WebGL 2 · DPR {deviceDpr.toFixed(1)}→{renderDpr.toFixed(1)}
      </div>
      <div>
        {w}×{h}
      </div>
    </div>
  )
}
