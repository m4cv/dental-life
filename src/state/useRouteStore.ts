import { create } from 'zustand'

interface RouteStore {
  /** The clock (minutes since midnight) when she reached the university's forecourt; null until then. */
  arrivedAt: number | null
  arrive: (minutes: number) => void
  /** The clock when she first went in through the main entrance (Stage 8); null until then. */
  enteredAt: number | null
  enter: (minutes: number) => void
  /** A new game starts the drive again. */
  reset: () => void
}

/** Where the drive to the university stands (Stage 7) and whether she has gone inside (Stage 8). Distance, arrow and instruction are worked out from the position by the HUD. */
export const useRouteStore = create<RouteStore>()((set) => ({
  arrivedAt: null,
  arrive: (minutes) => set({ arrivedAt: minutes }),
  enteredAt: null,
  enter: (minutes) => set({ enteredAt: minutes }),
  reset: () => set({ arrivedAt: null, enteredAt: null }),
}))
