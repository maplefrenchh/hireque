export const metadata = {
  title: "Wireless Customer Service Screening Software | Hireque",
  description:
    "Screen wireless customer service candidates using real scenarios. Test empathy, de-escalation, and resolution skills before hiring.",
};

export default function Page() {
  return (
    <main className="min-h-screen bg-[#050914] text-white px-6 py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-black">
          Wireless Customer Service Screening Software
        </h1>

        <p className="mt-6 text-lg text-slate-300">
          Customer service roles require real empathy, listening, and control under pressure.
        </p>

        <p className="mt-4 text-lg text-slate-300">
          Hireque simulates real customer issues so you can evaluate how candidates respond in stressful situations.
        </p>

        <h2 className="mt-10 text-2xl font-bold">What Hireque tests</h2>
        <ul className="mt-4 space-y-2 text-slate-300">
          <li>• Listening and empathy</li>
          <li>• De-escalation skills</li>
          <li>• Problem-solving and clarity</li>
          <li>• Ownership and resolution quality</li>
        </ul>

        <a href="/pricing" className="mt-10 inline-block bg-blue-600 px-6 py-3 rounded-xl font-bold">
          View pricing
        </a>
      </div>
    </main>
  );
}
