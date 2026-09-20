import { generateFallbackMeetingAnalysis, normalizeMeetingAnalysis } from "./meetingAnalysis.js";

const languageSelect = document.getElementById("languageSelect");
const recordButton = document.getElementById("recordButton");
const recordingStatus = document.getElementById("recordingStatus");
const statusText = document.querySelector(".status-text");
const transcriptionOutput = document.getElementById("transcriptionOutput");
const interimText = document.getElementById("interimText");
const wordCount = document.getElementById("wordCount");
const charCount = document.getElementById("charCount");
const clearButton = document.getElementById("clearButton");
const copyButton = document.getElementById("copyButton");
const downloadButton = document.getElementById("downloadButton");
const errorMessage = document.getElementById("errorMessage");
const compatibilityInfo = document.getElementById("compatibilityInfo");

const tabButtons = Array.from(document.querySelectorAll(".tab-button"));
const tabPanels = {
  transcription: document.getElementById("transcriptionTab"),
  meeting: document.getElementById("meetingTab")
};

const analyzeButton = document.getElementById("analyzeButton");
const exportButton = document.getElementById("exportButton");
const meetingStatus = document.getElementById("meetingStatus");
const meetingError = document.getElementById("meetingError");
const summaryOutput = document.getElementById("summaryOutput");
const actionItemsOutput = document.getElementById("actionItemsOutput");
const deadlinesOutput = document.getElementById("deadlinesOutput");
const decisionsOutput = document.getElementById("decisionsOutput");
const nextStepsOutput = document.getElementById("nextStepsOutput");
const importantPointsOutput = document.getElementById("importantPointsOutput");
const unresolvedQuestionsOutput = document.getElementById("unresolvedQuestionsOutput");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let finalTranscript = "";
let interimTranscript = "";
let isRecording = false;
let recognition = null;
let restartTimeout = null;
let recognitionRunning = false;
let restartAllowed = true;

const meetingState = {
  currentAnalysis: null
};

function setStatus(type, text) {
  recordingStatus.className = `status ${type}`;
  statusText.textContent = text;
}

function setMeetingStatus(text) {
  meetingStatus.textContent = text;
}

function clearError() {
  errorMessage.textContent = "";
}

function clearMeetingError() {
  meetingError.textContent = "";
}

function showError(message) {
  errorMessage.textContent = message;
}

function showMeetingError(message) {
  meetingError.textContent = message;
}

function getRecognitionErrorMessage(errorCode) {
  const messages = {
    "not-allowed": "Microphone permission was denied. Allow microphone access for this site and try again.",
    "service-not-allowed": "Speech recognition is blocked by this browser. Try Google Chrome or Microsoft Edge.",
    "audio-capture": "No microphone was detected. Check that your microphone is connected and enabled.",
    "no-speech": "No speech was detected. Try speaking closer to your microphone.",
    network: "The browser speech service could not be reached. Open VoiceScribe in Google Chrome or Microsoft Edge, then check your internet connection.",
    aborted: "Recognition was stopped. Click Start Recording to try again."
  };

  return messages[errorCode] || "Speech recognition encountered a problem. Please try again.";
}

function updateCounts() {
  const safeFinalText = finalTranscript.trim();
  const words = safeFinalText ? safeFinalText.split(/\s+/).filter(Boolean).length : 0;

  wordCount.textContent = String(words);
  charCount.textContent = String(safeFinalText.length);
}

function renderTranscript() {
  transcriptionOutput.value = finalTranscript.trim();
  interimText.textContent = interimTranscript ? interimTranscript : "—";
  updateCounts();
}

function updateRecordButtonState() {
  const isSupported = Boolean(SpeechRecognition);

  recordButton.disabled = !isSupported;
  recordButton.classList.toggle("recording", isRecording);
  recordButton.setAttribute("aria-label", isRecording ? "Stop recording" : "Start recording");

  const textElement = recordButton.querySelector(".button-text");
  textElement.textContent = isRecording ? "Stop Recording" : "Start Recording";
}

