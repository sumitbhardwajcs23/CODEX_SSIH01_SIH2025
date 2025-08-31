import TrainScheduler from "@/components/train-scheduler"

export default function Page() {
  return (
    <main className="font-sans" aria-labelledby="page-title">
      <section className="px-6 py-8">
        <h1 id="page-title" className="text-balance text-3xl font-semibold text-primary">
          Live Train Platform Scheduler
        </h1>
      </section>

      <section className="px-6 pb-10">
        <TrainScheduler />
      </section>
    </main>
  )
}
