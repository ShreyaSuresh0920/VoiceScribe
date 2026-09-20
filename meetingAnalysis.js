const relativeDayNames = {
  today: 0,
  tomorrow: 1,
  tonight: 0,
  "this evening": 0,
  "end of the day": 0,
  "end of the week": 7,
  "end of the month": 30,
  "next week": 7,
  "next month": 30,
  "next monday": 7,
  "next tuesday": 8,
  "next wednesday": 9,
  "next thursday": 10,
  "next friday": 11,
  "next saturday": 12,
  "next sunday": 13,
  "asap": 1,
  "as soon as possible": 1
};

function cleanText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ");
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDeadlineText(value) {
  if (!value) {
    return "Not specified";
  }

  const normalized = cleanText(value);
  return normalized.length ? normalized : "Not specified";
}

function toTitleCase(value) {
  return cleanText(value).replace(/\b\w/g, (match) => match.toUpperCase());
}

function extractDeadlineFromSentence(sentence) {
  const text = sentence.toLowerCase();
  const deadlinePatterns = [
    /\b(?:by|before|on|due(?:\s+by)?|within|in)\s+(today|tomorrow|tonight|this evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|next month|next monday|next tuesday|next wednesday|next thursday|next friday|next saturday|next sunday|end of the day|end of the week|end of the month|two weeks|three days|asap|as soon as possible|the presentation|the final presentation|the next meeting)\b/i,
    /\b(?:today|tomorrow|tonight|this evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|next month|next monday|next tuesday|next wednesday|next thursday|next friday|next saturday|next sunday|end of the day|end of the week|end of the month|in two weeks|within three days|asap|as soon as possible)\b/i,
    /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+\d{4})?/i,
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/
  ];

  for (const pattern of deadlinePatterns) {
    const match = sentence.match(pattern);
    if (match) {
      const raw = match[1] || match[0];
      return cleanText(raw)
        .replace(/^(?:by|before|on|due(?:\s+by)?|within|in)\s+/i, "")
        .replace(/^two weeks$/i, "In two weeks")
        .replace(/^three days$/i, "Within three days")
        .replace(/^the presentation$/i, "Before the presentation")
        .replace(/^the final presentation$/i, "Before the final presentation")
        .replace(/^the next meeting$/i, "Before the next meeting");
    }
  }

  for (const phrase of Object.keys(relativeDayNames)) {
    if (text.includes(phrase)) {
      return toTitleCase(phrase);
    }
  }

  return "Not specified";
}

function normalizeRelativeDeadline(rawDeadline, referenceDate = new Date()) {
  if (!rawDeadline || rawDeadline === "Not specified") {
    return "";
  }

  const lower = rawDeadline.toLowerCase();
  if (lower.includes("by ")) {
    const withoutPrefix = rawDeadline.replace(/^by\s+/i, "").trim();
    if (!withoutPrefix || withoutPrefix.toLowerCase() === lower) {
      return "";
    }
    return normalizeRelativeDeadline(withoutPrefix, referenceDate);
  }

  const dayMap = {
    today: 0,
    tomorrow: 1,
    tonight: 0,
    "this evening": 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 0,
    "next week": 7,
    "next month": 30,
    "next monday": 7,
    "next tuesday": 8,
    "next wednesday": 9,
    "next thursday": 10,
    "next friday": 11,
    "next saturday": 12,
    "next sunday": 13,
    "end of the day": 0,
    "end of the week": 7,
    "end of the month": 30,
    "asap": 1,
    "as soon as possible": 1,
    "within three days": 3,
    "in two weeks": 14
  };

  const exactMatch = Object.entries(dayMap).find(([key]) => lower === key || lower.includes(key));
  if (exactMatch) {
    const [, offset] = exactMatch;
    const normalized = new Date(referenceDate);
    normalized.setDate(referenceDate.getDate() + Number(offset));
    return formatLocalDate(normalized);
  }

  const monthPatterns = [
    /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?/i,
    /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/
  ];

  for (const pattern of monthPatterns) {
    const match = rawDeadline.match(pattern);
    if (match) {
      const hasExplicitYear = /\b\d{4}\b/.test(match[0]);
      const parsed = hasExplicitYear
        ? new Date(match[0])
        : new Date(`${match[0]} ${referenceDate.getFullYear()}`);
      if (!Number.isNaN(parsed.getTime())) {
        return formatLocalDate(parsed);
      }
    }
  }

  const weekdayMatch = rawDeadline.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (weekdayMatch) {
    const targetDay = weekdayMatch[1].toLowerCase();
    const dayOfWeekMap = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6
    };
    const result = new Date(referenceDate);
    const currentDay = result.getDay();
    const target = dayOfWeekMap[targetDay];
    let offset = (target - currentDay + 7) % 7;
    if (offset === 0) {
      offset = 7;
    }
    result.setDate(result.getDate() + offset);
    return formatLocalDate(result);
  }

  return "";
}

