import {
  Avatar,
  Flex,
  Image,
  Stack,
  AvatarBadge,
  Text,
  useColorModeValue,
  WrapItem,
  Box,
  Badge,
} from "@chakra-ui/react";
import React from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import userAtom from "../atoms/userAtom";
import { BsCheck2All, BsFillImageFill } from "react-icons/bs";
import { FaUsers } from "react-icons/fa";
import { selectedConversationAtom } from "../atoms/conversationAtom";

const Conversation = ({ conversation, isOnline }) => {
  const currentUser = useRecoilValue(userAtom);

  const isGroup = conversation?.type === "group";
  const user = isGroup ? null : conversation?.participants?.[0];
  const lastMessage = conversation?.lastMessage;
  const [selectedConversation, setSelectedConversation] = useRecoilState(
    selectedConversationAtom
  );

  const handleClick = () => {
    if (isGroup) {
      setSelectedConversation({
        _id: conversation._id,
        conversationId: conversation._id,
        isGroup: true,
        type: "group",
        groupName: conversation.name,
        groupDescription: conversation.description,
        groupIcon: conversation.iconUrl,
        members: conversation.members || [],
        createdBy: conversation.createdBy,
      });
    } else {
      setSelectedConversation({
        _id: conversation._id,
        userId: user?._id,
        username: user?.username,
        userProfilePic: user?.profilePic,
        mock: conversation.mock,
      });
    }
  };

  return (
    <Flex
      gap={4}
      alignItems={"center"}
      p={2}
      _hover={{
        cursor: "pointer",
        bg: useColorModeValue("sand.100", "ink.700"),
      }}
      onClick={handleClick}
      bg={
        selectedConversation?._id == conversation?._id
          ? useColorModeValue("sand.200", "ink.700")
          : "transparent"
      }
      borderRadius="lg"
    >
      <WrapItem>
        <Avatar
          size={{
            base: "xs",
            sm: "sm",
            md: "md",
          }}
          src={isGroup ? conversation.iconUrl : user?.profilePic}
          icon={isGroup ? <FaUsers /> : undefined}
        >
          {!isGroup && isOnline ? (
            <AvatarBadge boxSize={"1em"} bg="green.500"></AvatarBadge>
          ) : (
            ""
          )}
        </Avatar>
      </WrapItem>
      <Stack direction={"column"} fontSize={"sm"} flex={1}>
        <Box fontWeight={"700"} display={"flex"} alignItems={"center"} gap={1}>
          {isGroup ? (
            <>
              {conversation.name || "Group"}
              <Badge fontSize="0.6rem" colorScheme="brand" ml={1}>
                Group
              </Badge>
            </>
          ) : (
            <>
              {user?.username}
              <Image src="/verified.png" w={4} h={4} ml={1} />
            </>
          )}
        </Box>
        <Box fontSize={"xs"} display={"flex"} alignItems={"center"} gap={1}>
          {!isGroup && currentUser._id == lastMessage?.sender ? (
            <Box color={lastMessage?.seen ? "blue.400" : ""}>
              <BsCheck2All size={16} />
            </Box>
          ) : (
            ""
          )}

          {lastMessage?.text && lastMessage.text.length > 18
            ? lastMessage.text.substring(0, 18) + "..."
            : lastMessage?.text || <BsFillImageFill size={16} />}
        </Box>
      </Stack>
    </Flex>
  );
};

export default Conversation;
