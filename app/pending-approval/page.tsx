export default function PendingApprovalPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400/10 text-2xl">
          ⏳
        </div>

        <h1 className="text-3xl font-black">Company approval pending</h1>

        <p className="mt-4 text-white/65">
          Your company account is under review. Dashboard access will unlock after approval.
        </p>

        <p className="mt-6 text-sm text-white/40">
          This protects Hireque from fake companies, spam, and unauthorized screening usage.
        </p>
      </div>
    </main>
  );
}
