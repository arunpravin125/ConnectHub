import {
  Badge,
  Button,
  Flex,
  IconButton,
  Image,
  Link,
  useColorMode,
  useColorModeValue,
} from "@chakra-ui/react";
import React from "react";
import { useRecoilValue, useSetRecoilState } from "recoil";
import userAtom from "../atoms/userAtom";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { AiFillHome } from "react-icons/ai";
import { RiLogoutBoxRLine } from "react-icons/ri";
import { RxAvatar } from "react-icons/rx";
import useLogout from "../hooks/useLogout";
import authScreenAtom from "../atoms/authAtom";
import { BsFillChatLeftTextFill } from "react-icons/bs";
import { MdOutlineSettings } from "react-icons/md";
import { IoNotificationsOutline } from "react-icons/io5";
import { useSocket } from "../context/SocketContext";
import { FaUsersGear } from "react-icons/fa6";
import { HiOutlineMicrophone } from "react-icons/hi";
const Header = () => {
  const { colorMode, toggleColorMode } = useColorMode();
  const user = useRecoilValue(userAtom);
  const { loading, Logout } = useLogout();
  const {socket,onlineUsers,notifications,setNotifications,notificationLength,setNotificationLength} =useSocket()
  const setAuthScreen = useSetRecoilState(authScreenAtom);
  const { pathname } = useLocation();

  const surfaceBg = useColorModeValue("whiteAlpha.800", "blackAlpha.400");
  const surfaceBorder = useColorModeValue("sand.200", "ink.700");
  const hoverBg = useColorModeValue("sand.100", "ink.700");
  const activeBg = useColorModeValue("sand.200", "ink.600");
  
 
  // useEffect(()=>{
   
  //   socket?.on("live",({notification})=>{
  //     console.log("liveNotification",notification)
  //     setNotifications((prevNo)=>[notification,...prevNo])
      
  //   })
  //    return ()=> socket?.off("live")
  //   },[setNotifications,socket,setNotificationLength])
    
     
    
  const navItems = [
    { to: "/", label: "Home", icon: <AiFillHome size={20} />, active: pathname === "/" },
    { to: "/chat", label: "Chat", icon: <BsFillChatLeftTextFill size={20} />, active: pathname.startsWith("/chat") },
    { to: "/settings", label: "Settings", icon: <MdOutlineSettings size={20} />, active: pathname.startsWith("/settings") },
    { to: "/notification", label: "Notifications", icon: <IoNotificationsOutline size={20} />, active: pathname.startsWith("/notification") },
    { to: "/suggested", label: "Suggested", icon: <FaUsersGear size={20} />, active: pathname.startsWith("/suggested") },
    { to: "/spaces", label: "Spaces", icon: <HiOutlineMicrophone size={20} />, active: pathname.startsWith("/spaces") },
  ];

  return (
    <Flex
      position="sticky"
      top={{ base: 2, md: 4 }}
      zIndex={20}
      alignItems="center"
      justifyContent="space-between"
      flexWrap="wrap"
      gap={3}
      mt={{ base: 2, md: 4 }}
      mb={{ base: 6, md: 10 }}
      px={{ base: 3, md: 4 }}
      py={2}
      borderRadius="full"
      bg={surfaceBg}
      border="1px solid"
      borderColor={surfaceBorder}
      backdropFilter="blur(12px)"
    >
      <Flex alignItems="center" gap={{ base: 1, md: 2 }} flexWrap="wrap">
        {user && navItems.map((item) => (
          <Flex
            key={item.to}
            position="relative"
            display="inline-flex"
            alignItems="center"
          >
            <IconButton
              as={RouterLink}
              to={item.to}
              icon={item.icon}
              variant="ghost"
              size="sm"
              aria-label={item.label}
              bg={item.active ? activeBg : "transparent"}
              _hover={{ bg: hoverBg }}
            />
            {item.label === "Notifications" && notificationLength?.length > 0 && (
              <Badge
                position="absolute"
                top="-4px"
                right="-6px"
                bg="brand.500"
                color="white"
                borderRadius="full"
                px={2}
                fontSize="0.6rem"
              >
                {notificationLength.length}
              </Badge>
            )}
          </Flex>
        ))}
      </Flex>

      <Flex alignItems="center" gap={{ base: 2, md: 3 }}>
        {!user && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAuthScreen("login")}
            as={RouterLink}
            to="/auth"
          >
            Login
          </Button>
        )}

        <IconButton
          variant="ghost"
          size="sm"
          aria-label="Toggle color mode"
          onClick={toggleColorMode}
          icon={
            <Image
              cursor="pointer"
              alt="logo"
              w={5}
              src={colorMode === "dark" ? "/light-logo.svg" : "/dark-logo.svg"}
            />
          }
        />

        {user && (
          <Flex alignItems={"center"} gap={{ base: 2, md: 3 }}>
            <Link as={RouterLink} to={`/${user.username}`}>
              <IconButton
                variant="ghost"
                size="sm"
                aria-label="Profile"
                icon={<RxAvatar size={20} />}
              />
            </Link>
            <IconButton
              isLoading={loading}
              onClick={Logout}
              aria-label="Log out"
              variant="ghost"
              size="sm"
              icon={<RiLogoutBoxRLine size={18} />}
            />
          </Flex>
        )}
        {!user && (
          <Button
            size="sm"
            onClick={() => setAuthScreen("signup")}
            as={RouterLink}
            to="/auth"
          >
            Sign Up
          </Button>
        )}
      </Flex>
    </Flex>
  );
};

export default Header;
