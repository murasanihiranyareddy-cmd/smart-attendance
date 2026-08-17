"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type TimetableEntry = {
  id: string;
  subject_name: string;
  day_of_week: number | string;
  start_time: string;
  end_time: string;
  room: string | null;
  faculty_name: string | null;
};

type AttendanceRecord = {
  scheduled_class_id: string;
  status: string;
  attendance_date: string;
};

type TodayClass = TimetableEntry & {
  attendanceStatus?: string;
};

export default function DashboardPage() {
  const [classes, setClasses] = useState<TodayClass[]>([]);
  const [overallPercentage, setOverallPercentage] = useState(0);
  const [presentToday, setPresentToday] = useState(0);
  const [absentToday, setAbsentToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [todayName, setTodayName] = useState("");

  useEffect(() => {
    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    setTodayName(
      dayNames[new Date().getDay()]
    );

    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      /*
       * GET CURRENT USER
       */

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw new Error(
          `Authentication error: ${authError.message}`
        );
      }

      if (!user) {
        throw new Error(
          "You are not logged in."
        );
      }

      /*
       * TODAY
       */

      const today = new Date();

      const todayNumber =
        today.getDay();

      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];

      const currentDayName =
        dayNames[todayNumber];

      /*
       * TODAY'S DATE
       */

      const year =
        today.getFullYear();

      const month = String(
        today.getMonth() + 1
      ).padStart(2, "0");

      const day = String(
        today.getDate()
      ).padStart(2, "0");

      const todayDate =
        `${year}-${month}-${day}`;

      /*
       * GET ALL TIMETABLE ENTRIES
       *
       * IMPORTANT:
       * day_of_week is INTEGER in Supabase.
       */

      const {
        data: timetableData,
        error: timetableError,
      } = await supabase
        .from("timetable_entries")
        .select(
          `
          id,
          subject_name,
          day_of_week,
          start_time,
          end_time,
          room,
          faculty_name
        `
        )
        .eq(
          "user_id",
          user.id
        )
        .order(
          "start_time",
          {
            ascending: true,
          }
        );

      if (timetableError) {
        throw new Error(
          `Timetable error: ${timetableError.message}`
        );
      }

      const allTimetable =
        (timetableData ||
          []) as TimetableEntry[];

      /*
       * FILTER TODAY'S CLASSES
       */

      const todayClasses =
        allTimetable.filter(
          (item) => {

            if (
              typeof item.day_of_week ===
              "number"
            ) {
              return (
                item.day_of_week ===
                todayNumber
              );
            }

            if (
              typeof item.day_of_week ===
              "string"
            ) {
              const value =
                item.day_of_week
                  .trim()
                  .toLowerCase();

              return (
                value ===
                  currentDayName.toLowerCase() ||
                value ===
                  String(todayNumber)
              );
            }

            return false;
          }
        );

      /*
       * GET ALL CLASS IDS
       */

      const allClassIds =
        allTimetable.map(
          (item) => item.id
        );

      /*
       * GET ATTENDANCE
       */

      let attendance:
        AttendanceRecord[] = [];

      if (
        allClassIds.length > 0
      ) {
        const {
          data: attendanceData,
          error: attendanceError,
        } = await supabase
          .from("attendance")
          .select(
            `
            scheduled_class_id,
            status,
            attendance_date
          `
          )
          .in(
            "scheduled_class_id",
            allClassIds
          );

        if (attendanceError) {
          throw new Error(
            `Attendance error: ${attendanceError.message}`
          );
        }

        attendance =
          (attendanceData ||
            []) as AttendanceRecord[];
      }

      /*
       * OVERALL ATTENDANCE
       */

      const totalMarked =
        attendance.length;

      const totalPresent =
        attendance.filter(
          (record) =>
            record.status ===
            "present"
        ).length;

      const percentage =
        totalMarked > 0
          ? Math.round(
              (totalPresent /
                totalMarked) *
                100
            )
          : 0;

      setOverallPercentage(
        percentage
      );

      /*
       * TODAY'S ATTENDANCE
       */

      const todayAttendance =
        attendance.filter(
          (record) =>
            record.attendance_date ===
            todayDate
        );

      const presentCount =
        todayAttendance.filter(
          (record) =>
            record.status ===
            "present"
        ).length;

      const absentCount =
        todayAttendance.filter(
          (record) =>
            record.status ===
            "absent"
        ).length;

      setPresentToday(
        presentCount
      );

      setAbsentToday(
        absentCount
      );

      /*
       * CONNECT ATTENDANCE
       * WITH TODAY'S CLASSES
       */

      const finalClasses =
        todayClasses.map(
          (classItem) => {

            const record =
              todayAttendance.find(
                (attendanceItem) =>
                  attendanceItem.scheduled_class_id ===
                  classItem.id
              );

            return {
              ...classItem,
              attendanceStatus:
                record?.status,
            };
          }
        );

      /*
       * SORT BY START TIME
       */

      finalClasses.sort(
        (a, b) =>
          a.start_time.localeCompare(
            b.start_time
          )
      );

      setClasses(
        finalClasses
      );
    } catch (err) {
      console.error(
        "❌ Dashboard error:",
        err
      );

      if (
        err instanceof Error
      ) {
        setError(
          err.message
        );
      } else {
        setError(
          JSON.stringify(err)
        );
      }
    } finally {
      setLoading(false);
    }
  }

  /*
   * FORMAT TIME
   */

  function formatTime(
    time: string
  ) {
    if (!time) {
      return "";
    }

    const parts =
      time.split(":");

    let hour =
      Number(parts[0]);

    const minute =
      parts[1] || "00";

    const period =
      hour >= 12
        ? "PM"
        : "AM";

    if (hour === 0) {
      hour = 12;
    } else if (hour > 12) {
      hour -= 12;
    }

    return `${hour}:${minute} ${period}`;
  }

  /*
   * ATTENDANCE COLOR
   */

  function getAttendanceColor(
    percentage: number
  ) {
    if (percentage >= 75) {
      return "text-green-400";
    }

    if (percentage >= 60) {
      return "text-yellow-400";
    }

    return "text-red-400";
  }

  /*
   * LOADING
   */

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">

        <div className="text-center">

          <div className="text-5xl mb-4">
            🎓
          </div>

          <p className="text-slate-300">
            Loading your dashboard...
          </p>

        </div>

      </main>
    );
  }

  /*
   * DASHBOARD
   */

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-6">

      <div className="max-w-6xl mx-auto">

        {/* HEADER */}

        <div className="mb-8">

          <p className="text-blue-400 font-semibold tracking-wide">
            SMART ATTENDANCE
          </p>

          <h1 className="text-3xl md:text-4xl font-bold mt-2">
            Good morning! 👋
          </h1>

          <p className="text-slate-400 mt-1">
            Here's your attendance overview for today.
          </p>

        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">

            <p className="font-semibold text-red-300">
              ⚠️ Unable to load dashboard
            </p>

            <p className="text-red-200 mt-2 break-words">
              {error}
            </p>

            <button
              onClick={loadDashboard}
              className="mt-4 rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-2 text-sm text-red-200 hover:bg-red-500/30 transition"
            >
              Try Again
            </button>

          </div>
        )}

        {/* STAT CARDS */}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

          {/* OVERALL */}

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

            <p className="text-sm text-slate-400">
              OVERALL ATTENDANCE
            </p>

            <p
              className={`text-4xl font-bold mt-2 ${getAttendanceColor(
                overallPercentage
              )}`}
            >
              {overallPercentage}%
            </p>

            <p className="text-xs text-slate-500 mt-2">
              Required: 75%
            </p>

          </div>

          {/* PRESENT */}

          <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-6">

            <p className="text-sm text-green-300">
              PRESENT TODAY
            </p>

            <p className="text-4xl font-bold text-green-400 mt-2">
              {presentToday}
            </p>

          </div>

          {/* ABSENT */}

          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">

            <p className="text-sm text-red-300">
              ABSENT TODAY
            </p>

            <p className="text-4xl font-bold text-red-400 mt-2">
              {absentToday}
            </p>

          </div>

          {/* TODAY'S CLASSES */}

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

            <p className="text-sm text-slate-400">
              TODAY'S CLASSES
            </p>

            <p className="text-4xl font-bold mt-2">
              {classes.length}
            </p>

          </div>

        </div>

        {/* QUICK ACTIONS */}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">

          <a
            href="/timetable/weekly"
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-blue-500 transition"
          >

            <div className="text-3xl mb-3">
              📅
            </div>

            <h2 className="font-bold text-lg">
              Weekly Timetable
            </h2>

            <p className="text-sm text-slate-400 mt-1">
              View your complete class schedule.
            </p>

          </a>

          <a
            href="/attendance"
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-blue-500 transition"
          >

            <div className="text-3xl mb-3">
              📋
            </div>

            <h2 className="font-bold text-lg">
              Mark Attendance
            </h2>

            <p className="text-sm text-slate-400 mt-1">
              Record today's attendance.
            </p>

          </a>

          <a
            href="/attendance/dashboard"
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-blue-500 transition"
          >

            <div className="text-3xl mb-3">
              📊
            </div>

            <h2 className="font-bold text-lg">
              Attendance Analytics
            </h2>

            <p className="text-sm text-slate-400 mt-1">
              View percentages and predictions.
            </p>

          </a>

        </div>

        {/* TODAY'S CLASSES */}

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 md:p-6">

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">

            <div>

              <h2 className="text-xl font-bold">
                📚 Today's Classes
              </h2>

              <p className="text-sm text-slate-400 mt-1">
                {todayName}
              </p>

            </div>

            <a
              href="/attendance"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Mark attendance →
            </a>

          </div>

          {classes.length === 0 ? (

            <div className="rounded-xl bg-slate-950 p-8 text-center">

              <div className="text-4xl mb-3">
                🎉
              </div>

              <p className="font-semibold">
                No classes today!
              </p>

              <p className="text-sm text-slate-500 mt-1">
                Enjoy your free time.
              </p>

            </div>

          ) : (

            <div className="space-y-3">

              {classes.map(
                (classItem) => (

                  <div
                    key={classItem.id}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

                      <div>

                        <h3 className="font-bold text-lg">
                          {classItem.subject_name}
                        </h3>

                        <p className="text-sm text-slate-400 mt-1">

                          {formatTime(
                            classItem.start_time
                          )}

                          {" – "}

                          {formatTime(
                            classItem.end_time
                          )}

                        </p>

                        {classItem.room && (
                          <p className="text-sm text-slate-500 mt-1">
                            📍{" "}
                            {classItem.room}
                          </p>
                        )}

                        {classItem.faculty_name && (
                          <p className="text-sm text-slate-500 mt-1">
                            👨‍🏫{" "}
                            {classItem.faculty_name}
                          </p>
                        )}

                      </div>

                      <div>

                        {classItem.attendanceStatus ===
                        "present" ? (

                          <span className="inline-block rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-400">
                            ✓ Present
                          </span>

                        ) : classItem.attendanceStatus ===
                          "absent" ? (

                          <span className="inline-block rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400">
                            ✕ Absent
                          </span>

                        ) : (

                          <span className="inline-block rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm font-semibold text-yellow-400">
                            Not marked
                          </span>

                        )}

                      </div>

                    </div>

                  </div>

                )
              )}

            </div>

          )}

        </div>

        {/* BOTTOM NAVIGATION */}

        <div className="flex flex-wrap gap-5 mt-6">

          <a
            href="/attendance/history"
            className="text-sm text-slate-400 hover:text-white transition"
          >
            📆 Attendance History
          </a>

          <a
            href="/timetable"
            className="text-sm text-slate-400 hover:text-white transition"
          >
            ⚙️ Manage Timetable
          </a>

          <a
            href="/attendance/dashboard"
            className="text-sm text-slate-400 hover:text-white transition"
          >
            📊 Attendance Analytics
          </a>

        </div>

      </div>

    </main>
  );
}