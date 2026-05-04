export default function WirelessCustomerServiceScreeningPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">
          Wireless Customer Service Screening
        </p>

        <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
          Test wireless support candidates before hiring them.
        </h1>

        <p className="mb-8 max-w-2xl text-lg text-slate-300">
          Simulate billing confusion, upgrade questions, angry customers,
          troubleshooting, and retention scenarios with strict AI scoring.
        </p>

        <a
          href="/signup"
          className="inline-flex rounded-xl bg-white px-6 py-3 font-semibold text-slate-950 hover:bg-slate-200"
        >
          Try Hireque
        </a>
      </div>
    </main>
  );
}
