import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installPressFeedback } from "./utils/motion";

// Tap feedback for every button, chip, row and card (src/utils/motion.ts)
installPressFeedback();

createRoot(document.getElementById("root")!).render(<App />);
