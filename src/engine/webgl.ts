/**
 * three.js (r163+) needs WebGL 2. This probes support once, up front, so the game can show
 * a clear message instead of a blank screen on an unsupported browser.
 */
export function detectWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) return false
    // Free the probe context immediately; mobile browsers cap the number of live contexts.
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}
