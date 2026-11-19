// Simulates the route pilot on plain Node: prints where the car is every few seconds. Usage:
//   node scripts/sim-route.mjs [cruise m/s] [lag s] [look m]
import { driveRoute } from './route-pilot.mjs'

const cruise = Number(process.argv[2] ?? 13)
const lag = Number(process.argv[3] ?? 0)
const look = process.argv[4] === undefined ? undefined : Number(process.argv[4])
const f1 = (v) => v.toFixed(1)
const r = driveRoute({
  cruise,
  lag,
  look,
  every: 3,
  trace: (t, c, u) => console.log(`t ${f1(t).padStart(5)}  x ${f1(c.x).padStart(7)} z ${f1(c.z).padStart(7)}  v ${f1(c.speed).padStart(4)}  s ${f1(u.s).padStart(6)}  off ${f1(u.off).padStart(4)}  gas ${u.throttle.toFixed(2)} brk ${u.brake.toFixed(2)} str ${u.steer.toFixed(2)}`),
})
console.log(r.arrivedAt === null ? `NOT ARRIVED after ${f1(r.t)} s at ${f1(r.car.x)}, ${f1(r.car.z)}` : `arrived after ${f1(r.arrivedAt)} s`)
console.log(`clipped: ${r.clipped ?? 'no'}; farthest from the route ${f1(r.off)} m at ${r.offAt}; top speed ${f1(r.maxSpeed * 3.6)} km/h`)
