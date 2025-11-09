const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const orientationLock = document.getElementById("orientation-lock");
const hud = document.getElementById("hud");
const hudScore = document.getElementById("hud-score");
const hudLives = document.getElementById("hud-lives");
const hudObjectives = document.getElementById("hud-objectives");
const hudOptionsButton = document.getElementById("hud-options");

const mainMenu = document.getElementById("main-menu");
const levelSelect = document.getElementById("level-select");
const statsOverlay = document.getElementById("stats");
const optionsOverlay = document.getElementById("options");
const messageOverlay = document.getElementById("message");
const messageTitle = document.getElementById("message-title");
const messageBody = document.getElementById("message-body");
const victoryCountdown = document.getElementById("victory-countdown");
const countdownValue = document.getElementById("countdown-value");

const controlsContainer = document.getElementById("controls");
const controlLeft = document.querySelector(".control-left");
const controlRight = document.querySelector(".control-right");
const moveLeftButton = document.getElementById("move-left");
const moveRightButton = document.getElementById("move-right");
const jumpButton = document.getElementById("jump");
const defendButton = document.getElementById("defend");
const interactButton = document.getElementById("interact");
const joystickBase = document.getElementById("joystick");
const joystickHandle = document.getElementById("joystick-handle");

const levelContainer = document.getElementById("levels");
const statsContent = document.getElementById("stats-content");

const musicToggle = document.getElementById("music-toggle");
const buttonSizeRange = document.getElementById("button-size");
const joystickSensitivityRange = document.getElementById("joystick-sensitivity");
const leftyToggle = document.getElementById("lefty-mode");
const controlSchemeSelect = document.getElementById("control-scheme");

const menuButtons = document.querySelectorAll("[data-action]");

const STORAGE_KEY = "patrouille_nuit_save";

const clone = (value) => (typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)));

const saveDefaults = {
  preferences: {
    music: true,
    buttonSize: 1,
    joystickSensitivity: 1,
    lefty: false,
    controlScheme: "arrows",
  },
  progress: {
    unlockedLevels: 1,
    bestScores: [0, 0, 0, 0],
    assistedCounts: [0, 0, 0, 0],
  },
  lastLevel: 0,
};

let save = loadSave();

const LEVELS = [
  {
    id: 0,
    name: "Centre-ville",
    description: "Patrouille de Nuit",
    biome: "downtown",
    background: ["#041024", "#071b33"],
    civilians: 3,
    difficulty: "Très accessible",
    baseScore: 220,
  },
  {
    id: 1,
    name: "Docks",
    description: "Reflets nocturnes",
    biome: "docks",
    background: ["#041324", "#0c2a3d"],
    civilians: 4,
    difficulty: "Modéré",
    baseScore: 300,
  },
  {
    id: 2,
    name: "Banlieue",
    description: "Résidentielle apaisée",
    biome: "suburb",
    background: ["#031124", "#0c2238"],
    civilians: 5,
    difficulty: "Soutenu",
    baseScore: 360,
  },
  {
    id: 3,
    name: "Zone industrielle",
    description: "Veille attentive",
    biome: "industrial",
    background: ["#020f22", "#162d3f"],
    civilians: 6,
    difficulty: "Patrouille exigeante",
    baseScore: 420,
  },
];

const GAME_STATES = {
  MENU: "menu",
  LEVEL: "level",
  MESSAGE: "message",
};

const PLAYER_COLORS = {
  base: "#5cc4ff",
  invulnerable: "#f5c543",
};

let audioCtx = null;
let ambientLoop = null;
let musicEnabled = save.preferences.music;
const MUSIC_VOLUME = {
  normal: 0.08,
  low: 0.03,
};

let pausedForOptions = false;

let currentState = GAME_STATES.MENU;
let currentLevel = null;
let levelData = null;
let lastTime = 0;
let rafId = 0;
let victoryTimer = null;

const inputState = {
  left: false,
  right: false,
  jump: false,
  interact: false,
  defend: false,
  joystickActive: false,
  joystickVector: { x: 0, y: 0 },
};

const player = {
  x: 120,
  y: 420,
  width: 40,
  height: 64,
  vx: 0,
  vy: 0,
  speed: 210,
  jumpStrength: 420,
  onGround: false,
  lives: 3,
  score: 0,
  assisted: 0,
  invulnerableTimer: 0,
  shieldTimer: 0,
  facing: 1,
};

