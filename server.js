import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateFallbackMeetingAnalysis, normalizeMeetingAnalysis } from "./meetingAnalysis.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3000);
const openAiKey = process.env.OPENAI_API_KEY;
const openAiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
const aiProvider = process.env.AI_PROVIDER || "openai";

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

function parseJsonResponse(responseText) {
  const trimmed = responseText.trim();
  const withoutCodeFence = trimmed.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
  return JSON.parse(withoutCodeFence);
}

async function callOpenAiAnalysis(transcript) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiKey}`
    },
    body: JSON.stringify({
      model: openAiModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a precise professional meeting assistant. Analyze the entire transcript, not just its opening. Return only valid JSON with fields: summary, action_items, decisions, next_steps, important_points, unresolved_questions. The summary must be a genuine synthesis, not a transcript rewrite: explain what the meeting was about, then combine the important status updates, problems, decisions, dependencies, and follow-up work in 3-6 coherent sentences. Do not copy long source sentences, greetings, or every utterance. Cover important topics from the whole transcript, including later topics. Treat these as action cues when they have a concrete object: will, should do, needs to do, must do, please, responsible for, assigned to, complete, finish, fix, create, update, review, send, prepare, handle, deliver, or follow-up. Treat pending, in progress, and completed as status/context words, not tasks by themselves. Extract action items only when someone is asked, assigned, commits, or is expected to do something. Rewrite each task as a short imperative/objective phrase such as 'Fix login bug', 'Complete database integration', 'Prepare presentation', or 'Review documentation'; never paste the full source sentence, and combine duplicate references to the same task. Resolve pronouns and context using the surrounding conversation. Keep testing or launch questions out of action_items when they are only plans or unresolved proposals; put them in decisions, next_steps, important_points, or unresolved_questions instead. Distinguish confirmed deadlines from proposed dates. For example, 'Should we launch on the 25th or postpone it?' is an unresolved question, not a confirmed deadline. Use high priority only for explicit words such as high priority, urgent, critical, or ASAP. Each action item must include task, assignee, deadline, normalized_deadline, priority, status. Use 'Not specified' when information is missing and do not invent details. Include all decisions, meaningful next steps, important points, and unresolved questions supported by the transcript."
        },
        {
          role: "user",
          content: transcript
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI provider request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI provider returned an empty response.");
  }

  const parsed = parseJsonResponse(content);
  return normalizeMeetingAnalysis(parsed);
}

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/api/analyze-meeting", async (req, res) => {
  const transcript = typeof req.body?.transcript === "string" ? req.body.transcript.trim() : "";

  if (!transcript) {
    return res.status(400).json({
      ok: false,
      message: "Please record or enter a meeting transcript before analyzing."
    });
  }

  try {
    if (!openAiKey) {
      const fallback = generateFallbackMeetingAnalysis(transcript);
      return res.json({
        ok: true,
        source: "fallback",
        analysis: normalizeMeetingAnalysis(fallback)
      });
    }

    const analysis = await callOpenAiAnalysis(transcript);
    return res.json({
      ok: true,
      source: aiProvider,
      analysis
    });
  } catch (error) {
    const fallback = generateFallbackMeetingAnalysis(transcript);
    return res.json({
      ok: true,
      source: "fallback",
      analysis: normalizeMeetingAnalysis(fallback),
      warning: error.message || "AI provider failed. Local fallback analysis was used instead."
    });
  }
});

app.listen(port, () => {
  console.log(`VoiceScribe server is running on http://localhost:${port}`);
});
