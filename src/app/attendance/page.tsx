"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type TimetableEntry = {
  id: string;
  user_id: string;
  day_of_week: number | string;
  subject_name: string;
  start_time: string;
  end_time: string;
  room?: string | null;
  faculty_name?: string | null;
};

type AttendanceRecord = {
  id: string;
  scheduled_class_id: string;
  attendance_date: string;
  status: string;
};

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DAY_NUMBER_MAP: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

function normalizeDay(value: number | string): string {
  if (typeof value === "number") {
    return DAY_NUMBER_MAP[value] || "";
  }

  const text = String(value).trim();

  if (/^\d+$/.test(text)) {
    const number = Number(text);

    if (number >= 0 && number <= 6) {
      return DAY_NUMBER_MAP[number] || "";
    }

    if (number >= 1 && number <= 7) {
      return DAYS[number - 1] || "";
    }
  }

  const found = DAYS.find(
    (day) => day.toLowerCase() === text.toLowerCase()
  );

  return found || "";
}

function normalizeTime(value: string): string {
  if (!value) return "";

  return String(value).substring(0, 5);
}

function formatTime(value: string): string {
  const time = normalizeTime(value);

  if (!time) return "";

  const parts = time.split(":");

  let hour = Number(parts[0]);
  const minute = parts[1] || "00";

  const period = hour >= 12 ? "PM" : "AM";

  if (hour === 0) {
    hour = 12;
  } else if (hour > 12) {
    hour -= 12;
  }

  return `${hour}:${minute} ${period}`;
}

function getDurationMinutes(entry: TimetableEntry): number {
  const start = normalizeTime(entry.start_time).split(":");
  const end = normalizeTime(entry.end_time).split(":");

  const startMinutes =
    Number(start[0]) * 60 + Number(start[1]);

  const endMinutes =
    Number(end[0]) * 60 + Number(end[1]);

  return endMinutes - startMinutes;
}

function getTodayName(): string {
  return DAYS[new Date().getDay()];
}

