"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type TimetableEntry = {
  id: string;
  subject_name: string;
};

type AttendanceRecord = {
  id: string;
  scheduled_class_id: string;
  attendance_date: string;
  status: string;
};

type HistoryItem = {
  id: string;
  subject: string;
  date: string;
  status: string;
};

export default function AttendanceHistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] =
    useState("All");

  const [selectedStatus, setSelectedStatus] =
    useState("All");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        throw new Error(
          "You are not logged in."
        );
      }

      /*
       * Get user's timetable classes.
       */

      const {
        data: timetableData,
        error: timetableError,
      } = await supabase
        .from("timetable_entries")
        .select(
          `
          id,
          subject_name
        `
        )
        .eq("user_id", user.id);

      if (timetableError) {
        throw timetableError;
      }

      const timetable =
        (timetableData || []) as TimetableEntry[];

      if (timetable.length === 0) {
        setHistory([]);
        return;
      }

      const classIds = timetable.map(
        (item) => item.id
      );

      /*
       * Create class ID -> subject map.
       */

      const subjectMap =
        new Map<string, string>();

      timetable.forEach((item) => {
        subjectMap.set(
          item.id,
          item.subject_name
        );
      });

      /*
       * Get attendance history.
       */

      const {
        data: attendanceData,
        error: attendanceError,
      } = await supabase
        .from("attendance")
        .select(
          `
          id,
          scheduled_class_id,
          attendance_date,
          status
        `
        )
        .in(
          "scheduled_class_id",
          classIds
        )
        .order(
          "attendance_date",
          {
            ascending: false,
          }
        );

      if (attendanceError) {
        throw attendanceError;
      }

      const attendance =
        (attendanceData ||
          []) as AttendanceRecord[];

      /*
       * Convert to history items.
       */

      const result: HistoryItem[] =
        attendance
          .map((record) => ({
            id: record.id,
            subject:
              subjectMap.get(
                record.scheduled_class_id
              ) || "Unknown subject",
            date: record.attendance_date,
            status: record.status,
          }))
          .sort((a, b) =>
            b.date.localeCompare(
              a.date
            )
          );

      setHistory(result);

      /*
       * Create subject filter list.
       */

      const uniqueSubjects =
        Array.from(
          new Set(
            result.map(
              (item) => item.subject
            )
          )
        ).sort();

      setSubjects(uniqueSubjects);
    } catch (err) {
      console.error(
        "History error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load attendance history."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * Apply filters.
   */

  const filteredHistory =
    history.filter((item) => {
      const subjectMatches =
        selectedSubject === "All" ||
        item.subject ===
          selectedSubject;

      const statusMatches =
        selectedStatus === "All" ||
        item.status ===
          selectedStatus;

      return (
        subjectMatches &&
        statusMatches
      );
    });

  const presentCount =
    filteredHistory.filter(
      (item) =>
        item.status === "present"
    ).length;

  const absentCount =
    filteredHistory.filter(
      (item) =>
        item.status === "absent"
    ).length;

  function formatDate(
    dateString: string
  ) {
    const date = new Date(
      `${dateString}T00:00:00`
    );

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">

          <div className="text-5xl mb-4">
            📆
          </div>

          <p className="text-slate-300">
            Loading attendance history...
          </p>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-6">

      <div className="max-w-6xl mx-auto">

        {/* HEADER */}

        <div className="mb-8">

          <a
            href="/attendance/dashboard"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            ← Attendance dashboard
          </a>

          <h1 className="text-3xl md:text-4xl font-bold mt-3">
            📆 Attendance History
          </h1>

          <p className="text-slate-400 mt-1">
            View all your recorded attendance
          </p>

        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">

            <p className="font-semibold text-red-300">
              ⚠️ Error
            </p>

            <p className="text-red-200 mt-1">
              {error}
            </p>

          </div>
        )}

        {/* FILTERS */}

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 mb-6">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div>

              <label className="block text-sm text-slate-400 mb-2">
                Subject
              </label>

              <select
                value={selectedSubject}
                onChange={(e) =>
                  setSelectedSubject(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
              >

                <option value="All">
                  All Subjects
                </option>

                {subjects.map(
                  (subject) => (
                    <option
                      key={subject}
                      value={subject}
                    >
                      {subject}
                    </option>
                  )
                )}

              </select>

            </div>

            <div>

              <label className="block text-sm text-slate-400 mb-2">
                Status
              </label>

              <select
                value={selectedStatus}
                onChange={(e) =>
                  setSelectedStatus(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
              >

                <option value="All">
                  All Status
                </option>

                <option value="present">
                  Present
                </option>

                <option value="absent">
                  Absent
                </option>

              </select>

            </div>

          </div>

        </div>

        {/* SUMMARY */}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

            <p className="text-sm text-slate-400">
              RECORDS
            </p>

            <p className="text-3xl font-bold mt-1">
              {filteredHistory.length}
            </p>

          </div>

          <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-5">

            <p className="text-sm text-green-300">
              PRESENT
            </p>

            <p className="text-3xl font-bold text-green-400 mt-1">
              {presentCount}
            </p>

          </div>

          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5">

            <p className="text-sm text-red-300">
              ABSENT
            </p>

            <p className="text-3xl font-bold text-red-400 mt-1">
              {absentCount}
            </p>

          </div>

        </div>

        {/* EMPTY */}

        {filteredHistory.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">

            <div className="text-5xl mb-4">
              📋
            </div>

            <h2 className="text-xl font-bold">
              No attendance records
            </h2>

            <p className="text-slate-400 mt-2">
              Your attendance records will
              appear here after you mark
              classes.
            </p>

          </div>
        )}

        {/* HISTORY */}

        <div className="space-y-3">

          {filteredHistory.map(
            (item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
              >

                <div className="flex items-center justify-between gap-4">

                  <div>

                    <h2 className="font-bold text-lg">
                      {item.subject}
                    </h2>

                    <p className="text-sm text-slate-400 mt-1">
                      {formatDate(
                        item.date
                      )}
                    </p>

                  </div>

                  {item.status ===
                  "present" ? (
                    <span className="rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-400">
                      ✓ Present
                    </span>
                  ) : (
                    <span className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400">
                      ✕ Absent
                    </span>
                  )}

                </div>

              </div>
            )
          )}

        </div>

      </div>

    </main>
  );
}