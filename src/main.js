import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/structural.css";

import { assertEnvironment, environment } from "./config/environment.js";
import { createStore } from "./core/store.js";
import { applyProfile, startRelationshipClock } from "./core/profile.js";
import { createAuthService } from "./features/auth/auth.service.js";
import { createSecureAuthService } from "./features/auth/secure-auth.service.js";
import { setupAuthUI } from "./features/auth/auth.ui.js";
import { createMemoriesFeature } from "./features/memories/memories.js";
import { createCapsulesFeature } from "./features/capsules/capsules.js";
import { createDreamsFeature } from "./features/dreams/dreams.js";
import { createLettersFeature } from "./features/letters/letters.js";
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
let stopClock = () => {};

async function initializePrivateSpace(profile) {
  currentProfile = profile;
  applyProfile(currentProfile);
  stopClock();
  stopClock = startRelationshipClock(currentProfile);

  const storeOptions = auth.getStoreOptions?.() || {};
  const store = createStore(environment.storageNamespace, storeOptions);
  const memories = createMemoriesFeature({ store, feedback });
  const capsules = createCapsulesFeature({ store, feedback });
  const dreams = createDreamsFeature({ store, feedback });
  const letters = createLettersFeature({ store, feedback, getProfile: () => currentProfile });

  memories.initialize();
  capsules.initialize();
  dreams.initialize();
  letters.initialize();

  store.subscribe((_, meta) => {
    if (!meta.remote) return;
    memories.render();
    capsules.render();
    dreams.render();
    letters.render();
    feedback.toast("O espaço recebeu uma atualização protegida");
  });
  store.connectRemote();

  createExperience({
    store,
    feedback,
    auth,
    getProfile: () => currentProfile,
    onProfileChanged(nextProfile) {
      currentProfile = nextProfile;
      applyProfile(currentProfile);
      stopClock();
      stopClock = startRelationshipClock(currentProfile);
      letters.render();
    },
    memories,
    capsules,
    dreams,
    letters
  }).initialize();

  if (auth.mode === "secure") {
    document.querySelector("#connection-status").textContent = "Cofre cifrado · 2FA";
    document.querySelector("#saved-note").textContent = "Cifrado antes de sincronizar";
    window.addEventListener("lamour:vault-error", event => {
      feedback.toast(event.detail?.message || "Uma alteração ainda não foi sincronizada");
    });
  }

  setupAtmosphere();
  setupDynamicMotion();
  setupRevealAndNavigation();
  document.documentElement.dataset.environment = environment.name;
}

feedback.setupDialogs();
setupPwa({ feedback });
setupAuthUI({ auth, onAuthenticated: initializePrivateSpace });
