import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import CrashScreen from "./components/CrashScreen";
import "./index.css";
import { installPressFeedback } from "./utils/motion";
import { prewarmData } from "./utils/dataStore";

// The first screen of any tab needs the league sheet, the extras and the sprite looks: they start downloading now, not when
// the first tab chunk has loaded and rendered (dataStore.ts shares the request with the first reader)
// The Collection prices every card from the market file and asks for it only after its first render: start it now.
const collectionOpen = /^#\/?collection/.test(window.location.hash);
const hofOpen = /^#\/?hof/.test(window.location.hash);
prewarmData([
  "data/initial-data.csv",
  "data/player-extras.json",
  "data/sprites.json",
  ...(typeof __PRIVATE_SPRITES__ !== "undefined" && __PRIVATE_SPRITES__ ? ["private-sprites/nfl/index.json"] : []),
  // what every tab's ratings, search and cards read once it mounts: before the lazy hosts these were asked for at boot
  "data/league/content.json",
  "data/league/season_ovr.json",
  "data/legends.json",
  "data/game-exclusions.json",
  ...(collectionOpen ? ["data/market-latest.json"] : []),
  ...(hofOpen ? ["data/league/halloffame.json"] : []),
]);

// Tap feedback for every button, chip, row and card (src/utils/motion.ts)
installPressFeedback();

// A render error shows what broke (and a reload button) instead of a blank page
createRoot(document.getElementById("root")!).render(
  <CrashScreen>
    <App />
  </CrashScreen>,
);
