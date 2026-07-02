/**
 * client/src/context/RoomContext.jsx
 *
 * React Context lets you share state across the whole component tree
 * without passing props manually through every layer.
 *
 * This context holds everything that multiple components need to know:
 *   - The user's chosen name
 *   - Their role in the room (active or spectator)
 *   - Which seat they occupy (A, B, or null)
 *   - The current room code
 *
 * HOW TO USE IN ANY COMPONENT:
 *   import { useRoom } from "../context/RoomContext";
 *   const { userName, role, seat } = useRoom();
 */
import { createContext, useContext, useState } from "react";

const RoomContext = createContext(null);

export function RoomProvider({ children }) {
  const [userName, setUserName] = useState("");   // the name the user typed at login
  const [role, setRole]         = useState(null); // "active" | "spectator" | null
  const [seat, setSeat]         = useState(null); // "A" | "B" | null
  const [roomCode, setRoomCode] = useState("");   // the 6-char room code

  return (
    <RoomContext.Provider value={{
      userName, setUserName,
      role,     setRole,
      seat,     setSeat,
      roomCode, setRoomCode,
    }}>
      {children}
    </RoomContext.Provider>
  );
}

// Custom hook — components call useRoom() instead of useContext(RoomContext)
export function useRoom() {
  return useContext(RoomContext);
}