const projectiles = [];

const gravity = 980;
const friction = 0.86;

function loadSave() {
  if (typeof localStorage === "undefined") {
    return clone(saveDefaults);
  }
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!data) return clone(saveDefaults);
    return {
      preferences: { ...saveDefaults.preferences, ...data.preferences },
      progress: {
        unlockedLevels: Math.max(1, data.progress?.unlockedLevels ?? 1),
        bestScores: data.progress?.bestScores ?? saveDefaults.progress.bestScores,
        assistedCounts: data.progress?.assistedCounts ?? saveDefaults.progress.assistedCounts,
      },
      lastLevel: data.lastLevel ?? 0,
    };
  } catch (error) {
    console.warn("Impossible de charger la sauvegarde", error);
    return clone(saveDefaults);
  }
}

function saveData() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch (error) {
    console.warn("Impossible d'enregistrer la sauvegarde", error);
  }
}

function setupPreferences() {
  musicToggle.checked = save.preferences.music;
  buttonSizeRange.value = save.preferences.buttonSize;
  joystickSensitivityRange.value = save.preferences.joystickSensitivity;
  leftyToggle.checked = save.preferences.lefty;
  controlSchemeSelect.value = save.preferences.controlScheme;
  const inLevel = currentState === GAME_STATES.LEVEL;
  const restartBtn = optionsOverlay.querySelector('[data-action="restart-level"]');
  const quitBtn = optionsOverlay.querySelector('[data-action="quit-level"]');
  if (restartBtn) restartBtn.disabled = !inLevel;
  if (quitBtn) quitBtn.disabled = !inLevel;
  updateControlLayout();
  applyButtonSize(save.preferences.buttonSize);
}

function applyButtonSize(scale) {
  document.documentElement.style.setProperty("--control-scale", scale);
  document.querySelectorAll(".control-button, .joystick").forEach((btn) => {
    btn.style.transform = `scale(${scale})`;
  });
}

function updateControlLayout() {
  const lefty = save.preferences.lefty;
  const scheme = save.preferences.controlScheme;

  moveLeftButton.classList.toggle("hidden", scheme !== "arrows");
  moveRightButton.classList.toggle("hidden", scheme !== "arrows");
  joystickBase.classList.toggle("hidden", scheme !== "joystick");

  if (lefty) {
    controlsContainer.classList.add("lefty");
    if (!controlsContainer.dataset.leftyApplied) {
      controlsContainer.dataset.leftyApplied = "true";
      controlsContainer.appendChild(controlLeft);
      controlsContainer.prepend(controlRight);
    }
  } else {
    controlsContainer.classList.remove("lefty");
    if (controlsContainer.dataset.leftyApplied) {
      delete controlsContainer.dataset.leftyApplied;
      controlsContainer.prepend(controlLeft);
      controlsContainer.appendChild(controlRight);
    }
  }
}

function initLevelSelect() {
  levelContainer.innerHTML = "";
  LEVELS.forEach((level, index) => {
    const card = document.createElement("div");
    card.className = "level-card";
    if (index + 1 > save.progress.unlockedLevels) {
      card.classList.add("locked");
    }

    const stars = Math.min(3, Math.floor((save.progress.bestScores[index] / level.baseScore) * 3));
    const starIcons = Array.from({ length: 3 }, (_, i) => (i < stars ? "⭐" : "☆")).join(" ");

    card.innerHTML = `
      <h3>${level.name}</h3>
      <p>${level.description}</p>
      <div class="badge">${level.difficulty}</div>
      <p>Civils : ${level.civilians}</p>
      <p>Score max de référence : ${level.baseScore}</p>
      <p>Meilleur score : ${save.progress.bestScores[index] || 0}</p>
      <p>Étoiles : ${starIcons}</p>
      <button ${index + 1 > save.progress.unlockedLevels ? "disabled" : ""} data-level="${index}">Lancer</button>
    `;

    card.querySelector("button").addEventListener("click", () => {
      startLevel(index);
      closeAllOverlays();
    });

    levelContainer.appendChild(card);
  });
}

