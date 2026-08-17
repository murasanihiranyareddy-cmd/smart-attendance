"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function OnboardingPage() {
  const router = useRouter();

  const [college, setCollege] = useState("");
  const [course, setCourse] = useState("");
  const [semester, setSemester] = useState("");
  const [attendanceTarget, setAttendanceTarget] = useState("75");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        college,
        course,
      })
      .eq("id", user.id);

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    const { error: semesterError } = await supabase
      .from("semesters")
      .insert({
        user_id: user.id,
        name: semester,
        attendance_target: Number(attendanceTarget),
      });

    if (semesterError) {
      setError(semesterError.message);
      setLoading(false);
      return;
    }

    setLoading(false);

    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-10">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500 text-xl font-bold">
            S
          </div>

          <p className="text-sm font-medium text-blue-400">
            Let's get you set up
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Tell us about your studies
          </h1>

          <p className="mt-3 text-slate-400">
            We'll use this information to personalize your attendance
            dashboard.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-8"
        >
          <div>
            <label className="mb-2 block text-sm font-medium">
              College / University
            </label>

            <input
              type="text"
              value={college}
              onChange={(event) => setCollege(event.target.value)}
              placeholder="Your college name"
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none placeholder:text-slate-600 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Course
            </label>

            <input
              type="text"
              value={course}
              onChange={(event) => setCourse(event.target.value)}
              placeholder="Example: B.Tech CSE"
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none placeholder:text-slate-600 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Current semester
            </label>

            <input
              type="text"
              value={semester}
              onChange={(event) => setSemester(event.target.value)}
              placeholder="Example: Semester 5"
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none placeholder:text-slate-600 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Attendance target
            </label>

            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="100"
                value={attendanceTarget}
                onChange={(event) =>
                  setAttendanceTarget(event.target.value)
                }
                className="w-32 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-500"
              />

              <span className="text-slate-400">%</span>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              You can change this later.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-500 px-5 py-3 font-semibold transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Saving..." : "Continue →"}
          </button>
        </form>
      </div>
    </main>
  );
}