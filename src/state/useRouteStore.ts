import { create } from 'zustand'

interface RouteStore {
  /** The clock (minutes since midnight) when she reached the university's forecourt; null until then. */
  arrivedAt: number | null
  arrive: (minutes: number) => void
  /** A new game starts the drive again. */
  reset: () => void
}

/** Where the drive to the university stands (Stage 7). Distance, arrow and instruction are worked out from the position by the HUD. */
export const useRouteStore = create<RouteStore>()((set) => ({
  arrivedAt: null,
  arrive: (minutes) => set({ arrivedAt: minutes }),
  reset: () => set({ arrivedAt: null }),
}))
