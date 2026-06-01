const appState = {
  users: [],
  questions: [],
  adventures: {},

  selectedUser: null,
  currentAdventureKey: null,
  currentSceneIndex: 0,

  // Guarda los resultados de todas las aventuras jugadas durante la misma sesión.
  sessionResults: [],

  quiz: {
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
  },

  currentScreen: "START"
};