function initStats() {
  statsContent.innerHTML = LEVELS.map((level, index) => {
    const bestScore = save.progress.bestScores[index];
    const assisted = save.progress.assistedCounts[index];
    return `
      <div class="level-card">
        <h3>${level.name}</h3>
        <p>Meilleur score : ${bestScore}</p>
        <p>Civils aidés (meilleur run) : ${assisted}/${level.civilians}</p>
      </div>
    `;
  }).join("");
}

function closeAllOverlays() {
  [mainMenu, levelSelect, statsOverlay, optionsOverlay, messageOverlay].forEach((overlay) => {
    overlay.classList.add("hidden");
    overlay.classList.remove("visible");
  });
}

function showOverlay(element) {
  closeAllOverlays();
  element.classList.remove("hidden");
  element.classList.add("visible");
}

function showHUD(show) {
  if (show) {
    hud.classList.remove("hidden");
    controlsContainer.classList.remove("hidden");
  } else {
    hud.classList.add("hidden");
    controlsContainer.classList.add("hidden");
  }
}

function resetPlayer() {
  player.x = 120;
  player.y = 420;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.lives = 3;
  player.score = 0;
  player.assisted = 0;
  player.invulnerableTimer = 0;
  player.shieldTimer = 0;
}

function createLevelData(level) {
  const width = 4200;
  const civilians = [];
  const enemies = [];
  const pickups = [];
  const hazards = [];

  const biomeColors = {
    downtown: ["#08213e", "#0c2f51", "#133b6d"],
    docks: ["#051e33", "#0b3049", "#16445f"],
    suburb: ["#052138", "#0a314a", "#15405a"],
    industrial: ["#041c32", "#0a2a3f", "#13354f"],
  };

  const spawnCivilian = (x, y) => {
    civilians.push({ x, y, width: 36, height: 60, helped: false, prompt: "Aider" });
  };

  const spawnEnemy = (x, y, range = 120, speed = 40) => {
    enemies.push({
      x,
      y,
      width: 36,
      height: 54,
      vx: speed,
      range,
      originX: x,
      direction: 1,
      patrolMin: x - range / 2,
      patrolMax: x + range / 2,
    });
  };

  const spawnPickup = (x, y, type) => {
    pickups.push({ x, y, width: 32, height: 32, type, active: true, timer: 0 });
  };

  const spawnHazard = (x, y, width, height) => {
    hazards.push({ x, y, width, height });
  };

  const segments = [
    { start: 0, end: 900, type: "calm" },
    { start: 900, end: 1800, type: "obstacles" },
    { start: 1800, end: 3200, type: "core" },
    { start: 3200, end: width, type: "calm" },
  ];

  segments.forEach((segment) => {
    if (segment.type === "calm") {
      spawnCivilian(segment.start + 200, 420);
    }
    if (segment.type === "obstacles") {
      spawnHazard(segment.start + 160, 460, 140, 30);
      spawnEnemy(segment.start + 360, 432, 180, 50);
      spawnPickup(segment.start + 520, 400, "score");
    }
    if (segment.type === "core") {
      spawnEnemy(segment.start + 120, 432, 220, 60);
      spawnEnemy(segment.start + 420, 432, 200, 50);
      spawnCivilian(segment.start + 240, 420);
      spawnPickup(segment.start + 300, 392, "shield");
      spawnPickup(segment.start + 540, 404, "score");
      spawnPickup(segment.start + 720, 404, "medkit");
    }
  });

  while (civilians.length < level.civilians) {
    spawnCivilian(400 + civilians.length * 520, 420);
  }

  const scoreOrbs = level.baseScore / 10;
  for (let i = 0; i < scoreOrbs; i += 1) {
    const x = 300 + i * 80 + (i % 3 === 0 ? 120 : 0);
    if (x < width - 200) {
      spawnPickup(x, 380 - (i % 2) * 40, "score");
    }
  }

  const commissariat = {
    x: width - 220,
    y: 400,
    width: 140,
    height: 140,
  };

  return {
    width,
    ground: 480,
    background: biomeColors[level.biome],
    civilians,
    enemies,
    pickups,
    hazards,
    commissariat,
    level,
  };
}

function startLevel(levelIndex) {
  currentState = GAME_STATES.LEVEL;
  currentLevel = LEVELS[levelIndex];
  levelData = createLevelData(currentLevel);
  resetPlayer();
  projectiles.length = 0;
  pausedForOptions = false;
  save.lastLevel = levelIndex;
  saveData();
  showHUD(true);
  closeAllOverlays();
  updateHUD();
  controlsContainer.classList.remove("hidden");
  startMusic();
  orientationCheck();
}

