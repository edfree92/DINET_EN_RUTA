function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAdventureKey(value) {
  const v = normalizeText(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();

  if (v === "PICKING_ALTURA" || v === "ALTURA" || v === "PA") return "PICKING_ALTURA";
  if (v === "PICKING_PRIMER_NIVEL" || v === "PRIMER_NIVEL" || v === "PN") return "PICKING_PRIMER_NIVEL";

  return v;
}

function generateId(prefix = "ID") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function detectDelimiter(headerLine) {
  const delimiters = [",", ";", "\t"];
  let best = ",";
  let bestCount = -1;
  delimiters.forEach(delimiter => {
    const count = csvSplitLine(headerLine, delimiter).length;
    if (count > bestCount) {
      bestCount = count;
      best = delimiter;
    }
  });
  return best;
}

function csvSplitLine(line, delimiter = ",") {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function stripOuterQuotes(value) {
  return String(value || "").replace(/^"+|"+$/g, "").trim();
}

function parseCSV(text) {
  const clean = text.replace(/^\uFEFF/, "").trim();
  const lines = clean.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = csvSplitLine(lines[0], delimiter).map(h => stripOuterQuotes(h));

  return lines.slice(1).map(line => {
    let values = csvSplitLine(line, delimiter);

    if (values.length === 1 && headers.length > 1 && values[0].includes(delimiter)) {
      values = csvSplitLine(values[0], delimiter);
    }

    const row = {};
    headers.forEach((h, i) => {
      row[h] = stripOuterQuotes(values[i] || "");
    });
    return row;
  });
}

function cleanQuestionRow(row) {
  return {
    id: stripOuterQuotes(row.ID_PREGUNTA),
    adventureKey: normalizeAdventureKey(row.AVENTURA),
    text: stripOuterQuotes(row.PREGUNTA),
    options: [
      { id: "A", text: stripOuterQuotes(row.OPCION_A) },
      { id: "B", text: stripOuterQuotes(row.OPCION_B) },
      { id: "C", text: stripOuterQuotes(row.OPCION_C) },
      { id: "D", text: stripOuterQuotes(row.OPCION_D) }
    ],
    correct: stripOuterQuotes(row.CORRECTA).toUpperCase(),
    explanation: stripOuterQuotes(row.EXPLICACION || ""),
    competency: stripOuterQuotes(row.COMPETENCIA || ""),
    competencyCode: stripOuterQuotes(row.COD_COMPETENCIA || ""),
    subprocess: stripOuterQuotes(row.SUBPROCESO || ""),
    subprocessCode: stripOuterQuotes(row.COD_SUBPROCESO || "")
  };
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickRandomQuestions(adventureKey) {
  const normalizedKey = normalizeAdventureKey(adventureKey);
  const pool = appState.questions.filter(q => q.adventureKey === normalizedKey);

  if (pool.length < APP_CONFIG.QUIZ.QUESTIONS_PER_ATTEMPT) {
    const resumen = appState.questions.reduce((acc, q) => {
      acc[q.adventureKey] = (acc[q.adventureKey] || 0) + 1;
      return acc;
    }, {});

    console.error("Preguntas cargadas por aventura:", resumen);
    console.table(appState.questions.map(q => ({
      id: q.id,
      aventura: q.adventureKey,
      pregunta: q.text
    })));

    throw new Error(
      `No hay suficientes preguntas para ${normalizedKey}. Encontradas: ${pool.length}. ` +
      `Cargadas: ${JSON.stringify(resumen)}`
    );
  }

  return shuffleArray(pool).slice(0, APP_CONFIG.QUIZ.QUESTIONS_PER_ATTEMPT);
}

function startQuiz(adventureKey) {
  appState.quiz = {
    active: true,
    attemptId: generateId("INTENTO"),
    questions: pickRandomQuestions(adventureKey),
    currentIndex: 0,
    answers: [],
    score: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    savedInSession: false,
    sentToBackend: false
  };
}

function registerAnswer(question, selectedOptionId) {
  const isCorrect = selectedOptionId === question.correct;
  const points = isCorrect ? APP_CONFIG.QUIZ.SCORE_PER_CORRECT : 0;

  const selected = question.options.find(o => o.id === selectedOptionId);
  const correct = question.options.find(o => o.id === question.correct);

  const answer = {
    questionId: question.id,
    questionText: question.text,
    selectedOption: selectedOptionId,
    selectedText: selected ? selected.text : "",
    correctOption: question.correct,
    correctText: correct ? correct.text : "",
    isCorrect,
    points,
    competency: question.competency,
    competencyCode: question.competencyCode,
    subprocess: question.subprocess,
    subprocessCode: question.subprocessCode,
    timestamp: new Date().toISOString()
  };

  appState.quiz.answers.push(answer);
  appState.quiz.score += points;

  return answer;
}

function calculateGradeFromCorrect(correctCount) {
  return correctCount * 4;
}

function calculateGrade() {
  return calculateGradeFromCorrect(appState.quiz.score);
}

function getResultLevel(grade) {
  if (grade <= 4) return "Requiere reforzamiento";
  if (grade === 8) return "En proceso de aprendizaje";
  if (grade === 12) return "Competencia básica alcanzada";
  if (grade === 16) return "Buen dominio del proceso";
  return "Dominio destacado";
}

function getCurrentAdventureLabel() {
  return appState.adventures[appState.currentAdventureKey]?.label || appState.currentAdventureKey || "";
}

function getCurrentResultSummary() {
  const correctCount = appState.quiz.score;
  const grade = calculateGradeFromCorrect(correctCount);
  return {
    attemptId: appState.quiz.attemptId,
    adventureKey: appState.currentAdventureKey,
    adventureLabel: getCurrentAdventureLabel(),
    correctCount,
    grade,
    level: getResultLevel(grade),
    startedAt: appState.quiz.startedAt,
    finishedAt: appState.quiz.finishedAt || new Date().toISOString()
  };
}

function commitCurrentResultToSession() {
  if (appState.quiz.savedInSession) return;

  const summary = getCurrentResultSummary();
  appState.sessionResults.push(summary);
  appState.quiz.savedInSession = true;
}

function getSessionTotals() {
  const adventuresPlayed = appState.sessionResults.length;
  const totalCorrect = appState.sessionResults.reduce((sum, r) => sum + r.correctCount, 0);
  const totalQuestions = adventuresPlayed * APP_CONFIG.QUIZ.QUESTIONS_PER_ATTEMPT;
  const totalGrade = appState.sessionResults.reduce((sum, r) => sum + r.grade, 0);
  const maxGrade = adventuresPlayed * APP_CONFIG.QUIZ.MAX_GRADE;

  return {
    adventuresPlayed,
    totalCorrect,
    totalQuestions,
    totalGrade,
    maxGrade
  };
}

function resetSessionForNewUser() {
  appState.selectedUser = null;
  appState.currentAdventureKey = null;
  appState.currentSceneIndex = 0;
  appState.sessionResults = [];
  appState.quiz = {
    active: false,
    attemptId: null,
    questions: [],
    currentIndex: 0,
    answers: [],
    score: 0,
    startedAt: null,
    finishedAt: null,
    savedInSession: false,
    sentToBackend: false
  };
}

function buildResultPayload() {
  const now = new Date().toISOString();
  appState.quiz.finishedAt = appState.quiz.finishedAt || now;

  const correctCount = appState.quiz.score;
  const grade = calculateGrade();
  const p = [0, 1, 2, 3, 4].map(i => appState.quiz.answers[i]?.points ?? "");

  const sessionTotals = getSessionTotals();

  return {
    type: "guardar_resultado",
    resultado: {
      fecha: now,
      id_usuario: appState.selectedUser?.id_usuario || "",
      nombre_completo: appState.selectedUser?.nombre_completo || "",
      aventura: appState.currentAdventureKey || "",
      aventura_nombre: getCurrentAdventureLabel(),
      p1: p[0],
      p2: p[1],
      p3: p[2],
      p4: p[3],
      p5: p[4],
      respuestas_correctas: correctCount,
      nota_0_20: grade,
      nivel: getResultLevel(grade),
      aventuras_jugadas_sesion: sessionTotals.adventuresPlayed,
      correctas_acumuladas_sesion: sessionTotals.totalCorrect,
      preguntas_acumuladas_sesion: sessionTotals.totalQuestions,
      nota_acumulada_sesion: sessionTotals.totalGrade,
      nota_maxima_acumulada_sesion: sessionTotals.maxGrade
    },
    detalle: appState.quiz.answers.map((a, idx) => ({
      numero_pregunta: idx + 1,
      ...a
    }))
  };
}
