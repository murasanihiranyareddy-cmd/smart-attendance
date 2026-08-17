"use client";

import {
  ChangeEvent,
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type TimetableEntry = {
  day_of_week: string;
  subject_name: string;
  start_time: string;
  end_time: string;
  room: string;
  faculty_name: string;
};

const dayNumbers: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

const dayNames: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

export default function TimetablePage() {
  const [file, setFile] = useState<File | null>(null);

  const [preview, setPreview] = useState("");

  const [reading, setReading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [loadingSaved, setLoadingSaved] = useState(true);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [entries, setEntries] = useState<TimetableEntry[]>([]);

  const [showReview, setShowReview] = useState(false);

  // --------------------------------------------------
  // LOAD SAVED TIMETABLE
  // --------------------------------------------------

  useEffect(() => {
    loadSavedTimetable();
  }, []);

  async function loadSavedTimetable() {
    setLoadingSaved(true);

    try {
      // --------------------------------------------
      // GET USER
      // --------------------------------------------

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setLoadingSaved(false);
        return;
      }

      // --------------------------------------------
      // GET ACTIVE SEMESTER
      // --------------------------------------------

      const {
        data: semester,
        error: semesterError,
      } = await supabase
        .from("semesters")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (semesterError || !semester) {
        setLoadingSaved(false);
        return;
      }

      // --------------------------------------------
      // GET SAVED TIMETABLE
      // --------------------------------------------

      const {
        data,
        error: timetableError,
      } = await supabase
        .from("timetable_entries")
        .select(
          `
            day_of_week,
            subject_name,
            start_time,
            end_time,
            room,
            faculty_name
          `
        )
        .eq("user_id", user.id)
        .eq("semester_id", semester.id)
        .eq("is_active", true)
        .order("day_of_week", {
          ascending: true,
        })
        .order("start_time", {
          ascending: true,
        });

      if (timetableError) {
        console.error(
          "Failed to load timetable:",
          timetableError.message
        );

        setLoadingSaved(false);
        return;
      }

      if (!data || data.length === 0) {
        setLoadingSaved(false);
        return;
      }

      // --------------------------------------------
      // CONVERT DATABASE ROWS
      // --------------------------------------------

      const loadedEntries: TimetableEntry[] = data.map(
        (entry) => ({
          day_of_week:
            dayNames[Number(entry.day_of_week)] ||
            "Monday",

          subject_name:
            entry.subject_name || "",

          start_time:
            entry.start_time
              ? entry.start_time.slice(0, 5)
              : "",

          end_time:
            entry.end_time
              ? entry.end_time.slice(0, 5)
              : "",

          room:
            entry.room || "",

          faculty_name:
            entry.faculty_name || "",
        })
      );

      setEntries(loadedEntries);
    } catch (err) {
      console.error(
        "Error loading timetable:",
        err
      );
    } finally {
      setLoadingSaved(false);
    }
  }

  // --------------------------------------------------
  // FILE SELECTION
  // --------------------------------------------------

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    if (!selectedFile.type.startsWith("image/")) {
      setError(
        "Please select an image file."
      );
      return;
    }

    setFile(selectedFile);

    const imageUrl =
      URL.createObjectURL(selectedFile);

    setPreview(imageUrl);

    setEntries([]);

    setShowReview(false);

    setError("");

    setSuccess("");
  }

  // --------------------------------------------------
  // REMOVE IMAGE
  // --------------------------------------------------

  function removeFile() {
    setFile(null);

    setPreview("");

    setEntries([]);

    setShowReview(false);

    setError("");

    setSuccess("");
  }

  // --------------------------------------------------
  // READ TIMETABLE WITH AI
  // --------------------------------------------------

  async function readTimetable() {
    if (!file) {
      setError(
        "Please upload a timetable image first."
      );
      return;
    }

    setReading(true);

    setError("");

    setSuccess("");

    try {
      const formData = new FormData();

      formData.append("file", file);

      const response = await fetch(
        "/api/read-timetable",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to read timetable."
        );
      }

      if (!Array.isArray(data.entries)) {
        throw new Error(
          "AI did not return valid timetable entries."
        );
      }

      // Make sure every returned entry has
      // all required fields.
      const cleanedEntries: TimetableEntry[] =
        data.entries.map(
          (entry: Partial<TimetableEntry>) => ({
            day_of_week:
              entry.day_of_week &&
              dayNumbers[entry.day_of_week]
                ? entry.day_of_week
                : "Monday",

            subject_name:
              entry.subject_name || "",

            start_time:
              entry.start_time || "09:00",

            end_time:
              entry.end_time || "10:00",

            room:
              entry.room || "",

            faculty_name:
              entry.faculty_name || "",
          })
        );

      setEntries(cleanedEntries);

      setShowReview(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while reading the timetable."
      );
    } finally {
      setReading(false);
    }
  }

  // --------------------------------------------------
  // UPDATE ENTRY
  // --------------------------------------------------

  function updateEntry(
    index: number,
    field: keyof TimetableEntry,
    value: string
  ) {
    setEntries((currentEntries) =>
      currentEntries.map(
        (entry, entryIndex) =>
          entryIndex === index
            ? {
                ...entry,
                [field]: value,
              }
            : entry
      )
    );
  }

  // --------------------------------------------------
  // DELETE ENTRY
  // --------------------------------------------------

  function deleteEntry(index: number) {
    setEntries((currentEntries) =>
      currentEntries.filter(
        (_, entryIndex) =>
          entryIndex !== index
      )
    );
  }

  // --------------------------------------------------
  // ADD ENTRY
  // --------------------------------------------------

  function addEntry() {
    setEntries((currentEntries) => [
      ...currentEntries,

      {
        day_of_week: "Monday",

        subject_name: "",

        start_time: "09:00",

        end_time: "10:00",

        room: "",

        faculty_name: "",
      },
    ]);

    setShowReview(true);
  }

  // --------------------------------------------------
  // CONFIRM AND SAVE
  // REPLACES OLD TIMETABLE
  // --------------------------------------------------

  async function confirmTimetable() {
    if (entries.length === 0) {
      setError(
        "There are no timetable entries to save."
      );

      return;
    }

    // Validate entries before saving
    const invalidEntry = entries.find(
      (entry) =>
        !entry.subject_name.trim() ||
        !entry.start_time ||
        !entry.end_time
    );

    if (invalidEntry) {
      setError(
        "Please make sure every class has a subject, start time, and end time."
      );

      return;
    }

    setSaving(true);

    setError("");

    setSuccess("");

    try {
      // --------------------------------------------
      // GET USER
      // --------------------------------------------

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(
          `Authentication error: ${userError.message}`
        );
      }

      if (!user) {
        throw new Error(
          "You are not logged in. Please log in and try again."
        );
      }

      // --------------------------------------------
      // GET ACTIVE SEMESTER
      // --------------------------------------------

      const {
        data: semester,
        error: semesterError,
      } = await supabase
        .from("semesters")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (semesterError) {
        throw new Error(
          `Semester error: ${semesterError.message}`
        );
      }

      if (!semester) {
        throw new Error(
          "No active semester was found."
        );
      }

      // --------------------------------------------
      // DELETE OLD TIMETABLE
      // --------------------------------------------

      const {
        error: deleteError,
      } = await supabase
        .from("timetable_entries")
        .delete()
        .eq("user_id", user.id)
        .eq("semester_id", semester.id);

      if (deleteError) {
        throw new Error(
          `Could not replace existing timetable: ${deleteError.message}`
        );
      }

      // --------------------------------------------
      // PREPARE NEW ROWS
      // --------------------------------------------

      const rows = entries.map((entry) => ({
        user_id: user.id,

        semester_id: semester.id,

        subject_name:
          entry.subject_name.trim(),

        day_of_week:
          dayNumbers[
            entry.day_of_week.trim()
          ] ?? 1,

        start_time:
          entry.start_time.trim(),

        end_time:
          entry.end_time.trim(),

        room:
  entry.room?.trim() ||
  "",

faculty_name:
  entry.faculty_name?.trim() ||
  "",

is_active:
  true,
      }));

      console.log(
        "Saving timetable:",
        rows
      );

      // --------------------------------------------
      // INSERT NEW TIMETABLE
      // --------------------------------------------

      const {
        error: insertError,
      } = await supabase
        .from("timetable_entries")
        .insert(rows);

      if (insertError) {
        console.error(
          "Supabase insert error:",
          insertError.message
        );

        throw new Error(
          insertError.message
        );
      }

      // --------------------------------------------
      // SUCCESS
      // --------------------------------------------

      setSuccess(
        `Timetable saved successfully! ${entries.length} classes were added.`
      );

      setShowReview(false);

      setFile(null);

      setPreview("");
    } catch (err) {
      console.error(
        "Timetable save error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to save timetable."
      );
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  // RESET / UPLOAD AGAIN
  // --------------------------------------------------

  function resetTimetable() {
    setShowReview(false);

    setEntries([]);

    setFile(null);

    setPreview("");

    setError("");

    setSuccess("");
  }

  // --------------------------------------------------
  // LOADING SCREEN
  // --------------------------------------------------

  if (loadingSaved) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="text-center">
              <div className="text-4xl">
                📅
              </div>

              <p className="mt-4 text-slate-400">
                Loading your timetable...
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // PAGE
  // --------------------------------------------------

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">

        {/* HEADER */}

        <div className="mb-10">
          <h1 className="text-3xl font-bold">
            📅 Timetable
          </h1>

          <p className="mt-2 text-slate-400">
            Upload your timetable and let AI
            organize it for you.
          </p>
        </div>

        {/* SUCCESS */}

        {success && (
          <div className="mb-6 rounded-xl border border-green-500/20 bg-green-500/10 px-5 py-4 text-green-300">
            {success}
          </div>
        )}

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-red-300">
            {error}
          </div>
        )}

        {/* ---------------------------------------- */}
        {/* UPLOAD SCREEN */}
        {/* ---------------------------------------- */}

        {!showReview &&
          entries.length === 0 && (
            <section className="rounded-2xl border border-white/10 bg-white/5 p-8">

              <div className="text-center">

                <div className="text-5xl">
                  📸
                </div>

                <h2 className="mt-4 text-2xl font-semibold">
                  Upload your timetable
                </h2>

                <p className="mt-2 text-slate-400">
                  PNG or JPG images are supported.
                </p>

                <label className="mt-6 inline-block cursor-pointer rounded-xl bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-500">

                  Choose timetable image

                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                </label>

              </div>

              {/* IMAGE PREVIEW */}

              {preview && (
                <div className="mt-8">

                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">

                    <img
                      src={preview}
                      alt="Uploaded timetable"
                      className="mx-auto max-h-[500px] w-auto max-w-full object-contain"
                    />

                  </div>

                  <div className="mt-4 flex gap-3">

                    <button
                      onClick={removeFile}
                      className="flex-1 rounded-xl border border-white/10 px-5 py-3 font-semibold transition hover:bg-white/5"
                    >
                      Remove
                    </button>

                    <button
                      onClick={readTimetable}
                      disabled={reading}
                      className="flex-1 rounded-xl bg-blue-600 px-5 py-3 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {reading
                        ? "🤖 Reading timetable..."
                        : "✨ Read timetable"}
                    </button>

                  </div>

                </div>
              )}

              {/* STEPS */}

              <div className="mt-10 grid gap-4 md:grid-cols-3">

                <div className="rounded-xl border border-white/10 bg-white/5 p-5">

                  <div className="text-2xl">
                    📸
                  </div>

                  <h3 className="mt-3 font-semibold">
                    Upload
                  </h3>

                  <p className="mt-1 text-sm text-slate-400">
                    Send your timetable image.
                  </p>

                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-5">

                  <div className="text-2xl">
                    🤖
                  </div>

                  <h3 className="mt-3 font-semibold">
                    Smart extraction
                  </h3>

                  <p className="mt-1 text-sm text-slate-400">
                    AI identifies subjects and timings.
                  </p>

                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-5">

                  <div className="text-2xl">
                    ✅
                  </div>

                  <h3 className="mt-3 font-semibold">
                    Confirm
                  </h3>

                  <p className="mt-1 text-sm text-slate-400">
                    Review everything before saving.
                  </p>

                </div>

              </div>

            </section>
          )}

        {/* ---------------------------------------- */}
        {/* TIMETABLE / REVIEW */}
        {/* ---------------------------------------- */}

        {(showReview || entries.length > 0) && (
          <section>

            {/* HEADER */}

            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

              <div>

                <h2 className="text-2xl font-bold">
                  {showReview
                    ? "✏️ Review timetable"
                    : "📅 Your timetable"}
                </h2>

                <p className="mt-1 text-slate-400">
                  {showReview
                    ? `AI found ${entries.length} timetable entries. Check everything before saving.`
                    : `${entries.length} classes in your active semester.`}
                </p>

              </div>

              <div className="flex flex-wrap gap-3">

                <button
                  onClick={resetTimetable}
                  className="rounded-xl border border-white/10 px-5 py-3 font-semibold transition hover:bg-white/5"
                >
                  ← Upload again
                </button>

                {showReview && (
                  <button
                    onClick={addEntry}
                    className="rounded-xl bg-white/10 px-5 py-3 font-semibold transition hover:bg-white/15"
                  >
                    + Add class
                  </button>
                )}

              </div>

            </div>

            {/* TABLE */}

            <div className="overflow-hidden rounded-2xl border border-white/10">

              <div className="overflow-x-auto">

                <table className="w-full min-w-[950px] text-left">

                  <thead className="bg-white/10">

                    <tr>

                      <th className="px-4 py-4">
                        Day
                      </th>

                      <th className="px-4 py-4">
                        Subject
                      </th>

                      <th className="px-4 py-4">
                        Start
                      </th>

                      <th className="px-4 py-4">
                        End
                      </th>

                      <th className="px-4 py-4">
                        Room
                      </th>

                      <th className="px-4 py-4">
                        Faculty
                      </th>

                      <th className="px-4 py-4">
                        Action
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {entries.map(
                      (entry, index) => (
                        <tr
                          key={index}
                          className="border-t border-white/10"
                        >

                          {/* DAY */}

                          <td className="px-4 py-3">

                            <select
                              value={entry.day_of_week}
                              onChange={(event) =>
                                updateEntry(
                                  index,
                                  "day_of_week",
                                  event.target.value
                                )
                              }
                              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 outline-none"
                            >

                              <option value="Monday">
                                Monday
                              </option>

                              <option value="Tuesday">
                                Tuesday
                              </option>

                              <option value="Wednesday">
                                Wednesday
                              </option>

                              <option value="Thursday">
                                Thursday
                              </option>

                              <option value="Friday">
                                Friday
                              </option>

                              <option value="Saturday">
                                Saturday
                              </option>

                              <option value="Sunday">
                                Sunday
                              </option>

                            </select>

                          </td>

                          {/* SUBJECT */}

                          <td className="px-4 py-3">

                            <input
                              value={entry.subject_name}
                              onChange={(event) =>
                                updateEntry(
                                  index,
                                  "subject_name",
                                  event.target.value
                                )
                              }
                              placeholder="Subject"
                              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 outline-none focus:border-blue-500"
                            />

                          </td>

                          {/* START */}

                          <td className="px-4 py-3">

                            <input
                              type="time"
                              value={entry.start_time}
                              onChange={(event) =>
                                updateEntry(
                                  index,
                                  "start_time",
                                  event.target.value
                                )
                              }
                              className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 outline-none"
                            />

                          </td>

                          {/* END */}

                          <td className="px-4 py-3">

                            <input
                              type="time"
                              value={entry.end_time}
                              onChange={(event) =>
                                updateEntry(
                                  index,
                                  "end_time",
                                  event.target.value
                                )
                              }
                              className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 outline-none"
                            />

                          </td>

                          {/* ROOM */}

                          <td className="px-4 py-3">

                            <input
                              value={entry.room}
                              onChange={(event) =>
                                updateEntry(
                                  index,
                                  "room",
                                  event.target.value
                                )
                              }
                              placeholder="Room"
                              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 outline-none focus:border-blue-500"
                            />

                          </td>

                          {/* FACULTY */}

                          <td className="px-4 py-3">

                            <input
                              value={entry.faculty_name}
                              onChange={(event) =>
                                updateEntry(
                                  index,
                                  "faculty_name",
                                  event.target.value
                                )
                              }
                              placeholder="Faculty"
                              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 outline-none focus:border-blue-500"
                            />

                          </td>

                          {/* DELETE */}

                          <td className="px-4 py-3">

                            <button
                              type="button"
                              onClick={() =>
                                deleteEntry(index)
                              }
                              className="rounded-lg px-3 py-2 text-red-400 transition hover:bg-red-500/10"
                              title="Delete class"
                            >
                              🗑️
                            </button>

                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>

              </div>

            </div>

            {/* SAVE */}

            {showReview && (
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">

                <button
                  onClick={addEntry}
                  className="rounded-xl border border-white/10 px-6 py-3 font-semibold transition hover:bg-white/5"
                >
                  + Add class
                </button>

                <button
                  onClick={confirmTimetable}
                  disabled={
                    saving ||
                    entries.length === 0
                  }
                  className="rounded-xl bg-green-600 px-6 py-3 font-semibold transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "💾 Saving..."
                    : "✅ Confirm & Save"}
                </button>

              </div>
            )}

          </section>
        )}

      </div>
    </main>
  );
}