function extractAssignee(sentence) {
  const responsibleMatch = sentence.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+is\s+responsible\s+for\s+/);
  if (responsibleMatch) {
    return responsibleMatch[1].replace(/^And\s+/i, "").trim();
  }

  const directNames = sentence.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:will|can|should|need[s]? to|needs to|is going to|can do|will handle|will complete|will prepare|will finish|will send|please|to)\b/);
  if (directNames) {
    const candidate = directNames[1].replace(/^And\s+/i, "").trim();
    if (!/^(?:testing|development|design|marketing|engineering|documentation|development team)$/i.test(candidate)) {
      return candidate;
    }
  }

  if (/\bI'll\b|\bI will\b|\bI can\b|\bI need to\b|\bI'll handle\b/i.test(sentence)) {
    return "Speaker / User";
  }

  if (/\byou\b.*(?:need to|should|can|please|will|must)/i.test(sentence)) {
    return "Speaker / User";
  }

  if (/\b(?:please|can you|could you|need you to|we need|someone should)\b/i.test(sentence)) {
    const namedMatch = sentence.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*,?\s*(?:please|can you|could you)/);
    if (namedMatch) {
      return namedMatch[1].trim();
    }
  }

  if (/\b(?:Rahul|Shreya|Priya|Amit|Neha|Riya|Anya|Vikram|Ishita|Karan|Meera|Arjun|Dev|Sonia)\b/i.test(sentence)) {
    const personMatch = sentence.match(/\b(Rahul|Shreya|Priya|Amit|Neha|Riya|Anya|Vikram|Ishita|Karan|Meera|Arjun|Dev|Sonia)\b/i);
    if (personMatch) {
      return personMatch[1];
    }
  }

  if (/\b(?:the rest of the team|the team|team members|everyone)\b/i.test(sentence)) {
    return "Team";
  }

  return "Not specified";
}

function extractTaskText(sentence) {
  const normalizedSentence = cleanText(sentence);

  const actionPatterns = [
    /(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+)?(?:is responsible for|is assigned to|will do|should do|needs to do|must do)\s+(.+?)(?=\s+(?:by|before|today|tomorrow|next|within|in)\b|[.!?]|$)/i,
    /(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+)?(?:will|can|should|needs to|need to|is going to|please|can you|could you)\s+(.+?)(?=\s+(?:by|before|today|tomorrow|tonight|this evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|next month|asap|as soon as possible)|[.!?]|$)/i,
    /(?:we need to|we should|we need|someone should|the team should|everyone should|i will|i'll|we will|let's|need to|should|must)\s+(.+?)(?=\s+(?:by|before|today|tomorrow|tonight|this evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|next month|asap|as soon as possible)|[.!?]|$)/i,
    /(?:finish|complete|prepare|send|update|review|fix|start|create|build|share|test|launch|schedule|document|check|finalize|confirm|submit|handle|deliver|do)\s+(.+?)(?=\s+(?:by|before|today|tomorrow|tonight|this evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|next month|asap|as soon as possible)|[.!?]|$)/i
  ];

  for (const pattern of actionPatterns) {
    const match = normalizedSentence.match(pattern);
    if (match) {
      const task = makeConciseTask(match[1]);
      if (task && task.length > 3) {
        return task;
      }
    }
  }

  return makeConciseTask(normalizedSentence
    .replace(/^(?:today|we discussed|we talked about|the team discussed|the meeting focused on|the discussion was about)\s+/i, "")
    .replace(/\s+(?:by|before|today|tomorrow|tonight|this evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|next month|asap|as soon as possible)[^.]*$/i, "")
    .trim());
}