function endLevel(success, reason) {
  currentState = GAME_STATES.MESSAGE;
  showHUD(false);
  showOverlay(messageOverlay);
  messageTitle.textContent = success ? "Mission accomplie" : "Mission interrompue";
  messageBody.textContent = reason;
  if (success) {
    victoryCountdown.classList.remove("hidden");
    let remaining = 6;
    countdownValue.textContent = remaining;
    victoryTimer = setInterval(() => {
      remaining -= 1;
      countdownValue.textContent = remaining;
      if (remaining <= 0) {
        clearInterval(victoryTimer);
        victoryTimer = null;
        const nextLevel = Math.min(LEVELS.length - 1, currentLevel.id + 1);
        if (currentLevel.id < LEVELS.length - 1) {
          startLevel(nextLevel);
        } else {
          showMainMenu();
        }
      }
    }, 1000);
  } else {
    victoryCountdown.classList.add("hidden");
    if (victoryTimer) {
      clearInterval(victoryTimer);
      victoryTimer = null;
    }
  }
  stopMusic(true);
}

function showMainMenu() {
  currentState = GAME_STATES.MENU;
  showHUD(false);
  showOverlay(mainMenu);
  stopMusic(true);
  pausedForOptions = false;
  if (victoryTimer) {
    clearInterval(victoryTimer);
    victoryTimer = null;
  }
  initLevelSelect();
  initStats();
}

function updateHUD() {
  hudScore.textContent = `Score : ${Math.round(player.score)}`;
  hudLives.textContent = `❤️ ×${player.lives}`;
  hudObjectives.textContent = `Civils : ${player.assisted}/${levelData?.civilians.length ?? 0}`;
}

function checkVictoryConditions() {
  if (!levelData) return;
  const scoreThreshold = currentLevel.baseScore * 0.6;
  const allCiviliansHelped = levelData.civilians.every((civ) => civ.helped);
  const hasLives = player.lives > 0;
  const hasScore = player.score >= scoreThreshold;

  if (allCiviliansHelped && hasLives && hasScore) {
    const best = save.progress.bestScores[currentLevel.id];
    if (player.score > best) {
      save.progress.bestScores[currentLevel.id] = Math.round(player.score);
      save.progress.assistedCounts[currentLevel.id] = player.assisted;
    }
    if (save.progress.unlockedLevels < currentLevel.id + 2 && currentLevel.id + 1 < LEVELS.length) {
      save.progress.unlockedLevels = currentLevel.id + 2;
    }
    saveData();
    endLevel(true, "Tous les civils sont en sécurité et les objectifs sont remplis.");
  } else if (!hasLives) {
    endLevel(false, "Plus de vies.");
  }
}

function projectilesUpdate(dt) {
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const proj = projectiles[i];
    proj.x += proj.vx * dt;
    proj.lifetime -= dt;
    if (proj.lifetime <= 0 || proj.x < 0 || proj.x > levelData.width) {
      projectiles.splice(i, 1);
      continue;
    }
    levelData.enemies.forEach((enemy) => {
      if (rectsOverlap(proj, enemy)) {
        enemy.disabled = true;
        enemy.disableTimer = 2;
        projectiles.splice(i, 1);
      }
    });
  }
}