function stopRecognition({ userStop = true } = {}) {
  restartAllowed = false;
  clearTimeout(restartTimeout);
  restartTimeout = null;
  isRecording = false;

  if (recognition) {
    try {
      recognition.stop();
    } catch (error) {
      // Ignore if recognition is already inactive.
    }
  }

  updateRecordButtonState();

  if (userStop) {
    setStatus("stopped", "Recording stopped");
    clearError();
  }
}

function initializeRecognition() {
  if (!SpeechRecognition) {
    return null;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = languageSelect.value;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    recognitionRunning = true;
    isRecording = true;
    updateRecordButtonState();
    setStatus("listening", "Listening...");
    clearError();
  };

  recognition.onresult = (event) => {
    let currentInterim = "";

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const currentResult = event.results[i];
      const transcriptText = currentResult[0].transcript.trim();

      if (currentResult.isFinal) {
        if (transcriptText) {
          finalTranscript = finalTranscript ? `${finalTranscript} ${transcriptText}` : transcriptText;
        }
      } else if (transcriptText) {
        currentInterim = transcriptText;
      }
    }

    interimTranscript = currentInterim;
    renderTranscript();
  };

  recognition.onerror = (event) => {
    const errorCode = event.error || "unknown";
    showError(getRecognitionErrorMessage(errorCode));

    if (["network", "not-allowed", "service-not-allowed", "audio-capture"].includes(errorCode)) {
      restartAllowed = false;
      isRecording = false;
      updateRecordButtonState();
      setStatus("error", "Speech recognition unavailable");
    }
  };

  recognition.onend = () => {
    recognitionRunning = false;
    clearTimeout(restartTimeout);

    if (isRecording && restartAllowed) {
      restartTimeout = setTimeout(() => {
        if (!isRecording || recognitionRunning) {
          return;
        }

        try {
          recognition.start();
        } catch (error) {
          if (error.name !== "InvalidStateError") {
            isRecording = false;
            updateRecordButtonState();
            showError("Recognition stopped unexpectedly. Click Start Recording to try again.");
            setStatus("error", "Recognition stopped");
          }
        }
      }, 250);
    } else if (!isRecording) {
      setStatus("stopped", "Recording stopped");
    }
  };

  return recognition;
}

function startRecognition() {
  if (!SpeechRecognition) {
    showError("Speech recognition is not supported in this browser. Please use a supported browser such as Google Chrome or Microsoft Edge.");
    setStatus("error", "Speech recognition unavailable");
    return;
  }

  if (!recognition) {
    recognition = initializeRecognition();
  }

  if (!recognition) {
    return;
  }

  restartAllowed = true;
  recognition.lang = languageSelect.value;

  try {
    recognition.start();
    recognitionRunning = true;
  } catch (error) {
    if (error.name !== "InvalidStateError") {
      showError("Recognition could not start. Please try again.");
      isRecording = false;
      updateRecordButtonState();
      setStatus("error", "Recognition could not start");
    }
  }
}

function renderTab(tabName) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  Object.entries(tabPanels).forEach(([key, panel]) => {
    const isVisible = key === tabName;
    panel.hidden = !isVisible;
    panel.classList.toggle("active", isVisible);
  });
}

function renderEmptyState(element, message) {
  element.classList.add("empty-state");
  element.innerHTML = `<p>${message}</p>`;
}

function renderListSection(element, items, formatter) {
  if (!Array.isArray(items) || items.length === 0) {
    renderEmptyState(element, "No items detected yet.");
    return;
  }

  const list = document.createElement("ul");
  list.className = "meeting-list";

  items.forEach((item) => {
    const listItem = document.createElement("li");
    listItem.innerHTML = formatter(item);
    list.appendChild(listItem);
  });

  element.classList.remove("empty-state");
  element.innerHTML = "";
  element.appendChild(list);
}

