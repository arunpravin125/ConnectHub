import React from "react";
import { Box, Container, useColorModeValue } from "@chakra-ui/react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import UserPages from "./Pages/UserPages";
import PostPage from "./Pages/PostPage";
import Header from "./components/Header";
import HomePage from "./Pages/HomePage";
import AuthPage from "./Pages/AuthPage";
import { useRecoilValue } from "recoil";
import userAtom from "./atoms/userAtom";
import UpdateProfilePage from "./Pages/UpdateProfilePage";
import CreatePost from "./components/CreatePost";
import ChatPage from "./Pages/ChatPage";
import SettingsPage from "./Pages/SettingsPage";
import NotificationPage from "./Pages/NotificationPage";
import SuggestUsers from "./components/SuggestUsers";
import SpacesPage from "./Pages/SpacesPage";
import SpaceRoom from "./Pages/SpaceRoom";

const App = () => {
  const user = useRecoilValue(userAtom);
  console.log("user in Data :", user);
 
  const {pathname} = useLocation()
  return (
    <Box className="app-shell" position="relative" w="full" minH="100vh">
      <Box aria-hidden position="fixed" inset={0} pointerEvents="none" zIndex={0}>
        <Box
          position="absolute"
          top={{ base: "-120px", md: "-160px" }}
          right={{ base: "-140px", md: "-220px" }}
          w={{ base: "240px", md: "420px" }}
          h={{ base: "240px", md: "420px" }}
          bgGradient={useColorModeValue(
            "radial(ellipse at center, rgba(255, 107, 53, 0.28), transparent 70%)",
            "radial(ellipse at center, rgba(255, 138, 75, 0.24), transparent 70%)"
          )}
          filter="blur(10px)"
        />
        <Box
          position="absolute"
          bottom={{ base: "-140px", md: "-220px" }}
          left={{ base: "-120px", md: "-200px" }}
          w={{ base: "260px", md: "460px" }}
          h={{ base: "260px", md: "460px" }}
          bgGradient={useColorModeValue(
            "radial(ellipse at center, rgba(20, 184, 166, 0.24), transparent 70%)",
            "radial(ellipse at center, rgba(34, 193, 181, 0.2), transparent 70%)"
          )}
          filter="blur(10px)"
        />
      </Box>
      <Container
        maxW={
          pathname === "/"
            ? { base: "full", sm: "640px", md: "860px", lg: "1100px" }
            : { base: "full", sm: "600px", md: "720px", lg: "820px" }
        }
        px={{ base: 4, md: 6 }}
        pt={{ base: 4, md: 8 }}
        pb={{ base: 24, md: 10 }}
        position="relative"
        zIndex={1}
      >
        <Header />

        <Routes>
          <Route
            path="/"
            element={user ? <HomePage /> : <Navigate to="/auth" />}
          ></Route>
          <Route
            path="/auth"
            element={!user ? <AuthPage /> : <Navigate to="/" />}
          ></Route>
          <Route
            path="/update"
            element={user ? <UpdateProfilePage /> : <Navigate to="/auth" />}
          ></Route>
          <Route
            path="/:username"
            element={
              user ? (
                <>
                  <CreatePost />
                  <UserPages />
                </>
              ) : (
                <UserPages />
              )
            }
          ></Route>
          <Route path="/:username/post/:pid" element={<PostPage />}></Route>
          <Route
            path="/chat"
            element={user ? <ChatPage /> : <Navigate to={"/auth"} />}
          ></Route>
          <Route
            path="/settings"
            element={user ? <SettingsPage /> : <Navigate to={"/auth"} />}
          ></Route>
           <Route
            path="/notification"
            element={user ? <NotificationPage /> : <Navigate to={"/auth"} />}
          ></Route>
          <Route
            path="/suggested"
            element={user ? <SuggestUsers /> : <Navigate to={"/auth"} />}
          ></Route>
          <Route
            path="/spaces"
            element={user ? <SpacesPage /> : <Navigate to={"/auth"} />}
          ></Route>
          <Route
            path="/spaces/:id"
            element={user ? <SpaceRoom /> : <Navigate to={"/auth"} />}
          ></Route>
        </Routes>
      </Container>
    </Box>
  );
};

export default App;
