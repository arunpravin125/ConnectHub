import {
  Avatar,
  Badge,
  Box,
  Button,
  Flex,
  Link,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { Portal } from "@chakra-ui/react";
import { Text } from "@chakra-ui/react";
import { FaInstagram } from "react-icons/fa6";
import React from "react";
import { CgMoreO } from "react-icons/cg";
import toast from "react-hot-toast";
import { useRecoilValue } from "recoil";

import userAtom from "../atoms/userAtom";
import { Link as RoutesLink } from "react-router-dom";
import usehandlefollowUnfollow from "../hooks/usehandlefollowUnfollow";

const UserHeader = ({
  user,
  activeTab = "threads",
  onTabChange,
  onOpenStory,
}) => {
  const currentUser = useRecoilValue(userAtom); // this is login in user
  // const [following,setFollowing]=useState(user.followers.includes(currentUser?._id))
  // const [updating,setUpdating]=useState()
  const { handleFollowAndUnfollow, following, updating } =
    usehandlefollowUnfollow(user);
  console.log("following:", following);

  const copyURL = () => {
    const currentURL = window.location.href;
    navigator.clipboard.writeText(currentURL).then(() => {
      console.log("URL copied to clipboard");

      toast("URL copied to the clipboard", {
        duration: 2000,
      });
    });
  };

  // const handleFollowAndUnfollow = async()=>{
  //   if(!currentUser){
  //     toast.error("Please login to follow")
  //     return;
  //   }
  //   if(updating) return;
  //   setUpdating(true)
  //   try {
  //     const res = await fetch(`/api/users/follow/${user._id}`,{
  //       method:"POST",
  //       headers:{
  //         "Content-Type":"application/json"
  //       },
  //     })
  //     const data = await res.json()

  //     console.log(data)
  //     if(data.error){
  //       throw new Erro(data.error)
  //     }
  //     if(following){
  //       toast.success(`Unfollowed ${user.name} successfully`)
  //       user.followers.pop() // only update in client side
  //     }else{
  //       toast.success(`followed ${user.name} successfully`)
  //       user.followers.push(currentUser?._id) // only update in client side
  //     }
  //     setFollowing(!following)
  //   } catch (error) {
  //     console.log("error in followUnFollow",error.message)
  //     toast.error(error.message)
  //   } finally{
  //     setUpdating(false)
  //   }
  // }
  return (
    <VStack gap={4} alignItems={"stretch"}>
      <Box
        bg={useColorModeValue("whiteAlpha.900", "blackAlpha.400")}
        border="1px solid"
        borderColor={useColorModeValue("sand.200", "ink.700")}
        borderRadius="2xl"
        p={{ base: 4, md: 5 }}
        backdropFilter="blur(10px)"
        boxShadow="0 20px 40px -30px rgba(0, 0, 0, 0.35)"
      >
        <Flex justifyContent="space-between" w="full" gap={4} flexWrap="wrap">
          <Box>
            <Text fontWeight="bold" fontSize={{ base: "xl", md: "2xl" }}>
              {user.name}
            </Text>
            <Flex gap={2} alignItems="center" flexWrap="wrap" mt={1}>
              <Text
                fontSize="sm"
                color={useColorModeValue("ink.600", "whiteAlpha.700")}
              >
                @{user.username}
              </Text>
              <Badge
                fontSize="0.7rem"
                colorScheme="gray"
                borderRadius="full"
                px={2}
                py={0.5}
              >
                threads.net
              </Badge>
            </Flex>
          </Box>
          <Box>
            <Avatar
              name={user.name}
              src={user.profilePic || "https://bit.ly/broken-link"}
              size={{ base: "lg", md: "xl" }}
            ></Avatar>
          </Box>
        </Flex>
        {user.bio && (
          <Text mt={3} color={useColorModeValue("ink.600", "whiteAlpha.700")}>
            {user.bio}
          </Text>
        )}

        <Flex mt={4} gap={3} flexWrap="wrap">
          {currentUser?._id == user._id && (
            <>
              <Link as={RoutesLink} to="/update">
                <Button variant="solid">Update Profile</Button>
              </Link>
              <Button variant="outline" onClick={onOpenStory}>
                Story
              </Button>
            </>
          )}
          {currentUser?._id !== user._id && (
            <Button
              isLoading={updating}
              onClick={handleFollowAndUnfollow}
              variant={following ? "outline" : "solid"}
              colorScheme={following ? "gray" : "brand"}
            >
              {following ? "Unfollow" : "Follow"}
            </Button>
          )}
        </Flex>

        <Flex
          w="full"
          justifyContent="space-between"
          mt={4}
          flexWrap="wrap"
          gap={3}
        >
          <Flex gap={2} alignItems="center">
            <Text color={useColorModeValue("ink.500", "whiteAlpha.600")}>
              {user.followers.length} followers
            </Text>
            <Box
              w="1"
              h="1"
              bg={useColorModeValue("sand.400", "ink.600")}
              borderRadius="full"
            ></Box>
            <Link color={useColorModeValue("ink.500", "whiteAlpha.600")}>
              instagram.com
            </Link>
          </Flex>
          <Flex>
            <Box className="icon-container">
              <FaInstagram size={22} cursor={"pointer"} />
            </Box>
            <Box className="icon-container">
              <Menu>
                <MenuButton>
                  <CgMoreO size={22} cursor={"pointer"} />
                </MenuButton>
                <Portal>
                  <MenuList bg={useColorModeValue("white", "ink.800")}>
                    <MenuItem onClick={copyURL}>copy Link</MenuItem>
                  </MenuList>
                </Portal>
              </Menu>
            </Box>
          </Flex>
        </Flex>
      </Box>

      <Flex
        w="full"
        borderRadius="xl"
        bg={useColorModeValue("whiteAlpha.900", "blackAlpha.400")}
        border="1px solid"
        borderColor={useColorModeValue("sand.200", "ink.700")}
        overflow="hidden"
      >
        <Flex
          flex={1}
          borderBottom="2px solid"
          borderColor={
            activeTab === "threads"
              ? useColorModeValue("ink.900", "whiteAlpha.900")
              : "transparent"
          }
          justifyContent="center"
          py={3}
          cursor="pointer"
          onClick={() => onTabChange && onTabChange("threads")}
        >
          <Text
            fontWeight="bold"
            color={
              activeTab === "threads"
                ? useColorModeValue("ink.900", "whiteAlpha.900")
                : useColorModeValue("ink.500", "whiteAlpha.600")
            }
          >
            Threads
          </Text>
        </Flex>
        <Flex
          flex={1}
          borderBottom="2px solid"
          borderColor={
            activeTab === "replies"
              ? useColorModeValue("ink.900", "whiteAlpha.900")
              : "transparent"
          }
          justifyContent="center"
          py={3}
          cursor="pointer"
          onClick={() => onTabChange && onTabChange("replies")}
        >
          <Text
            fontWeight="bold"
            color={
              activeTab === "replies"
                ? useColorModeValue("ink.900", "whiteAlpha.900")
                : useColorModeValue("ink.500", "whiteAlpha.600")
            }
          >
            Replies
          </Text>
        </Flex>
        <Flex
          flex={1}
          borderBottom="2px solid"
          borderColor={
            activeTab === "saved"
              ? useColorModeValue("ink.900", "whiteAlpha.900")
              : "transparent"
          }
          justifyContent="center"
          py={3}
          cursor="pointer"
          onClick={() => onTabChange && onTabChange("saved")}
        >
          <Text
            fontWeight="bold"
            color={
              activeTab === "saved"
                ? useColorModeValue("ink.900", "whiteAlpha.900")
                : useColorModeValue("ink.500", "whiteAlpha.600")
            }
          >
            Saved
          </Text>
        </Flex>
        <Flex
          flex={1}
          borderBottom="2px solid"
          borderColor={
            activeTab === "reposts"
              ? useColorModeValue("ink.900", "whiteAlpha.900")
              : "transparent"
          }
          justifyContent="center"
          py={3}
          cursor="pointer"
          onClick={() => onTabChange && onTabChange("reposts")}
        >
          <Text
            fontWeight="bold"
            color={
              activeTab === "reposts"
                ? useColorModeValue("ink.900", "whiteAlpha.900")
                : useColorModeValue("ink.500", "whiteAlpha.600")
            }
          >
            Reposts
          </Text>
        </Flex>
      </Flex>
    </VStack>
  );
};

export default UserHeader;
