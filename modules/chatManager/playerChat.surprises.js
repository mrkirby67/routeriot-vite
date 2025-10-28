// ============================================================================
// FILE: modules/chatManager/playerChat.surprises.js
// PURPOSE: Handles surprise usage (Flat Tire, Bug Splat, Shield Wax)
// ============================================================================

import { db } from '../config.js';
import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { loadFlatTireConfig, assignFlatTireTeam } from '../flatTireManager.js';
import { activateShield, getShieldDurationMs, decrementSurprise, isShieldActive } from '../teamSurpriseManager.js';
import { sendPrivateSystemMessage } from './messageService.js';