function spawnProjectile() {
  projectiles.push({
    x: player.x + (player.facing > 0 ? player.width : -10),
    y: player.y + player.height / 2,
    width: 12,
    height: 6,
    vx: 420 * player.facing,
    lifetime: 0.9,
  });
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function handlePlayerInput(dt) {
  const scheme = save.preferences.controlScheme;
  let horizontal = 0;
  if (scheme === "arrows") {
    if (inputState.left) horizontal -= 1;
    if (inputState.right) horizontal += 1;
  } else if (scheme === "joystick") {
    horizontal = inputState.joystickVector.x;
  }

  player.vx += horizontal * player.speed * dt * (player.shieldTimer > 0 ? 1.2 : 1);
  if (Math.abs(horizontal) < 0.1) {
    player.vx *= friction;
  }
  if (horizontal !== 0) {
    player.facing = horizontal > 0 ? 1 : -1;
  }

  if ((inputState.jump || inputState.joystickVector.y < -0.5) && player.onGround) {
    player.vy = -player.jumpStrength;
    player.onGround = false;
    inputState.jump = false;
  }

  if (inputState.defend) {
    spawnProjectile();
    inputState.defend = false;
  }
}

function updatePlayer(dt) {
  player.vy += gravity * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  if (player.x < 0) player.x = 0;
  if (player.x + player.width > levelData.width) player.x = levelData.width - player.width;

  if (player.y + player.height >= levelData.ground) {
    player.y = levelData.ground - player.height;
    player.vy = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
  }

  if (player.invulnerableTimer > 0) {
    player.invulnerableTimer -= dt;
  }

  if (player.shieldTimer > 0) {
    player.shieldTimer -= dt;
    if (player.shieldTimer < 0) player.shieldTimer = 0;
  }
}

function updateEnemies(dt) {
  levelData.enemies.forEach((enemy) => {
    if (enemy.disabled) {
      enemy.disableTimer -= dt;
      if (enemy.disableTimer <= 0) {
        enemy.disabled = false;
      }
      return;
    }
    enemy.x += enemy.vx * dt * enemy.direction;
    if (enemy.x < enemy.patrolMin || enemy.x > enemy.patrolMax) {
      enemy.direction *= -1;
      enemy.x = Math.max(enemy.patrolMin, Math.min(enemy.x, enemy.patrolMax));
    }
    if (rectsOverlap(player, enemy) && player.invulnerableTimer <= 0) {
      if (player.shieldTimer > 0) {
        enemy.disabled = true;
        enemy.disableTimer = 2;
      } else {
        player.lives -= 1;
        player.invulnerableTimer = 1;
        if (player.lives <= 0) {
          checkVictoryConditions();
        }
      }
      updateHUD();
    }
  });
}

function updatePickups(dt) {
  levelData.pickups.forEach((pickup) => {
    if (!pickup.active) return;
    pickup.timer += dt;
    if (rectsOverlap(player, pickup)) {
      if (pickup.type === "medkit") {
        if (player.lives < 3) {
          player.lives += 1;
          pickup.active = false;
        }
      } else if (pickup.type === "shield") {
        player.shieldTimer = Math.max(player.shieldTimer, 3);
        pickup.active = false;
      } else if (pickup.type === "score") {
        player.score += 10;
        pickup.active = false;
      }
      updateHUD();
    }
  });
}

function updateCivilians() {
  levelData.civilians.forEach((civ) => {
    if (!civ.helped && rectsOverlap(player, { ...civ, x: civ.x - 10, width: civ.width + 20 })) {
      hudObjectives.dataset.prompt = "Interact";
      if (inputState.interact) {
        civ.helped = true;
        player.assisted += 1;
        player.score += 20;
        inputState.interact = false;
        updateHUD();
      }
    }
  });
}

function updateHazards() {
  levelData.hazards.forEach((hazard) => {
    if (rectsOverlap(player, hazard) && player.invulnerableTimer <= 0) {
      if (player.shieldTimer > 0) {
        player.shieldTimer = 0;
      } else {
        player.lives -= 1;
        player.invulnerableTimer = 1;
        updateHUD();
        if (player.lives <= 0) {
          checkVictoryConditions();
        }
      }
    }
  });
}

function updateCommissariat() {
  if (!levelData) return;
  if (rectsOverlap(player, levelData.commissariat)) {
    const scoreThreshold = currentLevel.baseScore * 0.6;
    const allCivilians = levelData.civilians.every((c) => c.helped);
    if (!allCivilians) {
      endLevel(false, "Objectifs non atteints : tous les civils doivent être aidés.");
      return;
    }
    if (player.score < scoreThreshold) {
      endLevel(false, "Score insuffisant. Explore davantage pour sécuriser la zone.");
      return;
    }
    if (player.lives <= 0) {
      endLevel(false, "Plus de vies.");
      return;
    }
    checkVictoryConditions();
  }
}

function renderBackground(cameraX) {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  const colors = levelData.background;
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.5, colors[1]);
  gradient.addColorStop(1, colors[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(245,197,67,0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, levelData.ground - cameraX * 0.02);
  ctx.lineTo(canvas.width, levelData.ground - cameraX * 0.02);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,230,128,0.15)";
  for (let i = 0; i < 5; i += 1) {
    const x = (i * 200 - (cameraX * 0.6) % 200) - 50;
    ctx.fillRect(x, levelData.ground - 10, 120, 4);
  }
}

function renderPlayer(cameraX) {
  ctx.save();
  ctx.translate(-cameraX, 0);
  ctx.fillStyle = player.invulnerableTimer > 0 ? PLAYER_COLORS.invulnerable : PLAYER_COLORS.base;
  ctx.fillRect(player.x, player.y, player.width, player.height);
  if (player.shieldTimer > 0) {
    ctx.strokeStyle = "rgba(245,197,67,0.8)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(player.x + player.width / 2, player.y + player.height / 2, player.width * 0.7, player.height * 0.8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function renderEntities(cameraX) {
  ctx.save();
  ctx.translate(-cameraX, 0);
  ctx.font = "16px 'Montserrat', 'Segoe UI', sans-serif";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  levelData.civilians.forEach((civ) => {
    ctx.fillStyle = civ.helped ? "rgba(120,210,140,0.9)" : "rgba(90,140,255,0.9)";
    ctx.fillRect(civ.x, civ.y, civ.width, civ.height);
    if (!civ.helped) {
      ctx.fillStyle = "#f5c543";
      ctx.fillText("🤝", civ.x + civ.width / 4, civ.y - 8);
    }
  });

  levelData.enemies.forEach((enemy) => {
    ctx.fillStyle = enemy.disabled ? "rgba(140,140,140,0.6)" : "rgba(200,90,120,0.85)";
    ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
  });

  levelData.pickups.forEach((pickup) => {
    if (!pickup.active) return;
    const pulse = 0.5 + Math.sin(performance.now() / 250) * 0.2;
    ctx.save();
    ctx.translate(pickup.x + pickup.width / 2, pickup.y + pickup.height / 2);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = pickup.type === "score" ? "rgba(245,197,67,0.8)" : pickup.type === "medkit" ? "rgba(180,255,200,0.85)" : "rgba(245,197,67,0.65)";
    ctx.fillRect(-pickup.width / 2, -pickup.height / 2, pickup.width, pickup.height);
    ctx.restore();
  });

  levelData.hazards.forEach((hazard) => {
    ctx.fillStyle = "rgba(255,130,100,0.6)";
    ctx.fillRect(hazard.x, hazard.y, hazard.width, hazard.height);
  });

  ctx.fillStyle = "rgba(245,197,67,0.6)";
  ctx.fillRect(levelData.commissariat.x, levelData.commissariat.y, levelData.commissariat.width, levelData.commissariat.height);
  ctx.fillStyle = "#0b1f34";
  ctx.fillText("Commissariat", levelData.commissariat.x + 6, levelData.commissariat.y + 24);

  projectiles.forEach((proj) => {
    ctx.fillStyle = "rgba(120,200,255,0.9)";
    ctx.fillRect(proj.x, proj.y, proj.width, proj.height);
  });

  ctx.restore();
}

function renderHUDPrompts() {
  if (!levelData) return;
  const scheme = save.preferences.controlScheme;
  const civ = levelData.civilians.find((c) => !c.helped && rectsOverlap(player, { ...c, x: c.x - 10, width: c.width + 20 }));
  if (civ) {
    hudObjectives.textContent = `Civils : ${player.assisted}/${levelData.civilians.length} (🤝)`;
  } else {
    hudObjectives.textContent = `Civils : ${player.assisted}/${levelData.civilians.length}`;
  }
  if (scheme === "joystick") {
    const scale = save.preferences.buttonSize;
    joystickBase.style.transform = `scale(${scale})`;
  }
}

function render(dt) {
  if (!levelData) return;
  const cameraX = Math.max(0, Math.min(player.x - canvas.width / 2 + player.width / 2, levelData.width - canvas.width));

  renderBackground(cameraX);
  renderEntities(cameraX);
  renderPlayer(cameraX);
  renderHUDPrompts();
}

function gameLoop(timestamp) {
  if (currentState !== GAME_STATES.LEVEL) return;
  const dt = Math.min(0.016, (timestamp - lastTime) / 1000);
  lastTime = timestamp;

  handlePlayerInput(dt);
  updatePlayer(dt);
  updateEnemies(dt);
  updatePickups(dt);
  updateHazards();
  updateCivilians();
  updateCommissariat();
  projectilesUpdate(dt);
  render(dt);

  rafId = requestAnimationFrame(gameLoop);
}

function startGameLoop() {
  cancelAnimationFrame(rafId);
  lastTime = performance.now();
  rafId = requestAnimationFrame(gameLoop);
}

function stopGameLoop() {
  cancelAnimationFrame(rafId);
}

function startMusic() {
  if (!musicEnabled) return;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ambientLoop) {
    setMusicVolume(MUSIC_VOLUME.normal);
    return;
  }

  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  gain.gain.value = MUSIC_VOLUME.normal;
  oscillator.type = "sine";
  oscillator.frequency.value = 220;
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start();

  ambientLoop = { oscillator, gain };
}

function stopMusic(fade = false) {
  if (!ambientLoop) return;
  if (fade) {
    ambientLoop.gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
    setTimeout(() => {
      ambientLoop.oscillator.stop();
      ambientLoop = null;
    }, 600);
  } else {
    ambientLoop.oscillator.stop();
    ambientLoop = null;
  }
}

function setMusicVolume(volume) {
  if (!ambientLoop || !audioCtx) return;
  ambientLoop.gain.gain.setTargetAtTime(volume, audioCtx.currentTime, 0.1);
}

function orientationCheck() {
  const isLandscape = window.matchMedia("(orientation: landscape)").matches || window.innerWidth > window.innerHeight;
  if (!isLandscape) {
    orientationLock.classList.remove("hidden");
    stopGameLoop();
    controlsContainer.classList.add("hidden");
  } else {
    orientationLock.classList.add("hidden");
    if (currentState === GAME_STATES.LEVEL && !pausedForOptions) {
      startGameLoop();
      controlsContainer.classList.remove("hidden");
    }
  }
}

function setupInput() {
  const keyMap = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "jump",
    Space: "jump",
    KeyE: "interact",
    KeyQ: "defend",
  };

  window.addEventListener("keydown", (event) => {
    const action = keyMap[event.code];
    if (action) {
      inputState[action] = true;
      event.preventDefault();
    }
  });

  window.addEventListener("keyup", (event) => {
    const action = keyMap[event.code];
    if (action) {
      inputState[action] = false;
      event.preventDefault();
    }
  });

  const bindTouch = (element, action) => {
    const setState = (value) => {
      inputState[action] = value;
    };
    element.addEventListener("touchstart", (event) => {
      event.preventDefault();
      setState(true);
    });
    element.addEventListener("touchend", (event) => {
      event.preventDefault();
      setState(false);
    });
    element.addEventListener("mousedown", (event) => {
      event.preventDefault();
      setState(true);
    });
    element.addEventListener("mouseup", (event) => {
      event.preventDefault();
      setState(false);
    });
    element.addEventListener("mouseleave", () => setState(false));
  };

  bindTouch(moveLeftButton, "left");
  bindTouch(moveRightButton, "right");
  bindTouch(jumpButton, "jump");
  bindTouch(defendButton, "defend");
  bindTouch(interactButton, "interact");

  joystickBase.addEventListener("touchstart", (event) => {
    inputState.joystickActive = true;
    updateJoystick(event.touches[0]);
  });

  joystickBase.addEventListener("touchmove", (event) => {
    if (!inputState.joystickActive) return;
    updateJoystick(event.touches[0]);
  });

  const resetJoystick = () => {
    inputState.joystickActive = false;
    inputState.joystickVector = { x: 0, y: 0 };
    joystickHandle.style.transform = "translate3d(0,0,0)";
  };

  const endJoystick = (event) => {
    if (event) event.preventDefault();
    resetJoystick();
  };

  joystickBase.addEventListener("touchend", endJoystick);
  joystickBase.addEventListener("touchcancel", endJoystick);

  joystickBase.addEventListener("mousedown", (event) => {
    inputState.joystickActive = true;
    updateJoystick(event);
  });

  window.addEventListener("mousemove", (event) => {
    if (!inputState.joystickActive) return;
    updateJoystick(event);
  });

  window.addEventListener("mouseup", resetJoystick);
}