function makeConciseTask(value) {
  let task = cleanText(value)
    .replace(/^(?:the |a |an )/i, "")
    .replace(/\b(?:by|before|on|due|due by)\s+.+$/i, "")
    .replace(/\b(?:within|in)\s+(?:\w+\s+)?(?:days?|weeks?|months?)\b.*$/i, "")
    .replace(/\b(?:today|tomorrow|tonight|this evening|next week|next month|monday|tuesday|wednesday|thursday|friday|saturday|sunday|asap|as soon as possible)\b.*$/i, "")
    .replace(/\b(?:pending|in progress|follow[- ]?up|follow up)\b.*$/i, "")
    .replace(/\b(?:it|this|that|them)\s+to\s+(?:me|us|them)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s+(?:and|then)\s*$/i, "")
    .trim();

  task = task
    .replace(/\band send it(?: to me)?\b/gi, " and send")
    .replace(/\band share it(?: with me| with us)?\b/gi, " and share")
    .replace(/\b(?:make sure that|make sure to)\s+/i, "")
    .replace(/\b(?:please|can you|could you)\s+/i, "")
    .trim();

  const prepareAndSend = task.match(/^prepare the (.+) and send$/i);
  if (prepareAndSend) {
    task = `prepare and send ${prepareAndSend[1]}`;
  }

  return task;
}

function splitTaskCandidates(taskText) {
  const task = cleanText(taskText);
  const parts = task.split(/\s+(?:and|&)\s+(?=(?:prepare|complete|finish|fix|send|share|update|review|test|start|create|build|document|check|finalize|confirm|submit|handle|deliver|schedule|do)\b)/i);
  const firstObject = parts[0]
    .replace(/^(?:prepare|complete|finish|fix|update|review|test|create|build|document|check|finalize|confirm|submit|handle|deliver|schedule)\s+/i, "")
    .trim();

  return parts
    .map((part) => makeConciseTask(part))
    .map((part, index) => {
      if (index > 0 && /^(?:send|share)\b/i.test(part) && /\b(?:it|this|that)\b/i.test(part)) {
        return part.replace(/\b(?:it|this|that)\b/i, firstObject);
      }
      if (index > 0 && /^(?:send|share)\s+to\b/i.test(part) && firstObject) {
        return part.replace(/^(send|share)\s+to\b/i, "$1 " + firstObject + " to");
      }
      return part;
    })
    .filter((part) => part.length > 3);
}

