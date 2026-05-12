/**
 * main.js — boot.
 *
 * Wires every module to the DOM and kicks off the first render. Modules
 * follow a uniform contract: each exports an `init<Name>()` function
 * that is idempotent and safe to call once after DOM is ready.
 *
 * Module dependency order (top → bottom = no internal app deps → many):
 *   utils → db
 *   utils → config → theme
 *   utils → queue
 *   utils + queue → image
 *   utils + db + queue → history
 *   utils + config + db + queue + history → api  (api boots the queue's listeners)
 *   utils → result, modal, pwa
 *
 * Each module is independently readable; cross-module calls are explicit
 * imports, never globals.
 */

import { initConfig }      from './config.js';
import { initTheme }       from './theme.js';
import { initImage, consumeSharedImage } from './image.js';
import { initHistory, renderHistory } from './history.js';
import { initApi }         from './api.js';
import { initResult }      from './result.js';
import { initModal }       from './modal.js';
import { initPwa }         from './pwa.js';

// Order matters: config must load before anything reads cfgKey/cfgPrompt,
// theme button needs the LS key from config to know where to persist.
initConfig();
initTheme();
initImage();
initHistory();
initApi();
initResult();
initModal();
initPwa();

renderHistory();

// If the OS share sheet pushed an image at us, swallow it into the input.
consumeSharedImage();
