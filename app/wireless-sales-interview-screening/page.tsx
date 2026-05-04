export const metadata = {
  title: "Wireless Sales Interview Screening Software | Hireque",
  description:
    "Screen wireless sales candidates using real customer simulations. Identify weak hires before they reach your store.",
};

export default function Page() {
  return (
    <main className="min-h-screen bg-[#050914] text-white px-6 py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-black">
          Wireless Sales Interview Screening Software
        </h1>

        <p className="mt-6 text-lg text-slate-300">
          Hiring wireless sales reps is risky. One wrong hire can hurt revenue,
          customer experience, and store performance.
        </p>

        <p className="mt-4 text-lg text-slate-300">
          Hireque simulates real customer conversations so you can evaluate how
          candidates handle objections, discover needs, and close deals — before
          hiring them.
        </p>

        <h2 className="mt-10 text-2xl font-bold">What Hireque tests</h2>
        <ul className="mt-4 space-y-2 text-slate-300">
          <li>• Discovery questions and customer understanding</li>
          <li>• Objection handling in real scenarios</li>
          <li>• Ability to recommend correct plans</li>
          <li>• Closing behavior and next steps</li>
        </ul>

        <h2 className="mt-10 text-2xl font-bold">Why it works</h2>
        <p className="mt-4 text-slate-300">
          Traditional interviews rely on rehearsed answers. Hireque forces
          candidates into real situations where weak skills get exposed.
        </p>

        <a
          href="/pricing"
          className="mt-10 inline-block bg-blue-600 px-6 py-3 rounded-xl font-bold"
        >
          View pricing
        </a>
      </div>
    </main>
  );
}
