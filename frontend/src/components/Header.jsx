import {
  Badge,
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  IconButton,
  Image,
  Link,
  Text,
  Avatar,
  Divider,
  useColorMode,
  useColorModeValue,
  useDisclosure,
  VStack,
} from "@chakra-ui/react";
import React, { useRef } from "react";
import { useRecoilValue, useSetRecoilState } from "recoil";
import userAtom from "../atoms/userAtom";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { AiFillHome } from "react-icons/ai";
import { RiLogoutBoxRLine } from "react-icons/ri";
import { RxAvatar } from "react-icons/rx";
import { HamburgerIcon } from "@chakra-ui/icons";
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
  const {
    socket,
    onlineUsers,
    notifications,
    setNotifications,
    notificationLength,
    setNotificationLength,
  } = useSocket();
  const setAuthScreen = useSetRecoilState(authScreenAtom);
  const { pathname } = useLocation();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const btnRef = useRef();

  const surfaceBg = useColorModeValue("whiteAlpha.950", "ink.900");
  const surfaceBorder = useColorModeValue("sand.200", "ink.700");
  const hoverBg = useColorModeValue("brand.50", "ink.800");
  const activeBg = useColorModeValue("brand.100", "ink.700");
  const textColor = useColorModeValue("ink.900", "whiteAlpha.900");
  const secondaryTextColor = useColorModeValue("ink.600", "whiteAlpha.700");
  const iconColor = useColorModeValue("ink.700", "whiteAlpha.800");
  const activeIconColor = useColorModeValue("brand.600", "brand.400");

  // useEffect(()=>{

  //   socket?.on("live",({notification})=>{
  //     console.log("liveNotification",notification)
  //     setNotifications((prevNo)=>[notification,...prevNo])

  //   })
  //    return ()=> socket?.off("live")
  //   },[setNotifications,socket,setNotificationLength])

  const navItems = [
    {
      to: "/",
      label: "Home",
      icon: <AiFillHome size={20} />,
      active: pathname === "/",
    },
    {
      to: "/chat",
      label: "Chat",
      icon: <BsFillChatLeftTextFill size={20} />,
      active: pathname.startsWith("/chat"),
    },
    {
      to: "/settings",
      label: "Settings",
      icon: <MdOutlineSettings size={20} />,
      active: pathname.startsWith("/settings"),
    },
    {
      to: "/notification",
      label: "Notifications",
      icon: <IoNotificationsOutline size={20} />,
      active: pathname.startsWith("/notification"),
    },
    {
      to: "/suggested",
      label: "Suggested",
      icon: <FaUsersGear size={20} />,
      active: pathname.startsWith("/suggested"),
    },
    {
      to: "/spaces",
      label: "Spaces",
      icon: <HiOutlineMicrophone size={20} />,
      active: pathname.startsWith("/spaces"),
    },
  ];

  return (
    <>
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
        {/* Mobile: Hamburger menu button */}
        {user && (
          <IconButton
            ref={btnRef}
            display={{ base: "flex", md: "none" }}
            icon={<HamburgerIcon />}
            variant="ghost"
            size="sm"
            aria-label="Open menu"
            onClick={onOpen}
          />
        )}

        {/* Desktop: Navigation items */}
        <Flex
          alignItems="center"
          gap={{ base: 1, md: 2 }}
          flexWrap="wrap"
          display={{ base: "none", md: "flex" }}
        >
          {user &&
            navItems.map((item) => (
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
                {item.label === "Notifications" &&
                  notificationLength?.length > 0 && (
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
                src={
                  colorMode === "dark" ? "/light-logo.svg" : "/dark-logo.svg"
                }
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

      {/* Mobile Sidebar Drawer */}
      <Drawer
        isOpen={isOpen}
        placement="left"
        onClose={onClose}
        finalFocusRef={btnRef}
        size="xs"
      >
        <DrawerOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <DrawerContent
          bg={surfaceBg}
          borderRight="1px solid"
          borderColor={surfaceBorder}
          backdropFilter="blur(20px)"
          boxShadow="2xl"
        >
          <DrawerCloseButton
            size="md"
            color={textColor}
            _hover={{ bg: hoverBg }}
            top={4}
            right={4}
          />

          {/* User Profile Section */}
          {user && (
            <Box
              bgGradient={useColorModeValue(
                "linear(to-br, brand.50, sand.50)",
                "linear(to-br, ink.800, ink.900)"
              )}
              px={6}
              pt={8}
              pb={6}
              borderBottom="1px solid"
              borderColor={surfaceBorder}
            >
              <Flex alignItems="center" gap={4} mb={4}>
                <Avatar
                  src={user.profilePic}
                  name={user.name}
                  size="lg"
                  border="3px solid"
                  borderColor={useColorModeValue("white", "ink.700")}
                  boxShadow="lg"
                />
                <Box flex={1}>
                  <Text
                    fontSize="lg"
                    fontWeight="bold"
                    color={textColor}
                    noOfLines={1}
                  >
                    {user.name}
                  </Text>
                  <Text fontSize="sm" color={secondaryTextColor} noOfLines={1}>
                    @{user.username}
                  </Text>
                </Box>
              </Flex>
            </Box>
          )}

          <DrawerHeader
            px={6}
            py={4}
            borderBottom="1px solid"
            borderColor={surfaceBorder}
            display="flex"
            alignItems="center"
            gap={2}
          >
            <Text
              fontSize="xl"
              fontWeight="bold"
              bgGradient={useColorModeValue(
                "linear(to-r, brand.600, brand.500)",
                "linear(to-r, brand.400, brand.300)"
              )}
              bgClip="text"
            >
              Menu
            </Text>
          </DrawerHeader>

          <DrawerBody p={0}>
            <VStack spacing={0} align="stretch">
              {user &&
                navItems.map((item, index) => (
                  <Box
                    key={item.to}
                    as={RouterLink}
                    to={item.to}
                    onClick={onClose}
                    px={6}
                    py={4}
                    bg={item.active ? activeBg : "transparent"}
                    _hover={{
                      bg: hoverBg,
                      transform: "translateX(4px)",
                    }}
                    borderLeft={
                      item.active ? "4px solid" : "4px solid transparent"
                    }
                    borderLeftColor={
                      item.active ? activeIconColor : "transparent"
                    }
                    position="relative"
                    transition="all 0.2s ease"
                    cursor="pointer"
                    sx={{
                      "&:hover .nav-icon": {
                        color: activeIconColor,
                        transform: "scale(1.1)",
                      },
                    }}
                  >
                    <Flex alignItems="center" gap={4}>
                      <Box
                        className="nav-icon"
                        color={item.active ? activeIconColor : iconColor}
                        transition="all 0.2s ease"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        w={6}
                        h={6}
                      >
                        {item.icon}
                      </Box>
                      <Text
                        fontSize="md"
                        fontWeight={item.active ? "semibold" : "medium"}
                        color={item.active ? activeIconColor : textColor}
                        flex={1}
                      >
                        {item.label}
                      </Text>
                      {item.label === "Notifications" &&
                        notificationLength?.length > 0 && (
                          <Badge
                            bg="brand.500"
                            color="white"
                            borderRadius="full"
                            px={2.5}
                            py={0.5}
                            fontSize="0.7rem"
                            fontWeight="bold"
                            boxShadow="sm"
                          >
                            {notificationLength.length}
                          </Badge>
                        )}
                    </Flex>
                    {item.active && (
                      <Box
                        position="absolute"
                        left={0}
                        top={0}
                        bottom={0}
                        w="4px"
                        bgGradient={useColorModeValue(
                          "linear(to-b, brand.500, brand.400)",
                          "linear(to-b, brand.400, brand.300)"
                        )}
                        borderRadius="0 2px 2px 0"
                      />
                    )}
                  </Box>
                ))}

              <Divider my={2} borderColor={surfaceBorder} />

              {/* User actions in sidebar */}
              {user && (
                <>
                  <Box
                    as={RouterLink}
                    to={`/${user.username}`}
                    onClick={onClose}
                    px={6}
                    py={4}
                    bg={
                      pathname === `/${user.username}`
                        ? activeBg
                        : "transparent"
                    }
                    _hover={{
                      bg: hoverBg,
                      transform: "translateX(4px)",
                    }}
                    borderLeft={
                      pathname === `/${user.username}`
                        ? "4px solid"
                        : "4px solid transparent"
                    }
                    borderLeftColor={
                      pathname === `/${user.username}`
                        ? activeIconColor
                        : "transparent"
                    }
                    position="relative"
                    transition="all 0.2s ease"
                    cursor="pointer"
                    sx={{
                      "&:hover .nav-icon": {
                        color: activeIconColor,
                        transform: "scale(1.1)",
                      },
                    }}
                  >
                    <Flex alignItems="center" gap={4}>
                      <Box
                        className="nav-icon"
                        color={
                          pathname === `/${user.username}`
                            ? activeIconColor
                            : iconColor
                        }
                        transition="all 0.2s ease"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        w={6}
                        h={6}
                      >
                        <RxAvatar size={20} />
                      </Box>
                      <Text
                        fontSize="md"
                        fontWeight={
                          pathname === `/${user.username}`
                            ? "semibold"
                            : "medium"
                        }
                        color={
                          pathname === `/${user.username}`
                            ? activeIconColor
                            : textColor
                        }
                      >
                        Profile
                      </Text>
                    </Flex>
                  </Box>
                  <Box
                    onClick={() => {
                      onClose();
                      Logout();
                    }}
                    px={6}
                    py={4}
                    _hover={{
                      bg: useColorModeValue("red.50", "red.900"),
                      transform: "translateX(4px)",
                    }}
                    cursor="pointer"
                    transition="all 0.2s ease"
                    sx={{
                      "&:hover .nav-icon": {
                        color: "red.500",
                        transform: "scale(1.1)",
                      },
                    }}
                  >
                    <Flex alignItems="center" gap={4}>
                      <Box
                        className="nav-icon"
                        color={iconColor}
                        transition="all 0.2s ease"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        w={6}
                        h={6}
                      >
                        <RiLogoutBoxRLine size={18} />
                      </Box>
                      <Text fontSize="md" fontWeight="medium" color={textColor}>
                        Logout
                      </Text>
                    </Flex>
                  </Box>
                </>
              )}
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default Header;
