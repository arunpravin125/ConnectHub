import { Box, Button, Flex, Text, Spinner, Avatar } from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import { useRecoilValue } from "recoil";
import userAtom from "../atoms/userAtom";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useSocket } from "../context/SocketContext";
import { formatDistanceToNow } from "date-fns";

const SpacesPage = () => {
  const user = useRecoilValue(userAtom);
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchLiveSpaces();
  }, []);

  const fetchLiveSpaces = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/spaces/live");
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setSpaces(data.spaces || []);
    } catch (error) {
      console.error("Error fetching spaces:", error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSpace = async () => {
    if (!user) {
      toast.error("You must be logged in to create a space");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "My Space",
          description: "",
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Navigate to the space room
      navigate(`/spaces/${data._id}`);
    } catch (error) {
      console.error("Error creating space:", error);
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinSpace = (spaceId) => {
    navigate(`/spaces/${spaceId}`);
  };

  return (
    <Flex flexDirection="column" gap={4} p={4}>
      <Flex justifyContent="space-between" alignItems="center" mb={4}>
        <Text fontSize="2xl" fontWeight="bold">
          Live Spaces
        </Text>
        {user && (
          <Button
            colorScheme="blue"
            onClick={handleCreateSpace}
            isLoading={creating}
          >
            Create Space
          </Button>
        )}
      </Flex>

      {loading && (
        <Flex justify="center" py={8}>
          <Spinner size="xl" />
        </Flex>
      )}

      {!loading && spaces.length === 0 && (
        <Box textAlign="center" py={8}>
          <Text fontSize="lg" color="gray.500">
            No live spaces at the moment
          </Text>
          {user && (
            <Button mt={4} colorScheme="blue" onClick={handleCreateSpace}>
              Create the first space
            </Button>
          )}
        </Box>
      )}

      {!loading && spaces.length > 0 && (
        <Flex flexDirection="column" gap={3}>
          {spaces.map((space) => (
            <Box
              key={space._id}
              p={4}
              borderWidth="1px"
              borderRadius="md"
              cursor="pointer"
              onClick={() => handleJoinSpace(space._id)}
              _hover={{ bg: "gray.50", _dark: { bg: "gray.800" } }}
            >
              <Flex alignItems="center" gap={3}>
                <Avatar
                  size="md"
                  src={space.hostId?.profilePic}
                  name={space.hostId?.name}
                />
                <Flex flex={1} flexDirection="column">
                  <Text fontWeight="bold">
                    {space.title || "Untitled Space"}
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    Hosted by {space.hostId?.username || "Unknown"}
                  </Text>
                  {space.startedAt && (
                    <Text fontSize="xs" color="gray.400">
                      Started {formatDistanceToNow(new Date(space.startedAt))} ago
                    </Text>
                  )}
                </Flex>
                <Flex alignItems="center" gap={2}>
                  <Text fontSize="sm" color="gray.500">
                    {space.speakers?.length || 0} speakers
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    • {space.listeners?.length || 0} listeners
                  </Text>
                  {space.isRecording && (
                    <Box
                      bg="red.500"
                      color="white"
                      px={2}
                      py={1}
                      borderRadius="sm"
                      fontSize="xs"
                    >
                      Recording
                    </Box>
                  )}
                </Flex>
              </Flex>
            </Box>
          ))}
        </Flex>
      )}
    </Flex>
  );
};

export default SpacesPage;

