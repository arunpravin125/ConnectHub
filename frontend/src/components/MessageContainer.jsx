import {
  Avatar,
  Divider,
  Flex,
  Image,
  Skeleton,
  SkeletonCircle,
  Text,
  useColorModeValue,
  Button,
  Spinner,
} from "@chakra-ui/react";
import React, { useEffect, useRef, useState } from "react";
import Message from "./Message";
import MessageInput from "./MessageInput";
import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";
import {
  conversationAtom,
  selectedConversationAtom,
} from "../atoms/conversationAtom";
import toast from "react-hot-toast";
import userAtom from "../atoms/userAtom";
import { useSocket } from "../context/SocketContext";
import Conversation from "./Conversation";
// import messageSound from "../assets/sounds/message.mp3"

const MessageContainer = () => {
  const [selectedConversation, setSelectedConversation] = useRecoilState(
    selectedConversationAtom
  );
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [messages, setMessages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const currentUser = useRecoilValue(userAtom);
  const messageRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const setConversation = useSetRecoilState(conversationAtom);

  const {
    socket,
    selectedUserId,
    setSelectedUserId,
    toUser,
    setToUser,
    typing,
  } = useSocket();
  const [typingUsers, setTypingUsers] = useState(new Map()); // Map<userId, isTyping>

  // Listen for typing indicators from other users
  useEffect(() => {
    if (!socket || !selectedConversation?._id) return;

    const handleTyping = ({ chatId, userId, isTyping }) => {
      // Only handle typing for current conversation
      if (chatId !== selectedConversation._id) return;

      // Don't show typing indicator for current user
      if (userId === currentUser._id) return;

      console.log(
        `📝 Typing indicator: User ${userId} is ${
          isTyping ? "typing" : "not typing"
        } in chat ${chatId}`
      );

      setTypingUsers((prev) => {
        const newMap = new Map(prev);
        if (isTyping) {
          newMap.set(userId, true);
        } else {
          newMap.delete(userId);
        }
        return newMap;
      });
    };

    socket.on("chat:typing", handleTyping);

    // Clear typing users when conversation changes
    setTypingUsers(new Map());

    return () => {
      socket.off("chat:typing", handleTyping);
      setTypingUsers(new Map());
    };
  }, [socket, selectedConversation?._id, currentUser._id]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      console.log("📨 New message received via socket:", message);

      if (selectedConversation?._id === message?.conversationId) {
        setMessages((prevMess) => {
          // Check if message already exists to prevent duplicates
          // Compare by _id (handle both string and ObjectId)
          const messageExists = prevMess.some((msg) => {
            const msgId = msg._id?.toString();
            const newMsgId = message._id?.toString();
            return msgId === newMsgId;
          });
          if (messageExists) {
            console.log("⚠️ Message already exists, skipping duplicate");
            return prevMess;
          }
          console.log("✅ Message added to current conversation");
          return [...prevMess, message];
        });
      } else {
        console.log("ℹ️ Message is for a different conversation");
      }

      // if(!document.hasFocus()){
      //   const sound = new Audio(messageSound)
      //   sound.play()
      // }

      // Update conversation list for both sender and recipient
      setConversation((prev) => {
        const updatedConversations = prev.map((conversation) => {
          if (conversation._id == message.conversationId) {
            return {
              ...conversation,
              lastMessage: {
                text:
                  message.text ||
                  (message.img
                    ? "📷 Image"
                    : message.video
                    ? "🎥 Video"
                    : message.audio
                    ? "🎤 Audio"
                    : message.fileName
                    ? `📎 ${message.fileName}`
                    : ""),
                sender: message.sender,
              },
            };
          }
          return conversation;
        });
        return updatedConversations;
      });
    };

    socket.on("newMessage", handleNewMessage);

    // Handle delete for me event
    const handleDeletedForMe = ({ messageId, conversationId }) => {
      if (selectedConversation?._id === conversationId) {
        setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
      }
    };

    // Handle delete for everyone event
    const handleDeletedForAll = ({
      messageId,
      conversationId,
      tombstoneText,
    }) => {
      if (selectedConversation?._id === conversationId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId
              ? {
                  ...msg,
                  deletedForAll: true,
                  type: "tombstone",
                  text: null,
                  img: "",
                  video: "",
                  audio: "",
                  fileUrl: "",
                  fileName: "",
                  fileType: "",
                  tombstoneText: tombstoneText || "This message was deleted",
                }
              : msg
          )
        );
      }
    };

    socket.on("message:deleted_for_me", handleDeletedForMe);
    socket.on("message:deleted_for_all", handleDeletedForAll);

    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("message:deleted_for_me", handleDeletedForMe);
      socket.off("message:deleted_for_all", handleDeletedForAll);
    };
  }, [socket, selectedConversation, setConversation]);

  // Join/leave chat room for socket events
  useEffect(() => {
    if (!socket || !selectedConversation?._id) return;

    // Join the chat room
    socket.emit("chat:join", { chatId: selectedConversation._id });

    return () => {
      // Leave the chat room when conversation changes
      socket.emit("chat:leave", { chatId: selectedConversation._id });
    };
  }, [socket, selectedConversation?._id]);

  useEffect(() => {
    const lastMessageIsFromTheUser =
      messages.length &&
      messages[messages.length - 1].sender !== currentUser._id;
    if (lastMessageIsFromTheUser) {
      socket.emit("markMessagesAsSeen", {
        conversationId: selectedConversation?._id,
        userId: selectedConversation?.userId,
      });
    }
    socket.on("messagesSeen", ({ conversationId }) => {
      if (selectedConversation?._id == conversationId) {
        setMessages((prev) => {
          const updatedMessages = prev.map((message) => {
            if (!message.seen) {
              return {
                ...message,
                seen: true,
              };
            }
            return message;
          });
          return updatedMessages;
        });
      }
    });
  }, [socket, currentUser._id, messages, selectedConversation]);

  // Scroll to bottom when new messages arrive (but not when loading older messages)
  useEffect(() => {
    if (!loadingMore && messages.length > 0) {
      setTimeout(() => {
        messageRef?.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [messages.length, loadingMore]);

  // Load initial messages (page 1)
  useEffect(() => {
    const getMessages = async () => {
      try {
        if (selectedConversation.mock) return;
        setLoadingMessages(true);
        setCurrentPage(1);

        // For groups, use conversationId; for direct chats, use userId
        const isGroup =
          selectedConversation.isGroup || selectedConversation.type === "group";
        const url = isGroup
          ? `/api/messages/conversation/${
              selectedConversation.conversationId || selectedConversation._id
            }?page=1&limit=20`
          : `/api/messages/${selectedConversation.userId}?page=1&limit=20`;

        const res = await fetch(url);
        const data = await res.json();

        console.log("getMessage:", data);
        if (data.error) {
          throw new Error(data.error);
        }
        setMessages(data.messages || data); // Support both old and new response format
        setHasMore(data.pagination?.hasMore || false);
      } catch (error) {
        console.log("error in getMessgas", error.message);
        toast.error(error.message);
      } finally {
        setLoadingMessages(false);
      }
    };
    getMessages();
  }, [
    selectedConversation?.userId,
    selectedConversation?.conversationId,
    selectedConversation?._id,
    selectedConversation?.isGroup,
    selectedConversation?.type,
    setSelectedConversation,
    selectedConversation?.mock,
  ]);

  // Load more messages (older messages)
  const loadMoreMessages = async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);

      // Store current scroll position
      const container = messagesContainerRef.current;
      const scrollHeightBefore = container?.scrollHeight || 0;

      const nextPage = currentPage + 1;
      const isGroup =
        selectedConversation.isGroup || selectedConversation.type === "group";
      const url = isGroup
        ? `/api/messages/conversation/${
            selectedConversation.conversationId || selectedConversation._id
          }?page=${nextPage}&limit=20`
        : `/api/messages/${selectedConversation.userId}?page=${nextPage}&limit=20`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Prepend older messages to the beginning, filtering out duplicates
      const olderMessages = data.messages || [];
      setMessages((prev) => {
        const existingIds = new Set(prev.map((msg) => msg._id));
        const newMessages = olderMessages.filter(
          (msg) => !existingIds.has(msg._id)
        );
        return [...newMessages, ...prev];
      });
      setCurrentPage(nextPage);
      setHasMore(data.pagination?.hasMore || false);

      // Maintain scroll position after loading older messages
      setTimeout(() => {
        if (container) {
          const scrollHeightAfter = container.scrollHeight;
          const scrollDifference = scrollHeightAfter - scrollHeightBefore;
          container.scrollTop = scrollDifference;
        }
      }, 50);
    } catch (error) {
      console.log("error in loadMoreMessages", error.message);
      toast.error(error.message);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <Flex
      p={0}
      bg="transparent"
      borderRadius="none"
      flexDirection={"column"}
      flex={1}
      h="full"
    >
      {/* message header */}
      <Flex
        w={"full"}
        minH={12}
        alignItems={"center"}
        gap={2}
        mb={2}
        flexDirection="column"
      >
        <Flex w="full" alignItems={"center"} gap={2}>
          <Avatar
            src={
              selectedConversation.isGroup ||
              selectedConversation.type === "group"
                ? selectedConversation.groupIcon
                : selectedConversation.userProfilePic
            }
            size={"sm"}
          />
          <Flex alignItems={"center"} gap={4} flex={1}>
            <Flex
              alignItems={"center"}
              justifyContent={"center"}
              flexDirection="column"
              align="flex-start"
            >
              <Flex alignItems={"center"} gap={1}>
                <Text fontWeight="semibold">
                  {selectedConversation.isGroup ||
                  selectedConversation.type === "group"
                    ? selectedConversation.groupName || "Group"
                    : selectedConversation.username}
                </Text>
                {!(
                  selectedConversation.isGroup ||
                  selectedConversation.type === "group"
                ) && <Image src="/verified.png" w={4} h={4} ml={1} />}
              </Flex>
              {/* Group description or member count */}
              {(selectedConversation.isGroup ||
                selectedConversation.type === "group") && (
                <Text
                  fontSize="xs"
                  color={useColorModeValue("ink.600", "whiteAlpha.600")}
                >
                  {selectedConversation.groupDescription
                    ? selectedConversation.groupDescription
                    : selectedConversation.members
                    ? `${selectedConversation.members.length} members`
                    : ""}
                </Text>
              )}
            </Flex>

            {typingUsers.size > 0 && (
              <Flex
                position="relative"
                alignItems="center"
                justifyContent="center"
                gap={2}
              >
                <Text fontSize="sm" color="green.300">
                  {typingUsers.size === 1
                    ? `${
                        Array.from(typingUsers.keys())[0] === currentUser._id
                          ? "Someone"
                          : selectedConversation.username
                      } is typing...`
                    : `${typingUsers.size} people are typing...`}
                </Text>
                <Spinner size="xs" color="green.300" />
              </Flex>
            )}
          </Flex>
        </Flex>
        {/* Group members list (if group) */}
        {(selectedConversation.isGroup ||
          selectedConversation.type === "group") &&
          selectedConversation.members &&
          selectedConversation.members.length > 0 && (
            <Flex w="full" gap={1} flexWrap="wrap" mt={1}>
              {selectedConversation.members.slice(0, 10).map((member) => (
                <Text
                  key={member.userId?._id || member.userId}
                  fontSize="xs"
                  color={useColorModeValue("ink.500", "whiteAlpha.500")}
                >
                  {member.userId?.username || member.userId}
                  {member.role === "admin" && " (admin)"}
                  {selectedConversation.members.indexOf(member) <
                    selectedConversation.members.length - 1 &&
                    selectedConversation.members.indexOf(member) < 9 &&
                    ", "}
                </Text>
              ))}
              {selectedConversation.members.length > 10 && (
                <Text
                  fontSize="xs"
                  color={useColorModeValue("ink.500", "whiteAlpha.500")}
                >
                  +{selectedConversation.members.length - 10} more
                </Text>
              )}
            </Flex>
          )}
      </Flex>
      <Divider />

      <Flex
        flexDir={"column"}
        height={{ base: "360px", md: "420px" }}
        p={2}
        overflowY={"auto"}
        gap={4}
        my={4}
        ref={messagesContainerRef}
        position="relative"
      >
        {/* Load More Button */}
        {!loadingMessages && hasMore && (
          <Flex justifyContent="center" py={2}>
            <Button
              size="sm"
              colorScheme="brand"
              variant="outline"
              onClick={loadMoreMessages}
              isLoading={loadingMore}
              loadingText="Loading..."
            >
              Load Older Messages
            </Button>
          </Flex>
        )}

        {loadingMore && (
          <Flex justifyContent="center" py={2}>
            <Spinner size="sm" />
          </Flex>
        )}

        {loadingMessages &&
          [...Array(5)].map((_, i) => {
            return (
              <Flex
                key={i}
                gap={2}
                alignItems={"center"}
                p={1}
                alignSelf={i % 2 == 0 ? "flex-start" : "flex-end"}
                borderRadius={"md"}
              >
                {i % 2 == 0 && <SkeletonCircle size={7} />}
                <Flex gap={2} flexDirection={"column"}>
                  <Skeleton h="8px" w="250px" />
                  <Skeleton h="8px" w="250px" />
                  <Skeleton h="8px" w="250px" />
                </Flex>
                {i % 2 !== 0 && <SkeletonCircle size={7} />}
              </Flex>
            );
          })}
        {!loadingMessages &&
          messages.map((message, index) => (
            <Flex
              key={`${message._id}-${index}`}
              direction="column"
              ref={messages.length - 1 === index ? messageRef : null}
            >
              <Message
                message={message}
                ownMessage={currentUser._id === message.sender}
                onDelete={(messageId, deleteType) => {
                  if (deleteType === "me") {
                    // Remove message from list
                    setMessages((prev) =>
                      prev.filter((msg) => msg._id !== messageId)
                    );
                  } else if (deleteType === "everyone") {
                    // Update message to tombstone
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg._id === messageId
                          ? {
                              ...msg,
                              deletedForAll: true,
                              type: "tombstone",
                              text: null,
                              img: "",
                              video: "",
                              audio: "",
                              fileUrl: "",
                              fileName: "",
                              fileType: "",
                              tombstoneText: "This message was deleted",
                            }
                          : msg
                      )
                    );
                  }
                }}
              />
            </Flex>
          ))}
      </Flex>
      <MessageInput setMessages={setMessages} />
    </Flex>
  );
};

export default MessageContainer;
