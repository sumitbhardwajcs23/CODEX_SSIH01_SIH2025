"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

type Train = {
  id: string
  name: string
  // scheduled times in minutes from 08:00 (0 = 08:00)
  arrival: number
  departure: number
  delay: number // minutes of delay (applies to both arrival & departure)
  status: "on-time" | "delayed"
}

type AssignedTrain = Train & {
  effectiveArrival: number
  effectiveDeparture: number
}

type Platform = {
  id: number
  trains: AssignedTrain[]
  nextFreeAt: number
}

const MINUTE_START = 0 // 08:00
const MINUTE_END = 240 // 12:00, 4 hours window

function minutesToLabel(minFromStart: number) {
  const totalMinutes = 8 * 60 + minFromStart // base is 08:00
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function minutesToLabelWithSeconds(minFromStart: number) {
  const baseSeconds = 8 * 60 * 60 // 08:00 in seconds
  const totalSeconds = Math.max(0, Math.round(minFromStart * 60)) + baseSeconds
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

function formatMinSec(mins: number) {
  const totalSeconds = Math.max(0, Math.round(mins * 60))
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

function LivePulse({ label }: { label: string }) {
  return (
    <span className="relative inline-flex items-center" aria-label={label}>
      <span
        className="absolute inline-flex h-2 w-2 rounded-full bg-emerald-500 opacity-75 animate-ping"
        aria-hidden="true"
      />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
    </span>
  )
}

function initializeTrains(): Train[] {
  // 18 trains across a 4-hour window
  return [
    { id: "T1", name: "Red Line 101", arrival: 10, departure: 40, delay: 0, status: "on-time" },
    { id: "T2", name: "Coastal 202", arrival: 25, departure: 70, delay: 0, status: "on-time" },
    { id: "T3", name: "Express 303", arrival: 60, departure: 100, delay: 0, status: "on-time" },
    { id: "T4", name: "Metro 404", arrival: 80, departure: 120, delay: 0, status: "on-time" },
    { id: "T5", name: "Regional 505", arrival: 110, departure: 150, delay: 0, status: "on-time" },
    { id: "T6", name: "CityLink 606", arrival: 140, departure: 175, delay: 0, status: "on-time" },
    { id: "T7", name: "Valley 707", arrival: 170, departure: 205, delay: 0, status: "on-time" },
    { id: "T8", name: "Summit 808", arrival: 195, departure: 235, delay: 0, status: "on-time" },

    // Added trains
    { id: "T9", name: "Harbor 909", arrival: 0, departure: 20, delay: 0, status: "on-time" },
    { id: "T10", name: "Forest 919", arrival: 18, departure: 55, delay: 0, status: "on-time" },
    { id: "T11", name: "River 929", arrival: 45, departure: 85, delay: 0, status: "on-time" },
    { id: "T12", name: "Garden 939", arrival: 90, departure: 125, delay: 0, status: "on-time" },
    { id: "T13", name: "Meadow 949", arrival: 105, departure: 140, delay: 0, status: "on-time" },
    { id: "T14", name: "Cedar 959", arrival: 130, departure: 165, delay: 0, status: "on-time" },
    { id: "T15", name: "Pine 969", arrival: 155, departure: 190, delay: 0, status: "on-time" },
    { id: "T16", name: "Oak 979", arrival: 165, departure: 200, delay: 0, status: "on-time" },
    { id: "T17", name: "Spruce 989", arrival: 200, departure: 235, delay: 0, status: "on-time" },
    { id: "T18", name: "Willow 999", arrival: 210, departure: 240, delay: 0, status: "on-time" },
  ]
}

// Greedy platform assignment:
// - Sort by effective arrival (arrival + delay)
// - Place train on earliest platform free by its arrival; else open a new platform
type ScoringWeights = {
  // smaller idle gap preferred to pack trains (minimize gaps)
  idleGap: number
  // lightly discourage putting too many trains on one platform (load balancing)
  load: number
  // spread delayed trains across platforms to reduce clustering
  delayedSpread: number
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  idleGap: 1.0,
  load: 0.3,
  delayedSpread: 0.5,
}

function assignPlatformsScoreBased(trains: Train[], weights: ScoringWeights = DEFAULT_WEIGHTS): Platform[] {
  const withEffective: AssignedTrain[] = trains.map((t) => ({
    ...t,
    effectiveArrival: t.arrival + t.delay,
    effectiveDeparture: t.departure + t.delay,
  }))

  withEffective.sort((a, b) => a.effectiveArrival - b.effectiveArrival)

  const platforms: Platform[] = []

  for (const train of withEffective) {
    let bestIdx = -1
    let bestScore = Number.POSITIVE_INFINITY

    for (let i = 0; i < platforms.length; i++) {
      const pl = platforms[i]
      // feasibility: platform must be free by train.effectiveArrival
      if (pl.nextFreeAt <= train.effectiveArrival) {
        const gap = Math.max(0, train.effectiveArrival - pl.nextFreeAt)
        const load = pl.trains.length
        const delayedCount = pl.trains.reduce((acc, t) => acc + (t.status === "delayed" ? 1 : 0), 0)

        const score = weights.idleGap * gap + weights.load * load + weights.delayedSpread * delayedCount

        if (score < bestScore) {
          bestScore = score
          bestIdx = i
        }
      }
    }

    if (bestIdx >= 0) {
      const pl = platforms[bestIdx]
      pl.trains.push(train)
      pl.nextFreeAt = train.effectiveDeparture
    } else {
      platforms.push({
        id: platforms.length + 1,
        trains: [train],
        nextFreeAt: train.effectiveDeparture,
      })
    }
  }

  return platforms
}

export default function TrainScheduler() {
  const [trains, setTrains] = React.useState<Train[]>(() => initializeTrains())

  // Maintain exactly 2 delayed trains; update their delay magnitudes periodically
  React.useEffect(() => {
    function tick() {
      setTrains((prev) => {
        const ids = prev.map((t) => t.id)
        const shuffled = [...ids].sort(() => Math.random() - 0.5)
        const delayedIds = new Set(shuffled.slice(0, 2)) // exactly 2

        return prev.map((t) => {
          if (delayedIds.has(t.id)) {
            const newDelay = 5 + Math.floor(Math.random() * 14) // 5-18 minutes
            return { ...t, delay: newDelay, status: "delayed" }
          } else {
            return { ...t, delay: 0, status: "on-time" }
          }
        })
      })
    }

    tick()
    const iv = setInterval(tick, 4000) // update every 4s
    return () => clearInterval(iv)
  }, [])

  const platforms = React.useMemo(() => assignPlatformsScoreBased(trains), [trains])

  const platformMetrics = React.useMemo(() => {
    const map = new Map<number, { endMetric: number; totalDelay: number; delayedCount: number; totalTrains: number }>()
    for (const pl of platforms) {
      const totalTrains = pl.trains.length
      const totalDelay = pl.trains.reduce((sum, t) => sum + t.delay, 0)
      const delayedCount = pl.trains.filter((t) => t.status === "delayed").length
      const endMetric = totalTrains > 0 ? (totalDelay + delayedCount) / totalTrains : 0
      map.set(pl.id, { endMetric, totalDelay, delayedCount, totalTrains })
    }
    return map
  }, [platforms])

  const delayComparisonData = React.useMemo(() => {
    return platforms.flatMap((pl) => {
      const metrics = platformMetrics.get(pl.id)
      const endMetric = metrics ? metrics.endMetric : 0
      return pl.trains.map((t) => {
        const prev = t.delay
        // New Delay (Reach Table) = |(Sched.Dep + End Time) - (Sched.Dep + Prev Delay)| = |End Time - Prev Delay|
        const reachTableNewDelay = Math.abs(endMetric - prev)
        return {
          train: t.id,
          fullName: t.name,
          prevDelay: prev, // Train Details delay
          newDelay: Number(reachTableNewDelay.toFixed(2)), // Reach Table New Delay (absolute)
        }
      })
    })
  }, [platforms, platformMetrics])

  const delayedCount = trains.filter((t) => t.status === "delayed").length
  const onTimeCount = trains.length - delayedCount

  const minStart = MINUTE_START
  const maxEnd = MINUTE_END
  const total = maxEnd - minStart

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Platforms Used" value={String(platforms.length)} className="border-border" />
        <StatCard
          label="On-Time"
          value={String(onTimeCount)}
          pillLabel="on-time"
          pillClass="bg-emerald-500 text-white"
          className="border-border"
        />
        <StatCard
          label="Delayed"
          value={String(delayedCount)}
          pillLabel="delayed"
          pillClass="bg-rose-500 text-white"
          className="border-border"
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4">
        <Legend swatchClass="bg-emerald-500" label="On-time" />
        <Legend swatchClass="bg-rose-500" label="Delayed" />
      </div>

      {/* Timeline */}
      <div className="flex flex-col gap-6">
        <TimeScale />

        <div className="flex flex-col gap-6">
          {platforms.map((p) => (
            <div key={p.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-primary">Platform {p.id}</h3>
                <span className="text-sm text-foreground">
                  {p.trains.length} train{p.trains.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="relative w-full border border-border p-3">
                <div
                  className="relative h-16 w-full"
                  role="group"
                  aria-label={`Timeline for Platform ${p.id} from 08:00 to 12:00`}
                >
                  {p.trains.map((t) => {
                    const start = t.effectiveArrival
                    const end = t.effectiveDeparture
                    const leftPct = ((start - minStart) / total) * 100
                    const widthPct = ((end - start) / total) * 100

                    const isDelayed = t.status === "delayed"
                    const blockClass = isDelayed ? "bg-rose-500" : "bg-emerald-500"

                    return (
                      <div
                        key={t.id}
                        className={cn("absolute top-0 h-full rounded-sm px-2 py-1 text-sm text-white", blockClass)}
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        aria-label={`${t.name} ${isDelayed ? "(delayed)" : "(on-time)"} from ${minutesToLabel(
                          t.effectiveArrival,
                        )} to ${minutesToLabel(t.effectiveDeparture)}`}
                        role="group"
                      >
                        <div className="flex h-full flex-col justify-between">
                          <div className="font-medium">
                            <span className="sr-only">{isDelayed ? "Delayed" : "On-time"} </span>
                            {t.name}
                          </div>
                          <div className="text-xs">
                            {minutesToLabel(t.effectiveArrival)} — {minutesToLabel(t.effectiveDeparture)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Train Details - moved above Scheduling Metrics */}
        <div className="mt-2">
          <h3 id="train-details-heading" className="mb-3 text-lg font-semibold text-primary">
            Train Details
          </h3>
          <div className="overflow-x-auto">
            <table
              className="w-full border border-border text-left text-sm"
              aria-labelledby="train-details-heading"
              role="table"
            >
              <thead>
                <tr className="bg-background">
                  <th scope="col" className="px-3 py-2">
                    Train
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Sched. Arr
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Sched. Dep
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Delay (min)
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Effective
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Platform
                  </th>
                </tr>
              </thead>
              <tbody>
                {platforms.flatMap((pl) =>
                  pl.trains.map((t) => (
                    <tr key={`${pl.id}-${t.id}`} className="odd:bg-background even:bg-background">
                      <td className="px-3 py-2 text-foreground">{t.name}</td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
                            t.status === "delayed" ? "bg-rose-500 text-white" : "bg-emerald-500 text-white",
                          )}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-foreground">{minutesToLabel(t.arrival)}</td>
                      <td className="px-3 py-2 text-foreground">{minutesToLabel(t.departure)}</td>
                      <td className="px-3 py-2 text-foreground">{t.delay}</td>
                      <td className="px-3 py-2 text-foreground">
                        {minutesToLabel(t.arrival + t.delay)} — {minutesToLabel(t.departure + t.delay)}
                      </td>
                      <td className="px-3 py-2 text-foreground">Platform {pl.id}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Scheduling Metrics - now below Train Details */}
        <div className="mt-6">
          <h3 id="scheduling-metrics-heading" className="mb-3 text-lg font-semibold text-primary">
            Scheduling Metrics
          </h3>
          <div className="overflow-x-auto">
            <table
              className="w-full border border-border text-left text-sm"
              aria-labelledby="scheduling-metrics-heading"
              role="table"
            >
              <thead>
                <tr className="bg-background">
                  <th scope="col" className="px-3 py-2">
                    Train
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Platform
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Previous Delay (min)
                  </th>
                  <th scope="col" className="px-3 py-2">
                    End Time (mm:ss)
                  </th>
                  <th scope="col" className="px-3 py-2">
                    New Delay
                  </th>
                </tr>
              </thead>
              <tbody>
                {platforms.flatMap((pl) => {
                  const metrics = platformMetrics.get(pl.id)
                  const endMetric = metrics ? metrics.endMetric : 0
                  return pl.trains.map((t) => {
                    const prevDelay = t.delay
                    const newDelay = Math.max(0, prevDelay - endMetric)
                    return (
                      <tr key={`metrics-${pl.id}-${t.id}`} className="odd:bg-background even:bg-background">
                        <td className="px-3 py-2 text-foreground">{t.name}</td>
                        <td className="px-3 py-2 text-foreground">Platform {pl.id}</td>
                        <td className="px-3 py-2 text-foreground">{prevDelay}</td>
                        <td className="px-3 py-2 text-foreground">
                          <div className="flex items-center gap-2">
                            <span>{formatMinSec(endMetric)}</span>
                            <LivePulse label="Live end time updating" />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-foreground">{newDelay.toFixed(2)}</td>
                      </tr>
                    )
                  })
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-foreground">
            End Time per platform = (sum of delay minutes on the platform + number of delayed trains on the platform) /
            total trains on the platform. New Delay = max(Previous Delay − End Time, 0).
          </p>
        </div>

        {/* Reach Time - remains last with Delay Comparison chart at the bottom */}
        <div className="mt-6">
          <h3 id="reach-time-heading" className="mb-3 text-lg font-semibold text-primary">
            Reach Time
          </h3>
          <div className="overflow-x-auto">
            <table
              className="w-full border border-border text-left text-sm"
              aria-labelledby="reach-time-heading"
              role="table"
            >
              <thead>
                <tr className="bg-background">
                  <th scope="col" className="px-3 py-2">
                    Train
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Platform
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Sched. Dep
                  </th>
                  <th scope="col" className="px-3 py-2">
                    End Time (mm:ss)
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Previous Delay (min)
                  </th>
                  <th scope="col" className="px-3 py-2">
                    New Delay (min)
                  </th>
                  <th scope="col" className="px-3 py-2">
                    New Reach Time (HH:mm:ss)
                  </th>
                </tr>
              </thead>
              <tbody>
                {platforms.flatMap((pl) => {
                  const metrics = platformMetrics.get(pl.id)
                  const endMetric = metrics ? metrics.endMetric : 0
                  return pl.trains.map((t) => {
                    const prevDelay = t.delay
                    // Old Reach Time = sched. departure + previous delay
                    const oldReachTime = t.departure + prevDelay
                    // New Reach Time = sched. departure + end time (platform end metric)
                    const newReachTime = t.departure + endMetric
                    // Signed minute difference (can be negative if improved)
                    const newDelayDelta = newReachTime - oldReachTime
                    const newDelayAbs = Math.abs(newReachTime - oldReachTime)

                    return (
                      <tr key={`reach-${pl.id}-${t.id}`} className="odd:bg-background even:bg-background">
                        <td className="px-3 py-2 text-foreground">{t.name}</td>
                        <td className="px-3 py-2 text-foreground">Platform {pl.id}</td>
                        <td className="px-3 py-2 text-foreground">{minutesToLabel(t.departure)}</td>
                        <td className="px-3 py-2 text-foreground">
                          <div className="flex items-center gap-2">
                            <span>{formatMinSec(endMetric)}</span>
                            <LivePulse label="Live end time updating" />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-foreground">{prevDelay}</td>
                        <td className="px-3 py-2 text-foreground">{newDelayAbs.toFixed(2)}</td>
                        <td className="px-3 py-2 text-foreground">{minutesToLabelWithSeconds(newReachTime)}</td>
                      </tr>
                    )
                  })
                })}
              </tbody>
            </table>
          </div>

          {/* Delay Comparison Chart */}
          <div className="mt-6">
            <h4 id="reach-delay-comparison-heading" className="mb-2 text-base font-semibold text-primary">
              Delay Comparison (Train Details vs Reach Table)
            </h4>
            <p className="mb-3 text-xs text-foreground">
              Compares Train Details delay with the New Delay used in Reach Time: absolute difference between End Time
              and Previous Delay.
            </p>
            <div className="overflow-x-auto">
              <ChartContainer
                config={{
                  prevDelay: { label: "Train Details Delay", color: "#64748B" },
                  newDelay: { label: "New Delay (Reach Table)", color: "#059669" },
                }}
                className="h-[320px] w-full rounded border border-border bg-background"
                role="img"
                aria-labelledby="reach-delay-comparison-heading"
              >
                <BarChart data={delayComparisonData} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="train" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} verticalAlign="bottom" />
                  <Bar dataKey="prevDelay" name="Train Details Delay" fill="var(--color-prevDelay)" radius={2} />
                  <Bar dataKey="newDelay" name="New Delay (Reach Table)" fill="var(--color-newDelay)" radius={2} />
                </BarChart>
              </ChartContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  pillLabel,
  pillClass,
  className,
}: {
  label: string
  value: string
  pillLabel?: string
  pillClass?: string
  className?: string
}) {
  return (
    <div className={cn("rounded border p-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-foreground">{label}</div>
          <div className="text-2xl font-semibold text-primary" aria-live="polite" aria-atomic="true">
            {value}
          </div>
        </div>
        {pillLabel ? <span className={cn("rounded px-2 py-1 text-xs font-medium", pillClass)}>{pillLabel}</span> : null}
      </div>
    </div>
  )
}

function Legend({ swatchClass, label }: { swatchClass: string; label: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className={cn("inline-block h-3 w-3 rounded", swatchClass)} aria-hidden="true" />
      <span className="text-sm text-foreground">{label}</span>
    </div>
  )
}

function TimeScale() {
  const ticks = [0, 30, 60, 90, 120, 150, 180, 210, 240]
  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex items-center justify-between" aria-hidden="true">
        {ticks.map((m) => (
          <span key={m} className="text-xs text-foreground">
            {minutesToLabel(m)}
          </span>
        ))}
      </div>
      <div className="h-px w-full bg-border" />
    </div>
  )
}
