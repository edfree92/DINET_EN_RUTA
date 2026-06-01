const sceneImage = () => document.getElementById("sceneImage");
const bottomBar = () => document.getElementById("bottomBar");

async function initApp() {
  appState.adventures = window.ADVENTURE_DATA || {};

  await loadUsers();
  await loadQuestions();

  renderStart();
}

async function loadUsers() {
  try {
    const response = await fetch(APP_CONFIG.PATHS.USERS_JSON);
    appState.users = await response.json();
    console.log("Usuarios cargados:", appState.users.length);
  } catch (error) {
    console.warn("No se pudo cargar usuarios.json. Se usará lista vacía.", error);
    appState.users = [];
  }
}

async function loadQuestions() {
  const response = await fetch(APP_CONFIG.PATHS.QUESTIONS_CSV);
  const text = await response.text();
  appState.questions = parseCSV(text).map(cleanQuestionRow).filter(q => q.id && q.adventureKey && q.text);
  console.log("Preguntas cargadas:", appState.questions.length);
  console.table(appState.questions.map(q => ({ id: q.id, aventura: q.adventureKey })));
}

function setSceneImage(src) {
  sceneImage().style.opacity = "0";
  setTimeout(() => {
    sceneImage().src = src;
    sceneImage().onload = () => {
      sceneImage().style.opacity = "1";
    };
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
    if (audio.paused) {
      audio.play().catch(err => console.warn("Audio bloqueado por navegador:", err));
    }
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
  appState.currentScreen = "START";
  hideAllPanels();
  setSceneImage("./BASE/V1.jpg");

  setButtons([
    { text: "INICIO", className: "success", onClick: openStartRegister }
  ]);

  renderAudioControl();
}

function openStartRegister() {
  playIntroAudio();
  document.getElementById("startPanel").classList.remove("hidden");
  setupUserSearch();
  setButtons([]);
  renderAudioControl();
}

function playIntroAudio() {
  const audio = document.getElementById("introAudio");
  audio.volume = 0.35;
  audio.play().catch(err => console.warn("Audio bloqueado por navegador:", err));
}

function stopIntroAudio() {
  const audio = document.getElementById("introAudio");
  audio.pause();
  audio.currentTime = 0;
}

function renderMap() {
  stopIntroAudio();
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
    { text: "PICKING ELECTRO MENOR", className: "secondary", disabled: true },
    { text: "ALMACENAMIENTO", className: "secondary", disabled: true }
  ]);
}

function startAdventure(key) {
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

  const grade = calculateGrade();
  const level = getResultLevel(grade);

  const panel = document.getElementById("finalPanel");
  panel.innerHTML = `
    <h1>🏆 RESULTADOS FINALES</h1>
    <div class="result-line"><strong>Nombre:</strong> ${appState.selectedUser?.nombre_completo || ""}</div>
    <div class="result-line"><strong>Aventura:</strong> ${appState.adventures[appState.currentAdventureKey]?.label || appState.currentAdventureKey}</div>
    <div class="result-line"><strong>Respuestas correctas:</strong> ${appState.quiz.score} de 5</div>
    <div class="result-line"><strong>Nota:</strong> <span class="yellow">${grade} / 20</span></div>
    <div class="result-line"><strong>Nivel:</strong> ${level}</div>
    <hr>
    <button class="success" onclick="sendAndFinish()">GUARDAR RESULTADO</button>
  `;
  panel.classList.remove("hidden");

  setButtons([
    { text: "NUEVA AVENTURA", className: "secondary", onClick: renderMap },
    { text: "FINALIZAR", className: "success", onClick: renderStart }
  ]);
}

async function sendAndFinish() {
  const payload = buildResultPayload();
  const result = await sendResultToBackend(payload);
  alert(result.status === "mock" ? "Resultado simulado en consola." : "Resultado enviado.");
}