function updateJoystick(point) {
  const rect = joystickBase.getBoundingClientRect();
  const x = point.clientX - (rect.left + rect.width / 2);
  const y = point.clientY - (rect.top + rect.height / 2);
  const radius = rect.width / 2;
  const distance = Math.min(Math.sqrt(x * x + y * y), radius);
  const angle = Math.atan2(y, x);
  const normalizedX = Math.cos(angle) * (distance / radius);
  const normalizedY = Math.sin(angle) * (distance / radius);
  const sensitivity = save.preferences.joystickSensitivity;

  inputState.joystickVector = {
    x: Math.max(-1, Math.min(1, normalizedX * sensitivity)),
    y: Math.max(-1, Math.min(1, normalizedY * sensitivity)),
  };

  joystickHandle.style.transform = `translate3d(${normalizedX * radius * 0.6}px, ${normalizedY * radius * 0.6}px, 0)`;
}

function bindMenus() {
  menuButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      const action = event.currentTarget.dataset.action;
      switch (action) {
        case "play":
          startLevel(save.lastLevel || 0);
          break;
        case "levels":
          initLevelSelect();
          showOverlay(levelSelect);
          break;
        case "stats":
          initStats();
          showOverlay(statsOverlay);
          break;
        case "options":
          setupPreferences();
          showOverlay(optionsOverlay);
          break;
        case "back-menu":
          showMainMenu();
          break;
        case "retry":
          if (victoryTimer) {
            clearInterval(victoryTimer);
            victoryTimer = null;
          }
          startLevel(currentLevel.id);
          break;
        case "return-menu":
          if (victoryTimer) {
            clearInterval(victoryTimer);
            victoryTimer = null;
          }
          showMainMenu();
          break;
        case "restart-level":
          if (currentState === GAME_STATES.LEVEL && currentLevel) {
            pausedForOptions = false;
            setMusicVolume(MUSIC_VOLUME.normal);
            startLevel(currentLevel.id);
          }
          break;
        case "quit-level":
          pausedForOptions = false;
          showMainMenu();
          break;
        case "close-options":
          closeOptionsOverlay();
          break;
        default:
          break;
      }
    });
  });

  musicToggle.addEventListener("change", () => {
    musicEnabled = musicToggle.checked;
    save.preferences.music = musicEnabled;
    if (musicEnabled) {
      startMusic();
    } else {
      stopMusic();
    }
    saveData();
  });

  buttonSizeRange.addEventListener("input", (event) => {
    const value = parseFloat(event.target.value);
    save.preferences.buttonSize = value;
    applyButtonSize(value);
    saveData();
  });

  joystickSensitivityRange.addEventListener("input", (event) => {
    const value = parseFloat(event.target.value);
    save.preferences.joystickSensitivity = value;
    saveData();
  });

  leftyToggle.addEventListener("change", (event) => {
    save.preferences.lefty = event.target.checked;
    updateControlLayout();
    saveData();
  });

  controlSchemeSelect.addEventListener("change", (event) => {
    save.preferences.controlScheme = event.target.value;
    updateControlLayout();
    saveData();
  });
}

