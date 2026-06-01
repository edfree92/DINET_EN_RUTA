const APP_CONFIG = {
  MOCK_MODE: false,
  NON_BLOCKING: true,
  ENDPOINT: "https://script.google.com/macros/s/AKfycbxbjRosDsw1MeSitAqeU8RxWz54ewDdjhYi_DDczpJDivpKdJYfcpVDjclnq-7Mekch/exec",
  PATHS: {
    BASE: "./BASE/",
    DATA: "./data/",
    QUESTIONS_CSV: "./data/BANCO_PREGUNTAS.csv",
    USERS_JSON: "./data/usuarios.json"
  },
  QUIZ: { QUESTIONS_PER_ATTEMPT: 5, SCORE_PER_CORRECT: 1, MAX_GRADE: 20 }
};
