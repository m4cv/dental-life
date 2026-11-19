import { useEffect, useState } from 'react'

/** Current window size in CSS px; updates on resize and on phone rotation. */
export function useViewport(): { w: number; h: number } {
  const read = () => ({ w: window.innerWidth, h: window.innerHeight })
  const [size, setSize] = useState(read)

  useEffect(() => {
    const onChange = () =>
      setSize((prev) => {
        const next = read()
        return prev.w === next.w && prev.h === next.h ? prev : next
      })
    window.addEventListener('resize', onChange)
    window.addEventListener('orientationchange', onChange)
    return () => {
      window.removeEventListener('resize', onChange)
      window.removeEventListener('orientationchange', onChange)
    }
  }, [])

  return size
}