function getTodayDate(): string {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(now.getMonth() + 1).padStart(2, "0");

  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function AttendancePage() {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);

  const [attendance, setAttendance] = useState<
    AttendanceRecord[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [savingId, setSavingId] = useState<string | null>(
    null
  );

  const [error, setError] = useState("");

  const todayName = getTodayName();
  const todayDate = getTodayDate();

  useEffect(() => {
    loadAttendancePage();
  }, []);

  async function loadAttendancePage() {
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
          "You are not logged in. Please log in first."
        );
      }

      console.log("👤 Logged-in user:", user.id);

      /*
       * Load timetable entries for the current user.
       */

      const {
        data: timetableData,
        error: timetableError,
      } = await supabase
        .from("timetable_entries")
        .select(
          `
          id,
          user_id,
          day_of_week,
          subject_name,
          start_time,
          end_time,
          room,
          faculty_name
        `
        )
        .eq("user_id", user.id);

      if (timetableError) {
        console.error(
          "❌ Timetable loading error:",
          timetableError
        );

        throw timetableError;
      }

      console.log(
        "📚 Timetable entries:",
        timetableData
      );

      const todaysClasses = (timetableData || [])
        .filter(
          (entry) =>
            normalizeDay(entry.day_of_week) === todayName
        )
        .sort((a, b) =>
          normalizeTime(a.start_time).localeCompare(
            normalizeTime(b.start_time)
          )
        ) as TimetableEntry[];

      console.log(
        `📅 ${todayName} classes:`,
        todaysClasses
      );

      setEntries(todaysClasses);

      /*
       * Load today's attendance.
       */

      const classIds = todaysClasses.map(
        (entry) => entry.id
      );

      if (classIds.length === 0) {
        setAttendance([]);
        return;
      }

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
        .eq("attendance_date", todayDate)
        .in("scheduled_class_id", classIds);

      if (attendanceError) {
        console.error(
          "❌ Attendance loading error:",
          attendanceError
        );

        throw attendanceError;
      }

      console.log(
        "📝 Today's attendance:",
        attendanceData
      );

      setAttendance(
        (attendanceData || []) as AttendanceRecord[]
      );
    } catch (err) {
      console.error(
        "❌ ATTENDANCE PAGE ERROR:",
        err
      );

      const message =
        err instanceof Error
          ? err.message
          : JSON.stringify(err);

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function markAttendance(
    entry: TimetableEntry,
    status: "present" | "absent"
  ) {
    try {
      setSavingId(entry.id);
      setError("");

      console.log(
        "📝 Marking attendance:",
        {
          classId: entry.id,
          subject: entry.subject_name,
          date: todayDate,
          status,
        }
      );

      /*
       * Check whether attendance already exists.
       */

      const {
        data: existing,
        error: existingError,
      } = await supabase
        .from("attendance")
        .select(
          "id, scheduled_class_id, attendance_date, status"
        )
        .eq(
          "scheduled_class_id",
          entry.id
        )
        .eq(
          "attendance_date",
          todayDate
        )
        .maybeSingle();

      if (existingError) {
        console.error(
          "❌ Existing attendance check failed:",
          existingError
        );

        throw existingError;
      }

      console.log(
        "🔎 Existing attendance:",
        existing
      );

      /*
       * Update existing record.
       */

      if (existing) {
        console.log(
          "✏️ Updating attendance record..."
        );

        const {
          data,
          error: updateError,
        } = await supabase
          .from("attendance")
          .update({
            status: status,
          })
          .eq("id", existing.id)
          .select();

        if (updateError) {
          console.error(
            "❌ Attendance update error:",
            updateError
          );

          throw updateError;
        }

        console.log(
          "✅ Attendance updated:",
          data
        );
      }

      /*
       * Insert new record.
       */

      else {
        console.log(
          "➕ Creating attendance record..."
        );

        const {
          data,
          error: insertError,
        } = await supabase
          .from("attendance")
          .insert({
            scheduled_class_id: entry.id,
            attendance_date: todayDate,
            status: status,
          })
          .select();

        if (insertError) {
          console.error(
            "❌ Attendance insert error:",
            insertError
          );

          throw insertError;
        }

        console.log(
          "✅ Attendance created:",
          data
        );
      }

      /*
       * Reload everything after saving.
       */

      await loadAttendancePage();
    } catch (err) {
      console.error(
        "🔥 FULL ATTENDANCE SAVE ERROR:",
        err
      );

      let message = "Unknown attendance error.";

      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === "object") {
        try {
          message = JSON.stringify(
            err,
            null,
            2
          );
        } catch {
          message = String(err);
        }
      } else {
        message = String(err);
      }

      setError(
        `Attendance save failed: ${message}`
      );
    } finally {
      setSavingId(null);
    }
  }

  function getStatus(
    entryId: string
  ): string | null {
    const record = attendance.find(
      (item) =>
        item.scheduled_class_id === entryId
    );

    return record?.status || null;
  }

  const presentCount = entries.filter(
    (entry) =>
      getStatus(entry.id) === "present"
  ).length;

  const absentCount = entries.filter(
    (entry) =>
      getStatus(entry.id) === "absent"
  ).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">
            📋
          </div>

          <p className="text-slate-300">
            Loading today's attendance...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-6">
      <div className="max-w-5xl mx-auto">

        <div className="mb-8">
          <a
            href="/timetable"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            ← Manage timetable
          </a>

          <h1 className="text-3xl md:text-4xl font-bold mt-3">
            📋 Today's Attendance
          </h1>

          <p className="text-slate-400 mt-1">
            {todayName}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">

            <p className="font-semibold text-red-300 mb-2">
              ⚠️ Attendance Error
            </p>

            <pre className="whitespace-pre-wrap break-words text-sm text-red-200">
              {error}
            </pre>

          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-6">

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs text-slate-400">
              TODAY'S CLASSES
            </p>

            <p className="text-2xl font-bold mt-1">
              {entries.length}
            </p>
          </div>

          <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4">
            <p className="text-xs text-green-300">
              PRESENT
            </p>

            <p className="text-2xl font-bold mt-1 text-green-400">
              {presentCount}
            </p>
          </div>

          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-xs text-red-300">
              ABSENT
            </p>

            <p className="text-2xl font-bold mt-1 text-red-400">
              {absentCount}
            </p>
          </div>

        </div>

        {entries.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">

            <div className="text-5xl mb-4">
              🎉
            </div>

            <h2 className="text-xl font-bold">
              No classes today
            </h2>

            <p className="text-slate-400 mt-2">
              Enjoy your day!
            </p>

          </div>
        )}

        <div className="space-y-4">

          {entries.map((entry) => {
            const status = getStatus(entry.id);

            const isSaving =
              savingId === entry.id;

            const duration =
              getDurationMinutes(entry);

            const isTwoHour =
              duration >= 120;

            return (
              <div
                key={entry.id}
                className={`rounded-2xl border bg-slate-900 p-5 transition ${
                  status === "present"
                    ? "border-green-500/40"
                    : status === "absent"
                    ? "border-red-500/40"
                    : "border-slate-800"
                }`}
              >

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

                  <div>

                    <div className="flex items-center gap-2 flex-wrap">

                      <h2 className="text-xl font-bold">
                        {entry.subject_name}
                      </h2>

                      {isTwoHour && (
                        <span className="rounded-full bg-blue-500/15 px-2 py-1 text-xs text-blue-300">
                          2 HOURS
                        </span>
                      )}

                    </div>

                    <p className="text-blue-400 mt-2">
                      {formatTime(
                        entry.start_time
                      )}{" "}
                      –{" "}
                      {formatTime(
                        entry.end_time
                      )}
                    </p>

                    <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-400">

                      {entry.room && (
                        <span>
                          📍 {entry.room}
                        </span>
                      )}

                      {entry.faculty_name && (
                        <span>
                          👨‍🏫{" "}
                          {entry.faculty_name}
                        </span>
                      )}

                      <span>
                        ⏱ {duration} minutes
                      </span>

                    </div>

                  </div>

                  <div className="flex gap-2">

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        markAttendance(
                          entry,
                          "present"
                        )
                      }
                      className={`rounded-xl px-5 py-3 font-medium transition ${
                        status === "present"
                          ? "bg-green-600 text-white"
                          : "bg-green-600/15 text-green-400 border border-green-500/30 hover:bg-green-600/25"
                      } disabled:opacity-50`}
                    >
                      {isSaving
                        ? "Saving..."
                        : "✓ Present"}
                    </button>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        markAttendance(
                          entry,
                          "absent"
                        )
                      }
                      className={`rounded-xl px-5 py-3 font-medium transition ${
                        status === "absent"
                          ? "bg-red-600 text-white"
                          : "bg-red-600/15 text-red-400 border border-red-500/30 hover:bg-red-600/25"
                      } disabled:opacity-50`}
                    >
                      {isSaving
                        ? "Saving..."
                        : "✕ Absent"}
                    </button>

                  </div>

                </div>

                {status && (
                  <div className="mt-4 pt-4 border-t border-slate-800">

                    {status === "present" ? (
                      <p className="text-sm text-green-400">
                        ✓ Marked Present
                      </p>
                    ) : (
                      <p className="text-sm text-red-400">
                        ✕ Marked Absent
                      </p>
                    )}

                  </div>
                )}

              </div>
            );
          })}

        </div>

      </div>
    </main>
  );
}