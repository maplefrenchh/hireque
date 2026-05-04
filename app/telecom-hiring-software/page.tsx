export const metadata = {
  title: "Telecom Hiring Software | Hireque",
  description:
    "Hire better telecom sales and support staff using AI simulations. Reduce bad hires and improve performance.",
};

export default function Page() {
  return (
    <main className="min-h-screen bg-[#050914] text-white px-6 py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-black">
          Telecom Hiring Software
        </h1>

        <p className="mt-6 text-lg text-slate-300">
          Telecom hiring requires candidates who can handle real customers, objections, and service issues.
        </p>

        <p className="mt-4 text-lg text-slate-300">
          Hireque helps telecom companies screen candidates using realistic simulations before hiring decisions.
        </p>

        <a href="/pricing" className="mt-10 inline-block bg-blue-600 px-6 py-3 rounded-xl font-bold">
          View pricing
        </a>
      </div>
    </main>
  );
}
