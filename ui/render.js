const sceneImage = () => document.getElementById("sceneImage");
const bottomBar = () => document.getElementById("bottomBar");

async function initApp() {
  appState.adventures = window.ADVENTURE_DATA || {};

  await loadUsers();
  await loadQuestions();

  renderStart();
  startIntroAudioFromLoad();
}

async function fetchFirstAvailable(paths) {
  const errors = [];
  for (const path of paths) {
    try {
      const url = `${path}?v=${Date.now()}`;
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return await response.text();
      errors.push(`${path}: HTTP ${response.status}`);
    } catch (error) {
      errors.push(`${path}: ${error.message}`);
    }
  }
  throw new Error(errors.join(" | "));
}

async function loadUsers() {
  try {
    const response = await fetch(`${APP_CONFIG.PATHS.USERS_JSON}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    appState.users = await response.json();
    console.log("Usuarios cargados:", appState.users.length);
  } catch (error) {
    console.warn("No se pudo cargar usuarios.json. Se usará lista vacía.", error);
    appState.users = [];
  }
}

async function loadQuestions() {
  try {
    const text = await fetchFirstAvailable([
      "./data/BANCO_PREGUNTAS.csv",
      "./data/banco_preguntas.csv",
      "./data/BANCO_PREGUNTAS_LIMPIO.csv"
    ]);

    const parsed = parseCSV(text);
    appState.questions = parsed
      .map(cleanQuestionRow)
      .filter(q => q.id && q.adventureKey && q.text && q.correct);

    const resumen = appState.questions.reduce((acc, q) => {
      acc[q.adventureKey] = (acc[q.adventureKey] || 0) + 1;
      return acc;
    }, {});

    console.log("Preguntas cargadas:", appState.questions.length, resumen);
    console.table(appState.questions.map(q => ({ id: q.id, aventura: q.adventureKey })));
  } catch (error) {
    console.error("No se pudo cargar BANCO_PREGUNTAS.csv:", error);
    appState.questions = [];
    alert("No se pudo cargar el banco de preguntas. Revisa que el archivo esté en data/BANCO_PREGUNTAS.csv");
  }
}

function setSceneImage(src) {
  sceneImage().style.opacity = "0";
  setTimeout(() => {
    sceneImage().src = src;
    sceneImage().onload = () => { sceneImage().style.opacity = "1"; };
  }, 120);
}

function setButtons(buttons) {
  bottomBar().innerHTML = "";
  buttons.forEach(btn => {
    const el = document.createElement("button");
    el.textContent = btn.text;
    el.className = btn.className || "";
    el.disabled = !!btn.disabled;
    el.addEventListener("click", btn.onClick);
    bottomBar().appendChild(el);
  });
}

function renderAudioControl() {
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "8px";
  wrapper.style.background = "rgba(15,23,42,.82)";
  wrapper.style.border = "1px solid rgba(255,255,255,.18)";
  wrapper.style.borderRadius = "14px";
  wrapper.style.padding = "10px 12px";
  wrapper.style.color = "white";
  wrapper.style.fontWeight = "800";

  wrapper.innerHTML = `
    <span>🔊</span>
    <input id="volumeControl" type="range" min="0" max="100" value="35" style="width:130px;">
  `;

  const slider = wrapper.querySelector("#volumeControl");
  slider.addEventListener("input", () => {
    const audio = document.getElementById("introAudio");
    audio.volume = Number(slider.value) / 100;
    ensureIntroAudioPlaying();
  });

  bottomBar().appendChild(wrapper);
}

function hideAllPanels() {
  document.getElementById("startPanel").classList.add("hidden");
  document.getElementById("quizPanel").classList.add("hidden");
  document.getElementById("feedbackPanel").classList.add("hidden");
  document.getElementById("finalPanel").classList.add("hidden");
}

function renderStart() {
  resetSessionForNewUser();
  appState.currentScreen = "START";
  hideAllPanels();
  setSceneImage("./BASE/V1.jpg");

  setButtons([
    { text: "INICIO", className: "success", onClick: openStartRegister }
  ]);

  renderAudioControl();
}

function startIntroAudioFromLoad() {
  const audio = document.getElementById("introAudio");
  if (!audio) return;

  audio.volume = 0.35;
  audio.loop = true;

  audio.play().catch(() => {
    console.warn("El navegador bloqueó autoplay. Se activará con el primer toque del usuario.");

    const unlock = () => {
      ensureIntroAudioPlaying();
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };

    document.addEventListener("click", unlock, { once: true });
    document.addEventListener("touchstart", unlock, { once: true });
  });
}

function ensureIntroAudioPlaying() {
  const audio = document.getElementById("introAudio");
  if (!audio) return;

  if (audio.paused) {
    audio.play().catch(err => console.warn("Audio bloqueado por navegador:", err));
  }
}

function openStartRegister() {
  ensureIntroAudioPlaying();
  document.getElementById("startPanel").classList.remove("hidden");
  setupUserSearch();
  setButtons([]);
  renderAudioControl();
}

function stopIntroAudio() {
  const audio = document.getElementById("introAudio");
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}

function renderMap() {
  // La música NO se detiene aquí. Debe continuar desde V1 hasta que el jugador elija aventura.
  ensureIntroAudioPlaying();

  appState.currentScreen = "MAP";
  hideAllPanels();
  setSceneImage("./BASE/V2.jpg");

  const adventureButtons = Object.values(appState.adventures)
    .filter(a => a.ready)
    .map(a => ({
      text: a.label,
      className: "success",
      onClick: () => startAdventure(a.key)
    }));

  setButtons([
    ...adventureButtons,
    { text: "🔒 PICKING ELECTRO MENOR", className: "secondary", disabled: true },
    { text: "🔒 ALMACENAMIENTO", className: "secondary", disabled: true },
    { text: "🔒 RASTRERO ELECTRO", className: "secondary", disabled: true },
    { text: "🔒 OPERACIONES ESPECIALES", className: "secondary", disabled: true }
  ]);

  renderAudioControl();
}

function startAdventure(key) {
  // La música se detiene recién cuando el jugador escoge una aventura.
  stopIntroAudio();

  appState.currentAdventureKey = key;
  appState.currentSceneIndex = 0;
  renderAdventureScene();
}

function renderAdventureScene() {
  hideAllPanels();

  const adv = appState.adventures[appState.currentAdventureKey];
  const scene = adv.scenes[appState.currentSceneIndex];

  setSceneImage(scene.bg);

  const isFirst = appState.currentSceneIndex === 0;
  const isLast = appState.currentSceneIndex === adv.scenes.length - 1;

  if (isLast) {
    setButtons([
      { text: "RESOLVER CUESTIONARIO", className: "success", onClick: openQuiz },
      { text: "CAMBIAR AVENTURA", className: "secondary", onClick: renderMap }
    ]);
    return;
  }

  setButtons([
    {
      text: "ATRÁS",
      className: "secondary",
      onClick: () => {
        if (isFirst) renderMap();
        else {
          appState.currentSceneIndex--;
          renderAdventureScene();
        }
      }
    },
    {
      text: "SIGUIENTE",
      className: "success",
      onClick: () => {
        appState.currentSceneIndex++;
        renderAdventureScene();
      }
    }
  ]);
}

function renderFinal() {
  hideAllPanels();
  setSceneImage("./BASE/V20.jpg");

  commitCurrentResultToSession();
  autoSaveCurrentResult();

  setButtons([
    { text: "VER RESULTADOS", className: "warning", onClick: openFinalResults },
    { text: "NUEVA AVENTURA", className: "secondary", onClick: renderMap },
    { text: "FINALIZAR", className: "success", onClick: renderStart }
  ]);
}

async function autoSaveCurrentResult() {
  if (appState.quiz.sentToBackend) return;

  const payload = buildResultPayload();
  const result = await sendResultToBackend(payload);

  appState.quiz.sentToBackend = true;
  console.log("Resultado guardado automáticamente:", result);
}

function openFinalResults() {
  hideAllPanels();

  const current = getCurrentResultSummary();
  const totals = getSessionTotals();

  const panel = document.getElementById("finalPanel");
  panel.innerHTML = `
    <h1>🏆 RESULTADOS FINALES</h1>

    <h2>Resultado de esta aventura</h2>
    <div class="result-line"><strong>Nombre:</strong> ${appState.selectedUser?.nombre_completo || ""}</div>
    <div class="result-line"><strong>Aventura:</strong> ${current.adventureLabel}</div>
    <div class="result-line"><strong>Respuestas correctas:</strong> ${current.correctCount} de 5</div>
    <div class="result-line"><strong>Nota:</strong> <span class="yellow">${current.grade} / 20</span></div>
    <div class="result-line"><strong>Nivel:</strong> ${current.level}</div>

    <hr>

    <h2>Acumulado de la sesión</h2>
    <div class="result-line"><strong>Aventuras jugadas:</strong> ${totals.adventuresPlayed}</div>
    <div class="result-line"><strong>Correctas acumuladas:</strong> ${totals.totalCorrect} de ${totals.totalQuestions}</div>
    <div class="result-line"><strong>Nota acumulada:</strong> <span class="yellow">${totals.totalGrade} / ${totals.maxGrade}</span></div>

    <hr>

    <button class="secondary" onclick="closeFinalResults()">CERRAR</button>
  `;
  panel.classList.remove("hidden");
}

function closeFinalResults() {
  document.getElementById("finalPanel").classList.add("hidden");
}
