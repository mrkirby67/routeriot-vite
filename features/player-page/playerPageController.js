// features/player-page/playerPageController.js

/**
 * @file Controller for the main player page.
 * It orchestrates the initialization of different UI components and features
 * for the player view.
 */

import { initializeOpponentList } from "../../components/OpponentList/OpponentList.js";
import { initializeChat } from "../chat/playerChat.state.js";

/**
 * Initializes the player page.
 */
export function initializePlayerPage() {
  console.log("Initializing player page...");
  initializeOpponentList();
  initializeChat();
  // Other initialization logic will go here.
}
