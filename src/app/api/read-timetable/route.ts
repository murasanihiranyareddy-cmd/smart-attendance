import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const timetableSchema = {
  type: "object",
  properties: {
    entries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          day_of_week: {
            type: "string",
          },
          subject_name: {
            type: "string",
          },
          start_time: {
            type: "string",
          },
          end_time: {
            type: "string",
          },
          room: {
            type: "string",
          },
          faculty_name: {
            type: "string",
          },
        },
        required: [
          "day_of_week",
          "subject_name",
          "start_time",
          "end_time",
          "room",
          "faculty_name",
        ],
      },
    },
  },
  required: ["entries"],
};

export async function POST(request: Request) {
  try {
    console.log("📸 Timetable API request received");

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY is missing. Check your .env.local file.",
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            "No timetable image was uploaded.",
        },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        {
          error:
            "Please upload a timetable image.",
        },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        {
          error:
            "Image must be smaller than 10 MB.",
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(
      await file.arrayBuffer()
    );

    const base64Image =
      buffer.toString("base64");

    const prompt = `
You are an expert college timetable reader.

Carefully inspect the ENTIRE timetable image.

Extract EVERY actual class period visible in the image.

Return the timetable as structured JSON.

Rules:

1. Use these exact day names:
Monday
Tuesday
Wednesday
Thursday
Friday
Saturday
Sunday

2. Convert times to 24-hour HH:MM format.

3. Preserve the exact subject name.

4. Preserve (T) and (P) when present.

5. Do NOT split two-hour practical classes.

For example:
09:00 - 11:00
must remain:

start_time: "09:00"
end_time: "11:00"

6. Ignore:
- lunch
- breaks
- free periods
- holidays
- headers
- timetable titles
- section names
- other non-class information

7. room:
Only include an actual room value visible in the timetable.
If unavailable, return an empty string.

8. faculty_name:
Only include actual faculty initials/name visible in the timetable.
If unavailable, return an empty string.

9. Never use these as actual values:
Room
Faculty
Teacher
Professor
N/A
Unknown
None

10. If multiple faculty members are shown for one practical class, preserve them together.

Example:
"LSR, PSN, MSD"

11. If the same subject appears at different times, create separate entries.

12. If the same subject appears on different days, create separate entries.

13. Do not merge different days.

14. Carefully inspect the entire image before answering.

15. If no classes can be identified, return an empty entries array.

Extract all timetable classes.
`;

    console.log(
      "🤖 Sending timetable image to Gemini..."
    );

    const response =
      await ai.models.generateContent({
        model: "gemini-3.6-flash",

        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt,
              },
              {
                inlineData: {
                  mimeType: file.type,
                  data: base64Image,
                },
              },
            ],
          },
        ],

        config: {
          responseMimeType:
            "application/json",

          responseSchema:
            timetableSchema,

          maxOutputTokens: 12000,

          thinkingConfig: {
            thinkingLevel: "low",
          },
        },
      });

    console.log(
      "✅ Gemini response received"
    );

    console.log(
      "Gemini response:",
      JSON.stringify(
        response,
        null,
        2
      )
    );

    const text =
      response.text?.trim();

    if (!text) {
      console.error(
        "❌ Gemini returned no text."
      );

      return NextResponse.json(
        {
          error:
            "Gemini returned an empty response. Check the terminal for the full Gemini response.",
        },
        { status: 500 }
      );
    }

    console.log(
      "📝 Gemini text:",
      text
    );

    let parsed: any;

    try {
      parsed = JSON.parse(text);
    } catch (error) {
      console.error(
        "❌ Gemini JSON parsing failed:"
      );

      console.error(text);

      return NextResponse.json(
        {
          error:
            "Gemini returned invalid timetable JSON.",
          rawResponse: text,
        },
        { status: 500 }
      );
    }

    if (
      !parsed ||
      !Array.isArray(
        parsed.entries
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Gemini returned an invalid timetable structure.",
        },
        { status: 500 }
      );
    }

    const invalidValues = [
      "Room",
      "Faculty",
      "Teacher",
      "Professor",
      "N/A",
      "Unknown",
      "None",
    ];

    const entries =
      parsed.entries
        .filter(
          (entry: any) =>
            entry &&
            typeof entry.day_of_week ===
              "string" &&
            typeof entry.subject_name ===
              "string" &&
            typeof entry.start_time ===
              "string" &&
            typeof entry.end_time ===
              "string"
        )
        .map(
          (entry: any) => {
            const room =
              typeof entry.room ===
                "string"
                ? entry.room.trim()
                : "";

            const faculty =
              typeof entry.faculty_name ===
                "string"
                ? entry.faculty_name.trim()
                : "";

            return {
              day_of_week:
                entry.day_of_week.trim(),

              subject_name:
                entry.subject_name.trim(),

              start_time:
                entry.start_time.trim(),

              end_time:
                entry.end_time.trim(),

              room:
                invalidValues.includes(
                  room
                )
                  ? ""
                  : room,

              faculty_name:
                invalidValues.includes(
                  faculty
                )
                  ? ""
                  : faculty,
            };
          }
        )
        .filter(
          (entry: any) =>
            entry.subject_name &&
            entry.start_time &&
            entry.end_time
        );

    console.log(
      `🎉 Extracted ${entries.length} timetable entries`
    );

    return NextResponse.json({
      entries,
    });
  } catch (error) {
    console.error(
      "❌ Timetable extraction error:"
    );

    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}