hudOptionsButton.addEventListener("click", () => {
  setupPreferences();
  pausedForOptions = true;
  stopGameLoop();
  setMusicVolume(MUSIC_VOLUME.low);
  showOverlay(optionsOverlay);
});

function closeOptionsOverlay() {
  if (currentState === GAME_STATES.LEVEL) {
    optionsOverlay.classList.add("hidden");
    optionsOverlay.classList.remove("visible");
    if (pausedForOptions) {
      pausedForOptions = false;
      setMusicVolume(MUSIC_VOLUME.normal);
      orientationCheck();
    }
    showHUD(true);
  } else {
    pausedForOptions = false;
    showOverlay(mainMenu);
  }
}

function handleVisibilityChange() {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopGameLoop();
      stopMusic();
    } else if (currentState === GAME_STATES.LEVEL) {
      startGameLoop();
      startMusic();
    }
  });
}

function showMessage(reason) {
  if (currentState !== GAME_STATES.LEVEL) return;
  endLevel(false, reason);
}

function init() {
  setupPreferences();
  initLevelSelect();
  initStats();
  bindMenus();
  setupInput();
  orientationCheck();
  window.addEventListener("resize", orientationCheck);
  window.addEventListener("orientationchange", orientationCheck);
  handleVisibilityChange();
  showMainMenu();
}

init();

export {}; // explicit module
