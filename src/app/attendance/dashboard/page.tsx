"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type TimetableEntry = {
  id: string;
  subject_name: string;
};

type ScheduledClass = {
  id: string;
  timetable_entry_id: string;
};

type AttendanceRecord = {
  scheduled_class_id: string;
  status: string;
};

type SubjectStats = {
  subject: string;
  total: number;
  present: number;
  absent: number;
  percentage: number;
  canMiss: number;
  needToAttend: number;
};

export default function AttendanceDashboard() {
  const [stats, setStats] = useState<SubjectStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      // 1. Get logged-in user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw new Error(authError.message);
      }

      if (!user) {
        throw new Error("You are not logged in.");
      }

      // 2. Get user's timetable entries
      const { data: timetableData, error: timetableError } =
        await supabase
          .from("timetable_entries")
          .select("id, subject_name")
          .eq("user_id", user.id);

      if (timetableError) {
        throw new Error(
          "Timetable error: " + timetableError.message
        );
      }

      const timetable =
        (timetableData || []) as TimetableEntry[];

      if (timetable.length === 0) {
        setStats([]);
        return;
      }

      // 3. Create timetable ID -> subject map
      const subjectMap = new Map<string, string>();

      timetable.forEach((entry) => {
        subjectMap.set(
          entry.id,
          entry.subject_name
        );
      });

      const timetableIds = timetable.map(
        (entry) => entry.id
      );

      // 4. Get scheduled classes
      const {
        data: scheduledData,
        error: scheduledError,
      } = await supabase
        .from("scheduled_classes")
        .select("id, timetable_entry_id")
        .in("timetable_entry_id", timetableIds);

      if (scheduledError) {
        throw new Error(
          "Scheduled classes error: " +
            scheduledError.message
        );
      }

      const scheduledClasses =
        (scheduledData || []) as ScheduledClass[];

      if (scheduledClasses.length === 0) {
        setStats([]);
        return;
      }

      // 5. Create scheduled class ID -> subject map
      const scheduledSubjectMap = new Map<
        string,
        string
      >();

      scheduledClasses.forEach((scheduledClass) => {
        const subject = subjectMap.get(
          scheduledClass.timetable_entry_id
        );

        if (subject) {
          scheduledSubjectMap.set(
            scheduledClass.id,
            subject
          );
        }
      });

      const scheduledIds = scheduledClasses.map(
        (item) => item.id
      );

      // 6. Get attendance records
      const {
        data: attendanceData,
        error: attendanceError,
      } = await supabase
        .from("attendance")
        .select("scheduled_class_id, status")
        .in("scheduled_class_id", scheduledIds);

      if (attendanceError) {
        throw new Error(
          "Attendance error: " +
            attendanceError.message
        );
      }

      const attendance =
        (attendanceData || []) as AttendanceRecord[];

      // 7. Calculate statistics
      const subjectStats = new Map<
        string,
        {
          total: number;
          present: number;
          absent: number;
        }
      >();

      attendance.forEach((record) => {
        const subject = scheduledSubjectMap.get(
          record.scheduled_class_id
        );

        if (!subject) {
          return;
        }

        if (
          record.status !== "present" &&
          record.status !== "absent"
        ) {
          return;
        }

        if (!subjectStats.has(subject)) {
          subjectStats.set(subject, {
            total: 0,
            present: 0,
            absent: 0,
          });
        }

        const current =
          subjectStats.get(subject)!;

        current.total++;

        if (record.status === "present") {
          current.present++;
        }

        if (record.status === "absent") {
          current.absent++;
        }
      });

      // 8. Build final statistics
      const result: SubjectStats[] = Array.from(
        subjectStats.entries()
      )
        .map(([subject, data]) => {
          const percentage =
            data.total > 0
              ? Math.round(
                  (data.present / data.total) * 100
                )
              : 0;

          let canMiss = 0;
          let needToAttend = 0;

          // If attendance is already >= 75%
          // calculate how many future classes
          // can be missed while remaining >= 75%.
          if (percentage >= 75) {
            while (
              data.present /
                (data.total + canMiss + 1) >=
              0.75
            ) {
              canMiss++;
            }
          }

          // If attendance is below 75%
          // calculate how many consecutive classes
          // must be attended to reach 75%.
          else {
            while (
              (data.present + needToAttend) /
                (data.total + needToAttend) <
              0.75
            ) {
              needToAttend++;

              if (needToAttend > 1000) {
                break;
              }
            }
          }

          return {
            subject,
            total: data.total,
            present: data.present,
            absent: data.absent,
            percentage,
            canMiss,
            needToAttend,
          };
        })
        .sort((a, b) =>
          a.subject.localeCompare(b.subject)
        );

      setStats(result);
    } catch (err) {
      console.error(
        "Attendance dashboard error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load attendance dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  // Overall statistics
  const totalClasses = stats.reduce(
    (sum, item) => sum + item.total,
    0
  );

  const totalPresent = stats.reduce(
    (sum, item) => sum + item.present,
    0
  );

  const totalAbsent = stats.reduce(
    (sum, item) => sum + item.absent,
    0
  );

  const overallPercentage =
    totalClasses > 0
      ? Math.round(
          (totalPresent / totalClasses) * 100
        )
      : 0;

  // Status helper
  function getStatus(percentage: number) {
    if (percentage >= 75) {
      return {
        label: "Good",
        className: "text-green-400",
      };
    }

    if (percentage >= 65) {
      return {
        label: "Needs Attention",
        className: "text-yellow-400",
      };
    }

    return {
      label: "Low",
      className: "text-red-400",
    };
  }

  // Overall attendance color
  function getOverallColor() {
    if (overallPercentage >= 75) {
      return "text-green-400";
    }

    if (overallPercentage >= 65) {
      return "text-yellow-400";
    }

    return "text-red-400";
  }

  // Progress bar color
  function getProgressColor(
    percentage: number
  ) {
    if (percentage >= 75) {
      return "bg-green-500";
    }

    if (percentage >= 65) {
      return "bg-yellow-500";
    }

    return "bg-red-500";
  }

  // Loading screen
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">
            📊
          </div>

          <p className="text-slate-300">
            Loading attendance dashboard...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <a
            href="/attendance"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            ← Today's attendance
          </a>

          <h1 className="text-3xl md:text-4xl font-bold mt-3">
            📊 Attendance Dashboard
          </h1>

          <p className="text-slate-400 mt-1">
            Track and predict your attendance
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="font-semibold text-red-300">
              ⚠️ Unable to load attendance dashboard
            </p>

            <p className="text-red-200 mt-1 break-words">
              {error}
            </p>

            <button
              onClick={loadDashboard}
              className="mt-4 rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-2 text-sm hover:bg-red-500/30"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Overall statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

          {/* Overall attendance */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">
              OVERALL ATTENDANCE
            </p>

            <p
              className={
                "text-4xl font-bold mt-2 " +
                getOverallColor()
              }
            >
              {overallPercentage}%
            </p>

            <p className="text-xs text-slate-500 mt-2">
              Required: 75%
            </p>
          </div>

          {/* Present */}
          <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-6">
            <p className="text-sm text-green-300">
              PRESENT
            </p>

            <p className="text-4xl font-bold text-green-400 mt-2">
              {totalPresent}
            </p>

            <p className="text-xs text-slate-500 mt-2">
              Classes attended
            </p>
          </div>

          {/* Absent */}
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
            <p className="text-sm text-red-300">
              ABSENT
            </p>

            <p className="text-4xl font-bold text-red-400 mt-2">
              {totalAbsent}
            </p>

            <p className="text-xs text-slate-500 mt-2">
              Classes missed
            </p>
          </div>

          {/* Total */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">
              TOTAL MARKED
            </p>

            <p className="text-4xl font-bold mt-2">
              {totalClasses}
            </p>

            <p className="text-xs text-slate-500 mt-2">
              Present + absent
            </p>
          </div>

        </div>

        {/* Empty state */}
        {stats.length === 0 && !error && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            <div className="text-5xl mb-4">
              📚
            </div>

            <h2 className="text-xl font-bold">
              No attendance recorded yet
            </h2>

            <p className="text-slate-400 mt-2">
              Mark your classes as Present or
              Absent to see statistics here.
            </p>

            <a
              href="/attendance"
              className="inline-block mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold hover:bg-blue-500"
            >
              Go to Attendance
            </a>
          </div>
        )}

        {/* Subject cards */}
        <div className="space-y-4">
          {stats.map((item) => {
            const status = getStatus(
              item.percentage
            );

            return (
              <div
                key={item.subject}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
              >

                {/* Subject header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                  <div>
                    <h2 className="text-xl font-bold">
                      {item.subject}
                    </h2>

                    <p className="text-sm text-slate-400 mt-1">
                      {item.present} present
                      {" • "}
                      {item.absent} absent
                      {" • "}
                      {item.total} marked
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-3xl font-bold">
                      {item.percentage}%
                    </p>

                    <p
                      className={
                        "text-sm " +
                        status.className
                      }
                    >
                      {status.label}
                    </p>
                  </div>

                </div>

                {/* Progress bar */}
                <div className="mt-5">
                  <div className="relative h-3 rounded-full bg-slate-800 overflow-hidden">

                    <div
                      className={
                        "h-full rounded-full transition-all " +
                        getProgressColor(
                          item.percentage
                        )
                      }
                      style={{
                        width:
                          Math.min(
                            item.percentage,
                            100
                          ) + "%",
                      }}
                    />

                  </div>
                </div>

                {/* 75% marker */}
                <div className="relative mt-1 h-3">
                  <div
                    className="absolute top-0 bottom-0 w-px bg-white/30"
                    style={{
                      left: "75%",
                    }}
                  />
                </div>

                {/* Predictor */}
                {item.percentage >= 75 ? (
                  <div className="mt-3 rounded-xl border border-green-500/20 bg-green-500/10 p-4">

                    <p className="text-green-400 font-semibold">
                      🟢 Attendance is safe
                    </p>

                    <p className="text-sm text-slate-300 mt-1">
                      You can miss{" "}
                      <strong className="text-white">
                        {item.canMiss}
                      </strong>{" "}
                      more{" "}
                      {item.canMiss === 1
                        ? "class"
                        : "classes"}{" "}
                      and still maintain at least
                      75%.
                    </p>

                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4">

                    <p className="text-red-400 font-semibold">
                      🔴 Attendance is below 75%
                    </p>

                    <p className="text-sm text-slate-300 mt-1">
                      Attend the next{" "}
                      <strong className="text-white">
                        {item.needToAttend}
                      </strong>{" "}
                      consecutive{" "}
                      {item.needToAttend === 1
                        ? "class"
                        : "classes"}{" "}
                      to reach 75%.
                    </p>

                  </div>
                )}

                {/* Scale */}
                <div className="mt-4 flex justify-between text-xs text-slate-500">
                  <span>0%</span>
                  <span>Required: 75%</span>
                  <span>100%</span>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </main>
  );
}