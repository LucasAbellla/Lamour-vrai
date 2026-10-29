import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/structural.css";

import { assertEnvironment, environment } from "./config/environment.js";
import { createStore } from "./core/store.js";
import { applyProfile, startRelationshipClock } from "./core/profile.js";
import { createViewer, preludeFor } from "./core/perspective.js";
import { createAuthService } from "./features/auth/auth.service.js";
import { createSecureAuthService } from "./features/auth/secure-auth.service.js";
import { setupAuthUI } from "./features/auth/auth.ui.js";
import { createMemoriesFeature } from "./features/memories/memories.js";
import { createCapsulesFeature } from "./features/capsules/capsules.js";
import { createDreamsFeature } from "./features/dreams/dreams.js";
import { createLettersFeature } from "./features/letters/letters.js";
import { createStoryFeature } from "./features/story/story.js";
import { createPrelude } from "./features/prelude/prelude.js";
import { createPreludeEditor } from "./features/prelude/prelude-editor.js";
import { createExperience } from "./features/experience.js";
import { createFeedback } from "./ui/feedback.js";
import { setupAtmosphere, setupDynamicMotion, setupRevealAndNavigation } from "./ui/motion.js";
import { setupPwa } from "./pwa/pwa.js";

assertEnvironment();

const auth = environment.authMode === "supabase"
  ? createSecureAuthService(environment)
  : createAuthService(environment.storageNamespace);
const feedback = createFeedback();
let currentProfile = null;
let currentViewer = null;
let stopClock = () => {};

const getProfile = () => currentProfile;
const getViewer = () => currentViewer;

function refreshViewer() {
  currentViewer = createViewer(currentProfile, auth.getRole());
  applyProfile(currentProfile, currentViewer);
}

async function initializePrivateSpace(profile, { resumed = false } = {}) {
  currentProfile = profile;
  refreshViewer();
  stopClock();
  stopClock = startRelationshipClock(currentProfile);

  const storeOptions = auth.getStoreOptions?.() || {};
  const store = createStore(environment.storageNamespace, storeOptions);
  const memories = createMemoriesFeature({ store, feedback, getProfile, getViewer });
  const capsules = createCapsulesFeature({ store, feedback });
  const dreams = createDreamsFeature({ store, feedback });
  const letters = createLettersFeature({ store, feedback, getProfile, getViewer });
  const story = createStoryFeature({ store, feedback, getProfile, getViewer, letters });

  memories.initialize();
  capsules.initialize();
  dreams.initialize();
  letters.initialize();
  story.initialize();

  const renderAll = () => {
    memories.render();
    capsules.render();
    dreams.render();
    letters.render();
  };

  store.subscribe((_, meta) => {
    if (!meta.remote) return;
    renderAll();
    feedback.toast("O espaço recebeu uma atualização protegida");
  });
  store.connectRemote();

  const onProfileChanged = nextProfile => {
    currentProfile = nextProfile;
    refreshViewer();
    stopClock();
    stopClock = startRelationshipClock(currentProfile);
    renderAll();
  };
  const prelude = createPrelude();
  createPreludeEditor({ auth, feedback, getProfile, getViewer, prelude, onProfileChanged });

  createExperience({
    store,
    feedback,
    auth,
    getProfile,
    getViewer,
    onProfileChanged,
    memories,
    capsules,
    dreams,
    letters,
    story
  }).initialize();

  if (auth.mode === "secure") {
    const connectionStatus = document.querySelector("#connection-status");
    if (connectionStatus) connectionStatus.textContent = "Cofre cifrado · 2FA";
    document.querySelector("#saved-note").textContent = "Cifrado antes de sincronizar";
    window.addEventListener("lamour:vault-error", event => {
      feedback.toast(event.detail?.message || "Uma alteração ainda não foi sincronizada");
    });
  }

  setupAtmosphere();
  setupDynamicMotion();
  setupRevealAndNavigation();
  document.documentElement.dataset.environment = environment.name;

  // Ao abrir o cofre, o espaço aparece direto. Se houver prelúdio para quem entra, a tela fica escura
  // e ele toca antes; recarregar a página no meio da visita não o repete.
  const opening = resumed ? null : preludeFor(currentProfile, currentViewer);
  if (opening) void prelude.play(opening, { instant: true });
}

feedback.setupDialogs();
setupPwa({ feedback });
setupAuthUI({ auth, onAuthenticated: initializePrivateSpace });
