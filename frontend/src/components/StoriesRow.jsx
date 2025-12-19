import { Avatar, Box, Flex, Text, useColorModeValue } from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import { AddIcon } from "@chakra-ui/icons";
import { useRecoilValue } from "recoil";
import userAtom from "../atoms/userAtom";
import StoryViewer from "./StoryViewer";
import CreateStoryModal from "./CreateStoryModal";
import toast from "react-hot-toast";

const StoriesRow = () => {
  const user = useRecoilValue(userAtom);
  const [storiesFeed, setStoriesFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    const fetchStoriesFeed = async () => {
      try {
        const res = await fetch("/api/stories/feed");
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(errorData.error || `HTTP ${res.status}`);
        }

        const data = await res.json();

        if (data.error) {
          throw new Error(data.error);
        }

        setStoriesFeed(data.stories || []);
      } catch (error) {
        console.error("Error fetching stories feed:", error);
        // Don't show error toast - stories are optional
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchStoriesFeed();
      // Refresh every 30 seconds
      const interval = setInterval(fetchStoriesFeed, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleUserClick = (userId) => {
    setSelectedUserId(userId);
    setIsViewerOpen(true);
  };

  const handleCreateStory = () => {
    setIsCreateModalOpen(true);
  };

  const handleStoryCreated = () => {
    setIsCreateModalOpen(false);
    // Refresh stories feed
    const fetchStoriesFeed = async () => {
      try {
        const res = await fetch("/api/stories/feed");
        const data = await res.json();
        if (!data.error) {
          setStoriesFeed(data.stories || []);
        }
      } catch (error) {
        console.error("Error refreshing stories:", error);
      }
    };
    fetchStoriesFeed();
  };

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (!user) {
    return null;
  }

  return (
    <>
    <Box
      mb={6}
      p={{ base: 3, md: 4 }}
      border="1px solid"
      borderColor={useColorModeValue("sand.200", "ink.700")}
      bg={useColorModeValue("whiteAlpha.900", "blackAlpha.400")}
      borderRadius="2xl"
      backdropFilter="blur(10px)"
      boxShadow="0 18px 36px -30px rgba(0, 0, 0, 0.35)"
    >
      <Flex alignItems="center" justifyContent="space-between" mb={3}>
        <Text fontSize="sm" fontWeight="semibold" color={useColorModeValue("ink.700", "whiteAlpha.800")}>
          Stories
        </Text>
        <Text fontSize="xs" color={useColorModeValue("ink.500", "whiteAlpha.600")}>
          Tap to view
        </Text>
      </Flex>
      <Flex
        gap={4}
        overflowX="auto"
        pb={2}
        sx={{
            "&::-webkit-scrollbar": {
              height: "4px",
            },
            "&::-webkit-scrollbar-track": {
              background: "transparent",
            },
            "&::-webkit-scrollbar-thumb": {
              background: "gray.300",
              borderRadius: "2px",
            },
            "&::-webkit-scrollbar-thumb:hover": {
              background: "gray.400",
            },
          }}
        >
          {/* Your Story - Add Button */}
          <Flex
            flexDirection="column"
            alignItems="center"
            gap={2}
            minW="70px"
            cursor="pointer"
            onClick={handleCreateStory}
          >
            <Box position="relative">
              <Avatar
                size="md"
                name={user.name}
                src={user.profilePic}
                border="2px solid"
                borderColor={useColorModeValue("sand.300", "ink.600")}
              />
              <Box
                position="absolute"
                bottom={0}
                right={0}
                bg="brand.500"
                borderRadius="full"
                p={1}
                display="flex"
                alignItems="center"
                justifyContent="center"
                border="2px solid white"
                _dark={{ borderColor: "ink.800" }}
              >
                <AddIcon w={3} h={3} color="white" />
              </Box>
            </Box>
            <Text fontSize="xs" textAlign="center" noOfLines={1}>
              Your Story
            </Text>
          </Flex>

          {/* Other Users' Stories */}
          {storiesFeed.map((item) => (
            <Flex
              key={item.user.id}
              flexDirection="column"
              alignItems="center"
              gap={2}
              minW="70px"
              cursor="pointer"
              onClick={() => handleUserClick(item.user.id)}
            >
              <Box
                position="relative"
                p={item.hasUnviewed ? "3px" : "2px"}
                borderRadius="full"
                bgGradient={
                  item.hasUnviewed
                    ? "linear(to-r, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)"
                    : undefined
                }
                bg={item.hasUnviewed ? undefined : useColorModeValue("sand.300", "ink.600")}
              >
                <Avatar
                  size="md"
                  name={item.user.name}
                  src={item.user.avatarUrl}
                  border="2px solid"
                  borderColor={useColorModeValue("white", "ink.800")}
                />
              </Box>
              <Text fontSize="xs" textAlign="center" noOfLines={1}>
                {item.user.username}
              </Text>
            </Flex>
          ))}
        </Flex>
      </Box>

      {/* Story Viewer */}
      {isViewerOpen && selectedUserId && (
        <StoryViewer
          userId={selectedUserId}
          isOpen={isViewerOpen}
          onClose={() => {
            setIsViewerOpen(false);
            setSelectedUserId(null);
            // Refresh feed to update viewed status
            const fetchStoriesFeed = async () => {
              try {
                const res = await fetch("/api/stories/feed");
                const data = await res.json();
                if (!data.error) {
                  setStoriesFeed(data.stories || []);
                }
              } catch (error) {
                console.error("Error refreshing stories:", error);
              }
            };
            fetchStoriesFeed();
          }}
        />
      )}

      {/* Create Story Modal */}
      <CreateStoryModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onStoryCreated={handleStoryCreated}
      />
    </>
  );
};

export default StoriesRow;

