import { useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { DEFAULT_QUALITY, GRAPHICS_PROFILES } from '@/config/graphics'
import { useAppStore } from '@/state/useAppStore'

/** Measures frame rate inside the render loop and publishes it twice a second. */
function FpsMeter() {
  const setFps = useAppStore((state) => state.setFps)
  const counter = useRef({ frames: 0, seconds: 0 })

  useFrame((_, delta) => {
    const c = counter.current
    c.frames += 1
    c.seconds += delta
    if (c.seconds >= 0.5) {
      setFps(Math.round(c.frames / c.seconds))
      c.frames = 0
      c.seconds = 0
    }
  })

  return null
}

/**
 * The one place that owns the WebGL renderer. Everything 3D in the game is a child of this.
 * Settings come from the graphics profile so mobile performance can be tuned in one file.
 */
export function GameCanvas({ children }: { children: ReactNode }) {
  const profile = GRAPHICS_PROFILES[DEFAULT_QUALITY]
  const [contextLost, setContextLost] = useState(false)

  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, profile.maxDpr]}
        shadows={profile.shadows}
        camera={{ position: [0, 12, 34], fov: 50, near: 0.1, far: 400 }}
        gl={{
          antialias: profile.antialias,
          alpha: false,
          stencil: false,
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl }) => {
          // Phones can drop the GL context (app switch, memory pressure). three.js restores it
          // when the default is prevented; we just tell the player what is happening.
          gl.domElement.addEventListener('webglcontextlost', (event) => {
            event.preventDefault()
            setContextLost(true)
          })
          gl.domElement.addEventListener('webglcontextrestored', () => setContextLost(false))
        }}
      >
        {children}
        <FpsMeter />
      </Canvas>

      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70 px-6 text-center text-white">
          Graphics were interrupted by the device. Restoring…
        </div>
      )}
    </div>
  )
}
