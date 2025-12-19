import { createContext, useContext, useEffect, useState } from "react";
import { useRecoilValue } from "recoil";
import io from "socket.io-client";
import userAtom from "../atoms/userAtom";

const SocketContext = createContext();

export const useSocket = () => {
  return useContext(SocketContext);
};
export const SocketContextProvider = ({ children }) => {
  const user = useRecoilValue(userAtom);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [notificationLength, setNotificationLength] = useState();
  const [typing, setTyping] = useState();
  const [toUser, setToUser] = useState();
  const [selectedUserId, setSelectedUserId] = useState();
  // Determine socket URL based on environment
  const getSocketUrl = () => {
    // In development, use localhost
    if (import.meta.env.DEV || window.location.hostname === "localhost") {
      return "http://localhost:4900";
    }
    // In production, use the production URL
    return "https://threads-app-5.onrender.com";
  };

  useEffect(() => {
    let socketInstance = null;

    if (user) {
      const socketUrl = getSocketUrl();
      console.log("Connecting to socket server:", socketUrl);

      socketInstance = io(socketUrl, {
        query: {
          userId: user?._id,
        },
        transports: ["polling", "websocket"], // Try polling first, then websocket
        withCredentials: true, // Include credentials for CORS
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 20000, // Increase timeout
        forceNew: false, // Reuse existing connection if available
      });

      // Add connection event listeners for debugging
      socketInstance.on("connect", () => {
        console.log("✅ Socket connected:", socketInstance.id);
        console.log(
          "📡 Socket transport:",
          socketInstance.io.engine.transport.name
        );
      });

      socketInstance.on("disconnect", (reason) => {
        console.log("❌ Socket disconnected:", reason);
      });

      socketInstance.on("connect_error", (error) => {
        console.error("❌ Socket connection error:", error);
        console.error("❌ Error details:", {
          message: error.message,
          type: error.type,
          description: error.description,
        });
      });

      // Listen for reconnection attempts
      socketInstance.on("reconnect_attempt", (attemptNumber) => {
        console.log(`🔄 Reconnection attempt ${attemptNumber}...`);
      });

      socketInstance.on("reconnect", (attemptNumber) => {
        console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      });

      socketInstance.on("reconnect_error", (error) => {
        console.error("❌ Reconnection error:", error);
      });

      socketInstance.on("reconnect_failed", () => {
        console.error("❌ Reconnection failed - all attempts exhausted");
      });

      setSocket(socketInstance);

      socketInstance.on("getOnlineUsers", (users) => {
        setOnlineUsers(users);
      });
    } else {
      // Clean up socket when user logs out
      setSocket((prevSocket) => {
        if (prevSocket) {
          prevSocket.close();
        }
        return null;
      });
    }

    // Cleanup function
    return () => {
      if (socketInstance) {
        socketInstance.close();
      }
    };
  }, [user?._id]);

  console.log("onlineUsers:", onlineUsers);

  return (
    <SocketContext.Provider
      value={{
        socket,
        toUser,
        setToUser,
        notificationLength,
        setNotificationLength,
        selectedUserId,
        setSelectedUserId,
        setSocket,
        onlineUsers,
        notifications,
        setNotifications,
        typing,
        setTyping,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
