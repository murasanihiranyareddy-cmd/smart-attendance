import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Navigation */}
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 font-bold">
            S
          </div>

          <span className="text-xl font-bold tracking-tight">
            SmartAttend
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Login
          </Link>

          <Link
            href="/signup"
            className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold transition hover:bg-blue-400"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto flex max-w-7xl flex-col items-center px-6 pb-24 pt-20 text-center">
        <div className="mb-6 rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-sm text-blue-300">
          Attendance tracking, made smarter.
        </div>

        <h1 className="max-w-4xl text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
          Your attendance.
          <br />
          <span className="text-blue-400">Simplified.</span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
          Upload your timetable, let SmartAttend organize your classes,
          and track your attendance without the daily headache.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-2xl bg-blue-500 px-7 py-4 font-semibold transition hover:bg-blue-400"
          >
            Get Started →
          </Link>

          <Link
            href="/login"
            className="rounded-2xl border border-white/10 px-7 py-4 font-semibold text-slate-200 transition hover:bg-white/5"
          >
            I already have an account
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 md:grid-cols-3">
        <Feature
          icon="📷"
          title="Upload your timetable"
          description="Send a timetable image and SmartAttend extracts your subjects and class timings."
        />

        <Feature
          icon="📊"
          title="Track attendance"
          description="See subject-wise attendance, overall percentage, and exactly where you stand."
        />

        <Feature
          icon="🔔"
          title="Never forget"
          description="Get reminders to record attendance and keep your records up to date."
        />
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-white/10 px-6 py-20 text-center">
        <h2 className="text-3xl font-bold">
          Stop calculating attendance manually.
        </h2>

        <p className="mt-4 text-slate-400">
          Let SmartAttend do the work.
        </p>

        <Link
          href="/signup"
          className="mt-8 inline-block rounded-2xl bg-blue-500 px-7 py-4 font-semibold transition hover:bg-blue-400"
        >
          Create your account
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} SmartAttend. Built for students.
      </footer>
    </main>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-7 transition hover:bg-white/[0.06]">
      <div className="text-3xl">{icon}</div>

      <h3 className="mt-5 text-xl font-semibold">
        {title}
      </h3>

      <p className="mt-3 leading-7 text-slate-400">
        {description}
      </p>
    </div>
  );
}