"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TimetableEntry = {
  id: number;
  day_of_week: number | string;
  subject_name: string;
  start_time: string;
  end_time: string;
  room?: string | null;
  faculty_name?: string | null;
};

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DAY_NUMBER_MAP: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

const TIME_SLOTS = [
  { start: "09:00", end: "10:00" },
  { start: "10:00", end: "11:00" },
  { start: "11:15", end: "12:15" },
  { start: "12:15", end: "13:15" },
  { start: "14:00", end: "15:00" },
  { start: "15:00", end: "16:00" },
  { start: "16:00", end: "17:00" },
];

const SLOT_HEIGHT = 105;

function normalizeDay(value: number | string): string {
  if (typeof value === "number") {
    return DAY_NUMBER_MAP[value] || "";
  }

  const text = value.trim();

  if (/^\d+$/.test(text)) {
    return DAY_NUMBER_MAP[Number(text)] || "";
  }

  const match = DAYS.find(
    (day) => day.toLowerCase() === text.toLowerCase()
  );

  return match || "";
}

function normalizeTime(value: string): string {
  if (!value) {
    return "";
  }

  return value.substring(0, 5);
}

function timeToMinutes(value: string): number {
  const time = normalizeTime(value);
  const parts = time.split(":");

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  return hours * 60 + minutes;
}

function formatTime(value: string): string {
  const time = normalizeTime(value);

  if (!time) {
    return "";
  }

  const parts = time.split(":");

  let hour = Number(parts[0]);
  const minute = parts[1];

  const period = hour >= 12 ? "PM" : "AM";

  if (hour === 0) {
    hour = 12;
  } else if (hour > 12) {
    hour = hour - 12;
  }

  return `${hour}:${minute} ${period}`;
}

function getDurationMinutes(
  entry: TimetableEntry
): number {
  const start = timeToMinutes(entry.start_time);
  const end = timeToMinutes(entry.end_time);

  return end - start;
}

function getDurationSlots(
  entry: TimetableEntry
): number {
  const duration = getDurationMinutes(entry);

  if (duration >= 120) {
    return 2;
  }

  return 1;
}

function getStartSlotIndex(
  entry: TimetableEntry
): number {
  const start = normalizeTime(entry.start_time);

  return TIME_SLOTS.findIndex(
    (slot) => slot.start === start
  );
}

