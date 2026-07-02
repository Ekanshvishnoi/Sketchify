/**
 * client/src/App.jsx
 *
 * Defines the two real URL routes in the app:
 *   /          → Home page (solo whiteboard)
 *   /room/:code → Room page (live session)
 *
 * BrowserRouter wraps everything so React Router can read
 * the URL and decide which page component to render.
 *
 * RoomContext wraps the router so that any component anywhere
 * in the tree can access shared room state (your name, your seat,
 * your role) without prop-drilling.
 */
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RoomProvider } from "./context/RoomContext.jsx";
import Home from "./pages/Home.jsx";
import Room from "./pages/Room.jsx";

export default function App() {
  return (
    <RoomProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:code" element={<Room />} />
        </Routes>
      </BrowserRouter>
    </RoomProvider>
  );
}
