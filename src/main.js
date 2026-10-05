import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/structural.css";

import { assertEnvironment, environment } from "./config/environment.js";
import { createStore } from "./core/store.js";
import { applyProfile, startRelationshipClock } from "./core/profile.js";
import { createAuthService } from "./features/auth/auth.service.js";
import { setupAuthUI } from "./features/auth/auth.ui.js";
import { createMemoriesFeature } from "./features/memories/memories.js";
import { createCapsulesFeature } from "./features/capsules/capsules.js";
import { createDreamsFeature } from "./features/dreams/dreams.js";
import { createLettersFeature } from "./features/letters/letters.js";
import { createExperience } from "./features/experience.js";
import { createFeedback } from "./ui/feedback.js";
import { setupAtmosphere, setupDynamicMotion, setupRevealAndNavigation } from "./ui/motion.js";

assertEnvironment();

const auth = createAuthService(environment.storageNamespace);
const feedback = createFeedback();
let currentProfile = null;
let stopClock = () => {};

async function initializePrivateSpace(profile) {
  currentProfile = profile;
  applyProfile(currentProfile);
  stopClock();
  stopClock = startRelationshipClock(currentProfile);

  const store = createStore(environment.storageNamespace);
  const memories = createMemoriesFeature({ store, feedback });
  const capsules = createCapsulesFeature({ store, feedback });
  const dreams = createDreamsFeature({ store, feedback });
  const letters = createLettersFeature({ store, feedback, getProfile: () => currentProfile });

  feedback.setupDialogs();
  memories.initialize();
  capsules.initialize();
  dreams.initialize();
  letters.initialize();

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

  setupAtmosphere();
  setupDynamicMotion();
  setupRevealAndNavigation();
  document.documentElement.dataset.environment = environment.name;
}

setupAuthUI({ auth, onAuthenticated: initializePrivateSpace });
