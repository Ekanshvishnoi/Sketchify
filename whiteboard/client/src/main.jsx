/**
 * client/src/main.jsx
 *
 * The very first JavaScript file that runs in the browser.
 * Its only job is to find the <div id="root"> in index.html
 * and render our React <App /> component inside it.
 * Everything else flows from App.jsx.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
