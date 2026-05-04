export default function WirelessSalesInterviewScreeningPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-orange-300">
          Wireless Sales Interview Screening
        </p>

        <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
          Find wireless sales reps who can actually sell.
        </h1>

        <p className="mb-8 max-w-2xl text-lg text-slate-300">
          Hireque tests price objections, plan comparisons, upgrade pressure,
          discovery, bundles, closing, and real retail sales judgment.
        </p>

        <a
          href="/signup"
          className="inline-flex rounded-xl bg-white px-6 py-3 font-semibold text-slate-950 hover:bg-slate-200"
        >
          Start free test
        </a>
      </div>
    </main>
  );
}
