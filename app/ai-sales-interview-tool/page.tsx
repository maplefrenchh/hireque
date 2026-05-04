export default function AISalesInterviewToolPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-blue-300">
          AI Sales Interview Tool
        </p>

        <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
          Screen sales candidates with realistic AI roleplay.
        </h1>

        <p className="mb-8 max-w-2xl text-lg text-slate-300">
          Hireque helps teams test discovery, objection handling, persuasion,
          closing ability, and customer control before candidates reach the floor.
        </p>

        <a
          href="/signup"
          className="inline-flex rounded-xl bg-white px-6 py-3 font-semibold text-slate-950 hover:bg-slate-200"
        >
          Start screening candidates
        </a>
      </div>
    </main>
  );
}
