export const metadata = {
  title: "AI Sales Interview Tool | Hireque",
  description:
    "Use AI-powered customer simulations to evaluate sales candidates. Identify top performers before hiring.",
};

export default function Page() {
  return (
    <main className="min-h-screen bg-[#050914] text-white px-6 py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-black">
          AI Sales Interview Tool
        </h1>

        <p className="mt-6 text-lg text-slate-300">
          Most sales interviews fail to reveal real ability. Candidates give rehearsed answers that don’t reflect actual performance.
        </p>

        <p className="mt-4 text-lg text-slate-300">
          Hireque uses AI-driven simulations to test how candidates handle real customer conversations.
        </p>

        <a href="/pricing" className="mt-10 inline-block bg-blue-600 px-6 py-3 rounded-xl font-bold">
          View pricing
        </a>
      </div>
    </main>
  );
}