function buildActionItemsTable(items) {
  if (!Array.isArray(items) || items.length === 0) {
    renderEmptyState(actionItemsOutput, "No action items detected yet.");
    return;
  }

  const table = document.createElement("table");
  table.className = "meeting-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Task</th>
        <th>Assigned To</th>
        <th>Deadline</th>
        <th>Priority</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");

  items.forEach((item, index) => {
    const row = document.createElement("tr");
    row.dataset.index = String(index);
    row.innerHTML = `
      <td>${escapeHtml(item.task || "Not specified")}</td>
      <td>${escapeHtml(item.assignee || "Not specified")}</td>
      <td>${escapeHtml(item.deadline || "Not specified")}</td>
      <td>${escapeHtml(item.priority || "Medium")}</td>
      <td>${escapeHtml(item.status || "Pending")}</td>
      <td>
        <div class="task-actions">
          <button class="task-action" data-action="toggle-status" type="button">${item.status === "Completed" ? "Reopen" : "Mark complete"}</button>
          <button class="task-action" data-action="edit" type="button">Edit</button>
          <button class="task-action" data-action="delete" type="button">Delete</button>
          <button class="task-action" data-action="copy" type="button">Copy</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });

  actionItemsOutput.classList.remove("empty-state");
  actionItemsOutput.innerHTML = "";
  actionItemsOutput.appendChild(table);
}

function renderMeetingAnalysis(analysis, sourceLabel = "") {
  const safeAnalysis = normalizeMeetingAnalysis(analysis);
  meetingState.currentAnalysis = safeAnalysis;

  summaryOutput.classList.remove("empty-state");
  summaryOutput.textContent = safeAnalysis.summary || "No summary available yet.";

  buildActionItemsTable(safeAnalysis.action_items);

  renderListSection(deadlinesOutput, safeAnalysis.action_items, (item) => {
    const deadline = item.deadline || "Not specified";
    return `${escapeHtml(deadline)} — ${escapeHtml(item.task || "Untitled task")}`;
  });

  renderListSection(decisionsOutput, safeAnalysis.decisions, (item) => escapeHtml(item));
  renderListSection(nextStepsOutput, safeAnalysis.next_steps, (item) => escapeHtml(item));
  renderListSection(importantPointsOutput, safeAnalysis.important_points, (item) => escapeHtml(item));
  renderListSection(unresolvedQuestionsOutput, safeAnalysis.unresolved_questions, (item) => escapeHtml(item));

  if (sourceLabel) {
    setMeetingStatus(sourceLabel);
  } else {
    setMeetingStatus("Analysis complete.");
  }

  if (safeAnalysis.summary && safeAnalysis.summary !== "No summary available yet.") {
    summaryOutput.classList.remove("empty-state");
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function analyzeMeeting() {
  const transcript = finalTranscript.trim();

  if (!transcript) {
    showMeetingError("Please record or enter a meeting transcript before analyzing.");
    setMeetingStatus("No transcript available.");
    return;
  }

  clearMeetingError();
  analyzeButton.disabled = true;
  analyzeButton.textContent = "Analyzing...";
  setMeetingStatus("Analyzing transcript...");

  try {
    const response = await fetch("/api/analyze-meeting", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ transcript })
    });

    const payload = await response.json();

    if (!response.ok || !payload?.analysis) {
      throw new Error(payload?.message || "The meeting analysis service could not complete the request.");
    }

    const analysis = normalizeMeetingAnalysis(payload.analysis);
    meetingState.currentAnalysis = analysis;
    renderMeetingAnalysis(analysis, payload.source === "fallback"
      ? "Analysis completed with local fallback logic. Configure the AI provider to use a live model."
      : "Analysis generated using the configured AI provider.");
  } catch (error) {
    const fallback = generateFallbackMeetingAnalysis(transcript);
    meetingState.currentAnalysis = normalizeMeetingAnalysis(fallback);
    renderMeetingAnalysis(meetingState.currentAnalysis, "Analysis unavailable. A local fallback was used instead.");
    showMeetingError(error.message || "The analysis service failed. A local fallback was used to keep the transcript readable.");
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.textContent = "Analyze Meeting";
  }
}

function buildMeetingExportText() {
  const analysis = meetingState.currentAnalysis || normalizeMeetingAnalysis(generateFallbackMeetingAnalysis(finalTranscript));

  const lines = [
    "MEETING SUMMARY",
    "",
    analysis.summary || "No summary provided.",
    "",
    "ACTION ITEMS",
    ""
  ];

  if (Array.isArray(analysis.action_items) && analysis.action_items.length > 0) {
    analysis.action_items.forEach((item) => {
      lines.push(`- ${item.task || "Not specified"} | Assignee: ${item.assignee || "Not specified"} | Deadline: ${item.deadline || "Not specified"} | Priority: ${item.priority || "Medium"} | Status: ${item.status || "Pending"}`);
    });
  } else {
    lines.push("No action items detected.");
  }

  lines.push("", "DEADLINES", "");
  if (Array.isArray(analysis.action_items) && analysis.action_items.length > 0) {
    analysis.action_items.forEach((item) => {
      if (item.deadline && item.deadline !== "Not specified") {
        lines.push(`${item.deadline} — ${item.task || "Task"}`);
      }
    });
  } else {
    lines.push("No deadlines detected.");
  }

  lines.push("", "DECISIONS", "");
  if (Array.isArray(analysis.decisions) && analysis.decisions.length > 0) {
    analysis.decisions.forEach((item) => lines.push(`- ${item}`));
  } else {
    lines.push("No decisions captured.");
  }

  lines.push("", "NEXT STEPS", "");
  if (Array.isArray(analysis.next_steps) && analysis.next_steps.length > 0) {
    analysis.next_steps.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
  } else {
    lines.push("No next steps identified.");
  }

  lines.push("", "IMPORTANT POINTS", "");
  if (Array.isArray(analysis.important_points) && analysis.important_points.length > 0) {
    analysis.important_points.forEach((item) => lines.push(`- ${item}`));
  } else {
    lines.push("No important points captured.");
  }

  lines.push("", "UNRESOLVED QUESTIONS", "");
  if (Array.isArray(analysis.unresolved_questions) && analysis.unresolved_questions.length > 0) {
    analysis.unresolved_questions.forEach((item) => lines.push(`- ${item}`));
  } else {
    lines.push("No unresolved questions detected.");
  }

  lines.push("", "RAW TRANSCRIPT", "");
  lines.push(finalTranscript.trim() || "No raw transcript available.");

  return lines.join("\n");
}

function exportMeetingNotes() {
  const transcript = finalTranscript.trim();

  if (!transcript) {
    showMeetingError("Please record or enter a meeting transcript before exporting notes.");
    return;
  }

  const content = buildMeetingExportText();
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = "meeting-notes.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  clearMeetingError();
  setMeetingStatus("Meeting notes exported successfully.");
}

function handleTaskActionClick(event) {
  const button = event.target.closest(".task-action");
  if (!button) {
    return;
  }

  const row = button.closest("tr");
  const index = Number(row?.dataset.index);
  const task = meetingState.currentAnalysis?.action_items?.[index];

  if (!task) {
    return;
  }

  if (button.dataset.action === "toggle-status") {
    task.status = task.status === "Completed" ? "Pending" : "Completed";
    renderMeetingAnalysis(meetingState.currentAnalysis);
    return;
  }

  if (button.dataset.action === "edit") {
    const nextTask = window.prompt("Edit the task text:", task.task);
    if (nextTask && nextTask.trim()) {
      task.task = nextTask.trim();
      renderMeetingAnalysis(meetingState.currentAnalysis);
    }
    return;
  }

  if (button.dataset.action === "delete") {
    meetingState.currentAnalysis.action_items.splice(index, 1);
    renderMeetingAnalysis(meetingState.currentAnalysis);
    return;
  }

  if (button.dataset.action === "copy") {
    const summary = `${task.task} | Assignee: ${task.assignee || "Not specified"} | Deadline: ${task.deadline || "Not specified"} | Priority: ${task.priority || "Medium"} | Status: ${task.status || "Pending"}`;
    navigator.clipboard.writeText(summary).catch(() => {
      showMeetingError("Unable to copy the selected task. Please copy it manually.");
    });
  }
}

recordButton.addEventListener("click", () => {
  if (!SpeechRecognition) {
    showError("Speech recognition is not supported in this browser. Please use a supported browser such as Google Chrome or Microsoft Edge.");
    setStatus("error", "Speech recognition unavailable");
    return;
  }

  if (isRecording) {
    stopRecognition({ userStop: true });
    return;
  }

  startRecognition();
});

languageSelect.addEventListener("change", () => {
  if (recognition && isRecording) {
    stopRecognition({ userStop: false });
    setTimeout(() => {
      startRecognition();
    }, 250);
    return;
  }

  if (recognition) {
    recognition.lang = languageSelect.value;
  }
});

clearButton.addEventListener("click", () => {
  const hasText = Boolean(finalTranscript.trim() || interimTranscript.trim());

  if (!hasText) {
    finalTranscript = "";
    interimTranscript = "";
    renderTranscript();
    meetingState.currentAnalysis = null;
    setMeetingStatus("No analysis generated yet.");
    return;
  }

  const shouldClear = window.confirm("Clear the current transcription?");
  if (!shouldClear) {
    return;
  }

  finalTranscript = "";
  interimTranscript = "";
  renderTranscript();
  clearError();
  clearMeetingError();
  meetingState.currentAnalysis = null;
  setMeetingStatus("No analysis generated yet.");
  renderEmptyState(summaryOutput, "No summary available yet.");
  renderEmptyState(actionItemsOutput, "No action items detected yet.");
  renderEmptyState(deadlinesOutput, "No deadlines detected yet.");
  renderEmptyState(decisionsOutput, "No decisions captured yet.");
  renderEmptyState(nextStepsOutput, "No next steps identified yet.");
  renderEmptyState(importantPointsOutput, "No important points captured yet.");
  renderEmptyState(unresolvedQuestionsOutput, "No unresolved questions detected yet.");
});

copyButton.addEventListener("click", async () => {
  const content = finalTranscript.trim();

  if (!content) {
    showError("Nothing to copy yet.");
    return;
  }

  try {
    await navigator.clipboard.writeText(content);
    const originalText = copyButton.textContent;
    copyButton.textContent = "Copied!";
    setTimeout(() => {
      copyButton.textContent = originalText;
    }, 1200);
    clearError();
  } catch (error) {
    showError("Unable to copy text. Please copy it manually.");
  }
});

downloadButton.addEventListener("click", () => {
  const content = finalTranscript.trim();

  if (!content) {
    showError("Nothing to download yet.");
    return;
  }

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const downloadLink = document.createElement("a");
  const downloadUrl = URL.createObjectURL(blob);

  downloadLink.href = downloadUrl;
  downloadLink.download = "transcription.txt";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(downloadUrl);
  clearError();
});

analyzeButton.addEventListener("click", analyzeMeeting);
exportButton.addEventListener("click", exportMeetingNotes);
actionItemsOutput.addEventListener("click", handleTaskActionClick);

tabButtons.forEach((button) => {
  button.addEventListener("click", () => renderTab(button.dataset.tab));
});

function initializeUi() {
  renderTab("transcription");
  setStatus("ready", "Ready to record");
  renderTranscript();
  updateRecordButtonState();

  if (!SpeechRecognition) {
    showError("Speech recognition is not supported in this browser. Please use a supported browser such as Google Chrome or Microsoft Edge.");
    setStatus("error", "Speech recognition unavailable");
    compatibilityInfo.textContent = "This browser does not support the Web Speech API. Please use Google Chrome or Microsoft Edge.";
    recordButton.disabled = true;
    return;
  }

  compatibilityInfo.textContent = "Web Speech API support varies by browser. For the best results, use Google Chrome or Microsoft Edge.";
  initializeRecognition();
  setMeetingStatus("No analysis generated yet.");
  renderEmptyState(summaryOutput, "No summary available yet.");
  renderEmptyState(actionItemsOutput, "No action items detected yet.");
  renderEmptyState(deadlinesOutput, "No deadlines detected yet.");
  renderEmptyState(decisionsOutput, "No decisions captured yet.");
  renderEmptyState(nextStepsOutput, "No next steps identified yet.");
  renderEmptyState(importantPointsOutput, "No important points captured yet.");
  renderEmptyState(unresolvedQuestionsOutput, "No unresolved questions detected yet.");
}

initializeUi();
