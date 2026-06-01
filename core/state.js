const appState = {
  users: [], questions: [], adventures: {}, selectedUser: null,
  currentAdventureKey: null, currentSceneIndex: 0,
  quiz: { active:false, questions:[], currentIndex:0, answers:[], score:0, startedAt:null, finishedAt:null },
  currentScreen: "START"
};