export default function WeeklyTimetablePage() {
  const [entries, setEntries] = useState<
    TimetableEntry[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [selectedEntry, setSelectedEntry] =
    useState<TimetableEntry | null>(null);

  useEffect(() => {
    loadTimetable();
  }, []);

  async function loadTimetable() {
    try {
      setLoading(true);
      setError("");

      const {
        data,
        error: supabaseError,
      } = await supabase
        .from("timetable_entries")
        .select(
          `
            id,
            day_of_week,
            subject_name,
            start_time,
            end_time,
            room,
            faculty_name
          `
        )
        .order("start_time", {
          ascending: true,
        });

      if (supabaseError) {
        console.error(
          "Timetable loading error:",
          supabaseError
        );

        setError(supabaseError.message);
        return;
      }

      setEntries(
        (data || []) as TimetableEntry[]
      );
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load the timetable."
      );
    } finally {
      setLoading(false);
    }
  }

  const classesByDay = useMemo(() => {
    const result: Record<
      string,
      TimetableEntry[]
    > = {};

    for (const day of DAYS) {
      result[day] = entries
        .filter(
          (entry) =>
            normalizeDay(entry.day_of_week) ===
            day
        )
        .sort(
          (a, b) =>
            timeToMinutes(a.start_time) -
            timeToMinutes(b.start_time)
        );
    }

    return result;
  }, [entries]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">
            📅
          </div>

          <p className="text-slate-300">
            Loading your timetable...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <a
            href="/timetable"
            className="text-blue-400 hover:text-blue-300"
          >
            ← Manage timetable
          </a>

          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <h1 className="text-xl font-bold">
              Timetable error
            </h1>

            <p className="mt-2 text-red-200">
              {error}
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (entries.length === 0) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <a
            href="/timetable"
            className="text-blue-400 hover:text-blue-300"
          >
            ← Manage timetable
          </a>

          <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            <div className="text-5xl mb-4">
              📅
            </div>

            <h1 className="text-2xl font-bold">
              No timetable found
            </h1>

            <p className="text-slate-400 mt-2">
              Import your timetable first.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-6">
      <div className="max-w-[1600px] mx-auto">

        {/* HEADER */}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">

          <div>
            <a
              href="/timetable"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              ← Manage timetable
            </a>

            <h1 className="text-3xl md:text-4xl font-bold mt-2">
              📅 Weekly Timetable
            </h1>

            <p className="text-slate-400 mt-1">
              Your complete weekly class schedule
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-3">
            <p className="text-xs text-slate-400">
              Total classes
            </p>

            <p className="text-2xl font-bold">
              {entries.length}
            </p>
          </div>

        </div>

        {/* TIMETABLE */}

        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">

          <div className="min-w-[1100px]">

            {/* HEADER ROW */}

            <div className="grid grid-cols-[110px_repeat(6,minmax(150px,1fr))]">

              <div className="border-r border-b border-slate-800 p-4 font-semibold">
                Time
              </div>

              {DAYS.map((day) => (
                <div
                  key={day}
                  className="border-r border-b border-slate-800 p-4 text-center font-semibold"
                >
                  {day}
                </div>
              ))}

            </div>

            {/* BODY */}

            <div
              className="relative grid grid-cols-[110px_repeat(6,minmax(150px,1fr))]"
              style={{
                height:
                  TIME_SLOTS.length *
                  SLOT_HEIGHT,
              }}
            >

              {/* TIME COLUMN */}

              <div
                className="relative"
                style={{
                  gridColumn: 1,
                  height:
                    TIME_SLOTS.length *
                    SLOT_HEIGHT,
                }}
              >

                {TIME_SLOTS.map(
                  (slot, index) => (
                    <div
                      key={slot.start}
                      className="absolute left-0 right-0 border-r border-b border-slate-800 bg-slate-900 px-3 flex flex-col justify-center"
                      style={{
                        top:
                          index *
                          SLOT_HEIGHT,
                        height:
                          SLOT_HEIGHT,
                      }}
                    >

                      <span className="text-sm font-medium">
                        {formatTime(
                          slot.start
                        )}
                      </span>

                      <span className="text-xs text-slate-500 mt-1">
                        {formatTime(
                          slot.end
                        )}
                      </span>

                    </div>
                  )
                )}

              </div>

              {/* EACH DAY */}

              {DAYS.map((day) => {

                const dayClasses =
                  classesByDay[day] || [];

                return (
                  <div
                    key={day}
                    className="relative border-r border-slate-800"
                    style={{
                      height:
                        TIME_SLOTS.length *
                        SLOT_HEIGHT,
                    }}
                  >

                    {/* BACKGROUND TIME ROWS */}

                    {TIME_SLOTS.map(
                      (slot, index) => (
                        <div
                          key={`${day}-${slot.start}`}
                          className="absolute left-0 right-0 border-b border-slate-800"
                          style={{
                            top:
                              index *
                              SLOT_HEIGHT,
                            height:
                              SLOT_HEIGHT,
                          }}
                        />
                      )
                    )}

                    {/* CLASSES */}

                    {dayClasses.map(
                      (entry) => {

                        const startIndex =
                          getStartSlotIndex(
                            entry
                          );

                        if (
                          startIndex === -1
                        ) {
                          return null;
                        }

                        const slots =
                          getDurationSlots(
                            entry
                          );

                        const top =
                          startIndex *
                          SLOT_HEIGHT;

                        const height =
                          slots *
                          SLOT_HEIGHT;

                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() =>
                              setSelectedEntry(
                                entry
                              )
                            }
                            className="absolute left-1 right-1 z-10 rounded-xl border border-blue-500/40 bg-blue-600/20 hover:bg-blue-600/35 hover:border-blue-400/70 transition-all text-left p-3 overflow-hidden"
                            style={{
                              top:
                                top + 4,
                              height:
                                height - 8,
                            }}
                          >

                            <div className="flex items-start justify-between gap-2">

                              <div className="font-semibold text-blue-300 text-sm">
                                {
                                  entry.subject_name
                                }
                              </div>

                              {slots === 2 && (
                                <span className="text-[9px] rounded-full bg-blue-500/20 px-2 py-1 text-blue-300 whitespace-nowrap">
                                  2 HR
                                </span>
                              )}

                            </div>

                            <div className="text-xs text-slate-300 mt-2">
                              {formatTime(
                                entry.start_time
                              )}{" "}
                              –{" "}
                              {formatTime(
                                entry.end_time
                              )}
                            </div>

                            {entry.room && (
                              <div className="text-xs text-slate-400 mt-2">
                                📍{" "}
                                {entry.room}
                              </div>
                            )}

                            {entry.faculty_name && (
                              <div className="text-xs text-slate-400 mt-1">
                                👨‍🏫{" "}
                                {
                                  entry.faculty_name
                                }
                              </div>
                            )}

                          </button>
                        );
                      }
                    )}

                  </div>
                );
              })}

            </div>
          </div>
        </div>

        {/* DAILY COUNTS */}

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-6">

          {DAYS.map((day) => (
            <div
              key={day}
              className="rounded-xl border border-slate-800 bg-slate-900 p-4"
            >

              <p className="text-sm text-slate-400">
                {day}
              </p>

              <p className="text-xl font-bold mt-1">
                {classesByDay[day]?.length || 0}
              </p>

              <p className="text-xs text-slate-500">
                classes
              </p>

            </div>
          ))}

        </div>

      </div>

      {/* CLASS DETAILS MODAL */}

      {selectedEntry && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() =>
            setSelectedEntry(null)
          }
        >

          <div
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="flex items-start justify-between">

              <div>
                <p className="text-sm text-blue-400">
                  {normalizeDay(
                    selectedEntry.day_of_week
                  )}
                </p>

                <h2 className="text-2xl font-bold mt-1">
                  {
                    selectedEntry.subject_name
                  }
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedEntry(null)
                }
                className="text-slate-400 hover:text-white text-xl"
              >
                ✕
              </button>

            </div>

            <div className="mt-6 space-y-4">

              <div>
                <p className="text-xs text-slate-500">
                  TIME
                </p>

                <p className="mt-1">
                  {formatTime(
                    selectedEntry.start_time
                  )}{" "}
                  –{" "}
                  {formatTime(
                    selectedEntry.end_time
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  DURATION
                </p>

                <p className="mt-1">
                  {getDurationMinutes(
                    selectedEntry
                  )}{" "}
                  minutes
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  ROOM
                </p>

                <p className="mt-1">
                  {selectedEntry.room ||
                    "Not specified"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  FACULTY
                </p>

                <p className="mt-1">
                  {selectedEntry.faculty_name ||
                    "Not specified"}
                </p>
              </div>

            </div>

            <button
              type="button"
              onClick={() =>
                setSelectedEntry(null)
              }
              className="w-full mt-7 rounded-xl bg-slate-800 py-3 font-medium hover:bg-slate-700"
            >
              Close
            </button>

          </div>

        </div>
      )}

    </main>
  );
}