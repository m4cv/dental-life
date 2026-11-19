import { create } from 'zustand'

interface DriveStore {
  /** True while she is sitting in the car. */
  driving: boolean
  /** Speed in km/h and the gear shown on the dashboard (D drive, R reverse), published four times a second. */
  kmh: number
  gear: 'D' | 'R'
}

/** Written by the player rig; read by the pedals, the Get in / Get out button and the speedometer. */
export const useDriveStore = create<DriveStore>()(() => ({ driving: false, kmh: 0, gear: 'D' }))
