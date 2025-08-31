import type { Metadata } from "next"
import TrainScheduler from "@/components/train-scheduler"

export const metadata: Metadata = {
  title: "Train Scheduler (AI-DSS Scoring)",
  description:
    "Live train statuses (6 on-time, 2 delayed) with AI-DSS scoring for platform assignment, balancing gaps and delays.",
}

export default function Page() {
  return (
    <main className="font-sans">
      <section className="px-6 py-8">
        <h1 className="text-balance text-3xl font-semibold text-blue-600">Live Train Platform Scheduler</h1>
      </section>

      <section className="px-6 pb-10">
        <TrainScheduler />
      </section>
    </main>
  )
}
