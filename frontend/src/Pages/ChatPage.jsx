import { SearchIcon } from "@chakra-ui/icons";
import {
  Avatar,
  Box,
  Button,
  Flex,
  Input,
  Skeleton,
  SkeletonCircle,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import React, { useEffect, useState, useRef } from "react";
import Conversation from "../components/Conversation";
import { GiConversation } from "react-icons/gi";
import MessageContainer from "../components/MessageContainer";
import { toast } from "react-hot-toast";
import {
  conversationAtom,
  selectedConversationAtom,
} from "../atoms/conversationAtom";
import { useRecoilState, useRecoilValue } from "recoil";
import userAtom from "../atoms/userAtom";
import { useSocket } from "../context/SocketContext";

const ChatPage = () => {
  const currentUser = useRecoilValue(userAtom ? userAtom : null);
  const [conversations, setConversations] = useRecoilState(conversationAtom);
  const [selectedConversation, setSelectedConversation] = useRecoilState(
    selectedConversationAtom
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchingUser, setSearchingUser] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const searchTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);

  const { socket, onlineUsers } = useSocket();
  console.log("conversations:", conversations);
  const surfaceBg = useColorModeValue("whiteAlpha.900", "blackAlpha.400");
  const surfaceBorder = useColorModeValue("sand.200", "ink.700");
  useEffect(() => {
    socket?.on("messagesSeen", ({ conversationId }) => {
      setConversations((prev) => {
        const updatedConversations = prev.map((conversation) => {
          if (conversation._id === conversationId) {
            return {
              ...conversation,
              lastMessage: {
                ...conversation.lastMessage,
                seen: true,
              },
            };
          }
          return conversation;
        });
        return updatedConversations;
      });
    });
  }, [socket, setConversations]);

  // Search suggestions with debounce
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If search is empty, clear suggestions
    if (search.trim() === "") {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Debounce search - wait 300ms after user stops typing
    searchTimeoutRef.current = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(
          `/api/users/search?query=${encodeURIComponent(search.trim())}`
        );
        const data = await res.json();

        if (data.error) {
          throw new Error(data.error);
        }

        setSearchSuggestions(data);
        setShowSuggestions(data.length > 0);
      } catch (error) {
        console.error("Error fetching search suggestions:", error);
        setSearchSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);

    // Cleanup function
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target) &&
        !event.target.closest("[data-suggestion-item]")
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const getConversation = async () => {
      try {
        const res = await fetch("/api/messages/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const data = await res.json();

        if (data.error) {
          throw new Error(data.error);
        }
        console.log("getConversations:", data);
        setConversations(data);
      } catch (error) {
        console.log("error in getMessage:", error.message);
        toast.error(error.message);
      } finally {
        setLoading(false);
      }
    };
    getConversation();
  }, [setConversations]);

  const handleSelectUser = async (user) => {
    setSearch("");
    setShowSuggestions(false);
    setSearchSuggestions([]);

    // user try to message self
    if (user._id === currentUser._id) {
      toast.error("You cannot message yourself");
      return;
    }

    // if user already in searched User conversation
    const existingConversation = conversations.find(
      (conversation) =>
        conversation &&
        conversation.participants &&
        conversation.participants.length > 0 &&
        conversation.participants[0] &&
        conversation.participants[0]._id === user._id
    );

    if (existingConversation) {
      setSelectedConversation({
        _id: existingConversation._id,
        userId: user._id,
        userProfilePic: user.profilePic,
        username: user.username,
      });
      return;
    }

    // Create new conversation
    const mockConversation = {
      mock: true,
      lastMessage: {
        text: "",
        sender: "",
      },
      _id: Date.now(),
      participants: [
        {
          _id: user._id,
          username: user.username,
          profiePic: user.profilePic,
        },
      ],
    };

    setConversations((prevConver) => [...prevConver, mockConversation]);
    setSelectedConversation({
      _id: mockConversation._id,
      userId: user._id,
      userProfilePic: user.profilePic,
      username: user.username,
    });
  };

  const handleConversation = async (e) => {
    e.preventDefault();
    if (!search.trim()) {
      return;
    }

    setSearchingUser(true);
    setShowSuggestions(false);

    try {
      const res = await fetch(`/api/users/profile/${search.trim()}`);
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      await handleSelectUser(data);
    } catch (error) {
      console.log("errorSearchingUser:", error.message);
      toast.error(error.message);
    } finally {
      setSearchingUser(false);
    }
  };

  return (
    <Box w="full">
      <Flex
        flexDirection={{ base: "column", lg: "row" }}
        gap={{ base: 6, lg: 8 }}
      >
        <Box
          flexShrink={0}
          w={{ base: "full", lg: "320px" }}
          bg={surfaceBg}
          border="1px solid"
          borderColor={surfaceBorder}
          borderRadius="2xl"
          p={{ base: 4, md: 5 }}
          backdropFilter="blur(10px)"
          boxShadow="0 20px 40px -30px rgba(0, 0, 0, 0.35)"
        >
          <Text
            fontWeight={700}
            fontSize="sm"
            color={useColorModeValue("ink.600", "whiteAlpha.700")}
            mb={3}
          >
            Your conversations
          </Text>
          <Box position="relative" w="full" mb={4}>
            <form onSubmit={handleConversation}>
              <Flex alignItems={"center"} gap={2}>
                <Box position="relative" flex={1}>
                  <Input
                    ref={searchInputRef}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => {
                      if (searchSuggestions.length > 0) {
                        setShowSuggestions(true);
                      }
                    }}
                    placeholder="Search for a user"
                    autoComplete="off"
                  />
                  {/* Search Suggestions Dropdown */}
                  {showSuggestions && (
                    <Box
                      position="absolute"
                      top="100%"
                      left={0}
                      right={0}
                      mt={1}
                      bg={useColorModeValue("white", "ink.800")}
                      border="1px solid"
                      borderColor={useColorModeValue("sand.200", "ink.700")}
                      borderRadius="lg"
                      boxShadow="lg"
                      zIndex={1000}
                      maxH="300px"
                      overflowY="auto"
                    >
                      {loadingSuggestions ? (
                        <Flex p={3} align="center" justify="center">
                          <Text fontSize="sm" color="gray.500">
                            Searching...
                          </Text>
                        </Flex>
                      ) : searchSuggestions.length === 0 ? (
                        <Flex p={3} align="center" justify="center">
                          <Text fontSize="sm" color="gray.500">
                            No users found
                          </Text>
                        </Flex>
                      ) : (
                        searchSuggestions.map((user) => (
                          <Flex
                            key={user._id}
                            data-suggestion-item
                            p={3}
                            align="center"
                            gap={3}
                            cursor="pointer"
                            _hover={{
                              bg: useColorModeValue("sand.100", "ink.700"),
                            }}
                            onClick={() => handleSelectUser(user)}
                            borderBottom="1px solid"
                            borderColor={useColorModeValue(
                              "sand.100",
                              "ink.700"
                            )}
                            _last={{ borderBottom: "none" }}
                          >
                            <Avatar
                              size="sm"
                              src={user.profilePic}
                              name={user.name}
                            />
                            <Box flex={1}>
                              <Text fontSize="sm" fontWeight="semibold">
                                {user.username}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                {user.name}
                              </Text>
                            </Box>
                          </Flex>
                        ))
                      )}
                    </Box>
                  )}
                </Box>
                <Button type="submit" size={"sm"} isLoading={searchingUser}>
                  <SearchIcon />
                </Button>
              </Flex>
            </form>
          </Box>
          {loading &&
            [0, 1, 2, 3, 4, 5].map((_, i) => (
              <Flex
                key={i}
                gap={4}
                align={"center"}
                p={"1"}
                borderRadius={"md"}
              >
                <Box>
                  <SkeletonCircle size={"10"} />
                </Box>
                <Flex w={"full"} flexDirection={"column"} gap={3}>
                  <Skeleton h={"10px"} w={"80px"} />
                  <Skeleton h={"8px"} w={"90%"} />
                </Flex>
              </Flex>
            ))}
          {!loading &&
            conversations
              .filter(
                (conversation) =>
                  conversation &&
                  conversation.participants &&
                  conversation.participants.length > 0 &&
                  conversation.participants[0] &&
                  conversation.participants[0]._id
              )
              .map((conversation) => {
                return (
                  <Conversation
                    key={conversation._id}
                    conversation={conversation}
                    isOnline={onlineUsers.includes(
                      conversation.participants[0]._id
                    )}
                  />
                );
              })}
        </Box>

        <Box
          flex="1"
          bg={surfaceBg}
          border="1px solid"
          borderColor={surfaceBorder}
          borderRadius="2xl"
          p={{ base: 4, md: 5 }}
          minH={{ base: "360px", md: "440px" }}
          backdropFilter="blur(10px)"
          boxShadow="0 20px 40px -30px rgba(0, 0, 0, 0.35)"
        >
          {!selectedConversation._id && (
            <Flex
              justifyContent={"center"}
              height={"100%"}
              flexDir={"column"}
              alignItems={"center"}
              textAlign="center"
              gap={2}
            >
              <GiConversation size={80} />
              <Text fontSize={18}>Select a conversation to start chatting</Text>
            </Flex>
          )}

          {selectedConversation._id && <MessageContainer />}
        </Box>
      </Flex>
    </Box>
  );
};

export default ChatPage;