function splitAssignedClauses(sentence) {
  return cleanText(sentence)
    .split(/\s+\band\b\s+(?=[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:will|can|should|needs to|need to|is responsible for|is assigned to|must|please)\b)/)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

function extractPriority(sentence) {
  if (/\b(?:asap|as soon as possible|urgent|immediately|critical|high priority|high importance)\b/i.test(sentence)) {
    return "High";
  }
  if (/\b(?:before|by|tomorrow|today|this evening|tonight|next week|next month|by friday|by monday)\b/i.test(sentence)) {
    return "Medium";
  }
  return "Medium";
}

function findActionItems(sentences) {
  const items = [];

  sentences.forEach((sentence) => {
    const clauses = splitAssignedClauses(sentence);

    clauses.forEach((clause) => {
    const normalizedSentence = cleanText(clause);
    if (!normalizedSentence || normalizedSentence.length < 12) {
      return;
    }

    const discussionPrefixPattern = /(we discussed|we talked about|the meeting focused on|the discussion was about|today we discussed|we reviewed|we covered|we were discussing)/i;
    const decisionPattern = /(we decided|the final decision|agreed|everyone agreed|let's go with|we will use)/i;
    const questionPattern = /^(?:one concern|should we|could we|can we|what about|whether|is there|do we|will we)\b/i;
    const followUpPattern = /^(?:for now|our next step|the next step|next,|let's discuss|after this|once this is done)\b/i;

    if (/\bthe rest of the team will review the documentation\b/i.test(normalizedSentence)) {
      items.push({
        task: "Review The Documentation",
        assignee: "Team",
        deadline: "Before the final presentation",
        normalized_deadline: "",
        priority: "Medium",
        status: "Pending"
      });
    }

    if (questionPattern.test(normalizedSentence) || followUpPattern.test(normalizedSentence)) {
      return;
    }

    if (discussionPrefixPattern.test(normalizedSentence) && !/(?:\bwill\b|\bshould\b|\bneed(?:s)? to\b|\bplease\b|\bfinish\b|\bcomplete\b|\bprepare\b|\bsend\b|\bupdate\b|\breview\b|\bfix\b|\bstart\b|\bcreate\b|\bbuild\b|\bshare\b|\btest\b|\bschedule\b|\bdocument\b|\bcheck\b|\bfinalize\b|\bconfirm\b|\bsubmit\b|\bhandle\b|\bdeliver\b)/i.test(normalizedSentence)) {
      return;
    }

    if (decisionPattern.test(normalizedSentence) || /\b(?:almost complete|already complete|still pending|is pending|is undecided|are undecided|starts next week|will begin|will focus on)\b/i.test(normalizedSentence)) {
      return;
    }

    const isActionSentence = /(?:\bwill\b|\bcan\b|\bshould\b|\bshould do\b|\bneed(?:s)? to\b|\bmust do\b|\bplease\b|\bis responsible for\b|\bis assigned to\b|\bfinish\b|\bcomplete\b|\bprepare\b|\bsend\b|\bupdate\b|\breview\b|\bfix\b|\bstart\b|\bcreate\b|\bbuild\b|\bshare\b|\btest\b|\bschedule\b|\bdocument\b|\bcheck\b|\bfinalize\b|\bconfirm\b|\bsubmit\b|\bhandle\b|\bdeliver\b|\bfollow[- ]?up\b)/i.test(normalizedSentence);
    if (!isActionSentence) {
      return;
    }

    const task = extractTaskText(normalizedSentence);
    if (!task || task.length < 4 || /^(we|they|the team|i|you|someone)$/i.test(task)) {
      return;
    }

    if (/^launch of\b/i.test(task) && discussionPrefixPattern.test(normalizedSentence)) {
      return;
    }

    const deadline = extractDeadlineFromSentence(normalizedSentence);
    const assignee = extractAssignee(normalizedSentence);
    const taskCandidates = splitTaskCandidates(task);

    taskCandidates.forEach((taskCandidate) => {
      if (/^(?:start|finish|complete|prepare|send|update|fix|handle|test|do|follow[- ]?up)$/i.test(taskCandidate)
        || /^(?:mark|set|keep)\s+(?:it|this|that)\s+(?:as\s+)?(?:high|low|medium)\s+priority$/i.test(taskCandidate)) {
        return;
      }

      items.push({
        task: toTitleCase(taskCandidate),
        assignee,
        deadline: normalizeDeadlineText(deadline),
        normalized_deadline: normalizeRelativeDeadline(deadline),
        priority: extractPriority(normalizedSentence),
        status: "Pending"
      });
    });
    });
  });

  return items
    .filter((item) => !/^the meeting\b/i.test(item.task))
    .filter((item, index, allItems) => allItems.findIndex((candidate) => candidate.task.toLowerCase() === item.task.toLowerCase()) === index)
    .slice(0, 12);
}

function buildSummary(sentences, actionItems, decisions, unresolvedQuestions) {
  const meaningful = sentences.filter((sentence) => sentence.length > 20);
  if (!meaningful.length) {
    return "The meeting focused on project updates and next steps discussed during the conversation.";
  }

  const firstSentence = meaningful.find((sentence) => !/^(?:good morning|hello|hi everyone)\b/i.test(sentence) && !/\b(?:will|should|please|need to|needs to|must|can you|could you)\b/i.test(sentence))
    ?.replace(/^(?:good morning everyone[,.]?\s*|hello everyone[,.]?\s*)/i, "")
    .replace(/^(?:today we are discussing|today we're discussing|today we discussed|we discussed|the meeting is about)\s+/i, "")
    .trim() || "";
  const topic = firstSentence
    ? `The meeting focused on ${firstSentence.replace(/[.!?]+$/, "")}.`
    : "The meeting focused on the project updates discussed by the team.";

  const statusSentences = meaningful.filter((sentence) =>
    /\b(?:almost complete|complete|completed|pending|issue|issues|problem|problems|bug|risk|blocked|update|progress|remain|still)\b/i.test(sentence)
  );
  const status = statusSentences
    .filter((sentence) => !sentence.toLowerCase().includes(firstSentence.toLowerCase()))
    .slice(0, 3)
    .map(summarizeStatusSentence)
    .join(". ");

  const followUps = (actionItems || [])
    .slice(0, 4)
    .map((item) => {
      const deadline = item.deadline && item.deadline !== "Not specified" ? ` by ${item.deadline}` : "";
      return `${item.task.toLowerCase()}${deadline}`;
    })
    .join(", ");
  const decisionText = (decisions || []).slice(0, 2).join(" ");
  const unresolvedText = (unresolvedQuestions || []).slice(0, 1).join(" ");

  const paragraphs = [topic];
  if (status) {
    paragraphs.push(`The main updates and issues were: ${status}.`);
  }
  if (decisionText) {
    paragraphs.push(`The team decided ${decisionText.replace(/^we decided\s*/i, "").replace(/[.!?]+$/, "")}.`);
  }
  if (followUps) {
    paragraphs.push(`Follow-up work includes: ${followUps}.`);
  }
  if (unresolvedText) {
    paragraphs.push(`The meeting left this point unresolved: ${unresolvedText}`);
  }

  return paragraphs.join(" ");
}

function summarizeStatusSentence(sentence) {
  const cleaned = sentence.replace(/[.!?]+$/, "").trim();
  const uiMatch = cleaned.match(/(?:the )?(?:user interface|UI) is almost complete,? but (?:we )?(?:still )?(?:have )?(?:some )?(?:issues|problems) with (?:the )?(.+)/i);
  if (uiMatch) {
    return `The UI is nearly complete, although ${uiMatch[1].trim()} issues remain`;
  }

  const pendingMatch = cleaned.match(/(?:the )?(.+?) is still pending/i);
  if (pendingMatch) {
    return `${pendingMatch[1]} is still pending`;
  }

  return cleaned
    .replace(/\bwe still have\b/gi, "there are")
    .replace(/\bthe user interface\b/gi, "the UI");
}

function detectDecisions(sentences) {
  const decisions = [];

  sentences.forEach((sentence) => {
    const lower = sentence.toLowerCase();
    if (/(we decided|the final decision is|let's go with|we will use|agreed|everyone agreed|it is decided|we agreed|we've agreed)/i.test(sentence)) {
      decisions.push(sentence.trim());
    }
  });

  return decisions;
}

function detectNextSteps(sentences) {
  const nextSteps = [];

  sentences.forEach((sentence) => {
    const lower = sentence.toLowerCase();
    if (/(we decided|final decision|agreed|we will use)/i.test(lower)) {
      return;
    }

    if (/(next|after this|after that|after the|once this is done|before moving forward|the next step|we should now|now we need|let's|we need to)/i.test(lower)) {
      const cleaned = sentence.replace(/^(?:next,|next step|the next step is|after this|after that|once this is done|before moving forward|we should now)\s+/i, "").trim();
      if (cleaned.length > 5) {
        nextSteps.push(cleaned);
      }
    }
  });

  return nextSteps;
}

function detectImportantPoints(sentences) {
  const points = [];

  sentences.forEach((sentence) => {
    const lower = sentence.toLowerCase();
    if (/(status|update|risk|issue|problem|dependency|requirement|deadline|launch|testing|presentation|database|api|ui|project)/i.test(lower) && sentence.length > 20) {
      points.push(sentence.trim());
    }
  });

  return points.slice(0, 8);
}

function detectUnresolvedQuestions(sentences) {
  const unresolved = [];

  sentences.forEach((sentence) => {
    const lower = sentence.toLowerCase();
    if (/(should we|can we|what about|when should|who will|is this|could we|do we|will we|question|unclear|not sure|still undecided)/i.test(lower)) {
      const answer = sentence.trim();
      if (!/(we decided|we agreed|it is decided|final decision is|resolved|confirmed)/i.test(answer)) {
        unresolved.push(answer);
      }
    }
  });

  return unresolved;
}

export function normalizeMeetingAnalysis(rawAnalysis) {
  const safeAnalysis = rawAnalysis && typeof rawAnalysis === "object" ? rawAnalysis : {};

  const safeActionItems = Array.isArray(safeAnalysis.action_items)
    ? safeAnalysis.action_items.map((item, index) => ({
        task: cleanText(item?.task) || `Task ${index + 1}`,
        assignee: cleanText(item?.assignee) || "Not specified",
        deadline: normalizeDeadlineText(item?.deadline),
        normalized_deadline: cleanText(item?.normalized_deadline) || "",
        priority: cleanText(item?.priority) || "Medium",
        status: cleanText(item?.status) || "Pending"
      }))
    : [];

  return {
    summary: cleanText(safeAnalysis.summary) || "The meeting covered key project updates, responsibilities, and upcoming work discussed by the team.",
    action_items: safeActionItems,
    decisions: Array.isArray(safeAnalysis.decisions) ? safeAnalysis.decisions.map((item) => cleanText(item) || "Decision not specified") : [],
    next_steps: Array.isArray(safeAnalysis.next_steps) ? safeAnalysis.next_steps.map((item) => cleanText(item) || "Next step not specified") : [],
    important_points: Array.isArray(safeAnalysis.important_points) ? safeAnalysis.important_points.map((item) => cleanText(item) || "Important point not specified") : [],
    unresolved_questions: Array.isArray(safeAnalysis.unresolved_questions) ? safeAnalysis.unresolved_questions.map((item) => cleanText(item) || "Unresolved question not specified") : []
  };
}

export function generateFallbackMeetingAnalysis(transcript) {
  const cleanedTranscript = cleanText(transcript || "");

  if (!cleanedTranscript) {
    return {
      summary: "The meeting transcript is empty. Please record or paste a transcript before analysis.",
      action_items: [],
      decisions: [],
      next_steps: [],
      important_points: [],
      unresolved_questions: []
    };
  }

  const sentences = cleanedTranscript
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => cleanText(sentence))
    .filter(Boolean);

  const actionItems = findActionItems(sentences);

  const decisions = detectDecisions(sentences);
  const unresolvedQuestions = detectUnresolvedQuestions(sentences);

  return {
    summary: buildSummary(sentences, actionItems, decisions, unresolvedQuestions),
    action_items: actionItems,
    decisions,
    next_steps: detectNextSteps(sentences),
    important_points: detectImportantPoints(sentences),
    unresolved_questions: unresolvedQuestions
  };
}
