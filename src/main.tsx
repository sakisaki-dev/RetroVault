import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import CrashScreen from "./components/CrashScreen";
import "./index.css";
import { installPressFeedback } from "./utils/motion";
import { prewarmData } from "./utils/dataStore";

// The first screen of any tab needs the league sheet, the extras and the sprite looks: they start downloading now, not when
// the first tab chunk has loaded and rendered (dataStore.ts shares the request with the first reader)
prewarmData([
  "data/initial-data.csv",
  "data/player-extras.json",
  "data/sprites.json",
  ...(typeof __PRIVATE_SPRITES__ !== "undefined" && __PRIVATE_SPRITES__ ? ["private-sprites/nfl/index.json"] : []),
]);

// Tap feedback for every button, chip, row and card (src/utils/motion.ts)
installPressFeedback();

// A render error shows what broke (and a reload button) instead of a blank page
createRoot(document.getElementById("root")!).render(
  <CrashScreen>
    <App />
  </CrashScreen>,
);
