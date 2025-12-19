import {
  Box,
  CloseButton,
  Flex,
  Image,
  Progress,
  Text,
  useColorModeValue,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  IconButton,
  useDisclosure,
} from "@chakra-ui/react";
import React, { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import { useRecoilValue } from "recoil";
import userAtom from "../atoms/userAtom";
import { FaPause, FaPlay } from "react-icons/fa";
import { AiOutlineDelete, AiOutlineEdit } from "react-icons/ai";

const StoryViewer = ({ userId, isOpen, onClose }) => {
  const [stories, setStories] = useState([]);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedProgress, setPausedProgress] = useState(0);
  const progressIntervalRef = useRef(null);
  const videoRef = useRef(null);
  const startTimeRef = useRef(null);
  const bg = useColorModeValue("black", "gray.900");
  const currentUser = useRecoilValue(userAtom);
  const {
    isOpen: isDeleteModalOpen,
    onOpen: onDeleteModalOpen,
    onClose: onDeleteModalClose,
  } = useDisclosure();

  useEffect(() => {
    if (!isOpen || !userId) return;

    const fetchUserStories = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/stories/user/${userId}`);
        const data = await res.json();

        if (data.error) {
          throw new Error(data.error);
        }

        setStories(data.stories || []);
        setCurrentStoryIndex(0);
        setProgress(0);
      } catch (error) {
        console.error("Error fetching user stories:", error);
        toast.error("Failed to load stories");
        onClose();
      } finally {
        setLoading(false);
      }
    };

    fetchUserStories();
  }, [isOpen, userId, onClose]);

  // Mark story as viewed when opened
  useEffect(() => {
    if (stories.length > 0 && currentStoryIndex < stories.length) {
      const currentStory = stories[currentStoryIndex];
      if (!currentStory.isViewedByMe) {
        // Mark as viewed
        fetch(`/api/stories/${currentStory.id}/view`, {
          method: "POST",
        }).catch((error) => {
          console.error("Error marking story as viewed:", error);
        });
      }
    }
    // Reset pause state when story changes
    setIsPaused(false);
    setPausedProgress(0);
  }, [stories, currentStoryIndex]);

  // Auto-advance progress
  useEffect(() => {
    if (!isOpen || stories.length === 0 || loading || isPaused) return;

    const currentStory = stories[currentStoryIndex];
    if (!currentStory) return;

    const isVideo = currentStory.mediaType === "video";
    const duration = isVideo ? 15000 : 5000; // 15s for video, 5s for image

    // Resume from paused progress if exists
    const startProgress = pausedProgress > 0 ? pausedProgress : 0;
    setProgress(startProgress);

    // Clear existing interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    // Start progress
    const startTime = Date.now() - (startProgress / 100) * duration;
    startTimeRef.current = startTime;
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);
      setPausedProgress(newProgress);

      if (newProgress >= 100) {
        clearInterval(progressIntervalRef.current);
        setPausedProgress(0);
        handleNext();
      }
    }, 50); // Update every 50ms for smooth progress

    // For videos, also listen to ended event and sync with video playback
    if (isVideo && videoRef.current) {
      const video = videoRef.current;
      const handleVideoEnd = () => {
        clearInterval(progressIntervalRef.current);
        setPausedProgress(0);
        handleNext();
      };
      const handleVideoTimeUpdate = () => {
        if (video.duration) {
          const videoProgress = (video.currentTime / video.duration) * 100;
          setProgress(videoProgress);
          setPausedProgress(videoProgress);
        }
      };
      video.addEventListener("ended", handleVideoEnd);
      video.addEventListener("timeupdate", handleVideoTimeUpdate);
      return () => {
        clearInterval(progressIntervalRef.current);
        video.removeEventListener("ended", handleVideoEnd);
        video.removeEventListener("timeupdate", handleVideoTimeUpdate);
      };
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isOpen, stories, currentStoryIndex, loading, isPaused, pausedProgress]);

  const handleNext = () => {
    setIsPaused(false);
    setPausedProgress(0);
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(currentStoryIndex + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    setIsPaused(false);
    setPausedProgress(0);
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(currentStoryIndex - 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handleTogglePause = (e) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    const newPausedState = !isPaused;
    setIsPaused(newPausedState);

    // Pause/resume video
    if (videoRef.current) {
      if (newPausedState) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch((err) => {
          console.error("Error playing video:", err);
        });
      }
    }

    // Clear progress interval when pausing
    if (newPausedState && progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
  };

  const handleClick = (e) => {
    // Don't navigate if clicking on buttons or controls
    if (
      e.target.closest("button") ||
      e.target.closest("[data-control]") ||
      e.target.closest("[data-menu]")
    ) {
      return;
    }

    const clickX = e.clientX;
    const windowWidth = window.innerWidth;
    const leftZone = windowWidth * 0.3;
    const rightZone = windowWidth * 0.7;

    // Left zone: previous
    if (clickX < leftZone) {
      handlePrev();
    }
    // Right zone: next
    else if (clickX > rightZone) {
      handleNext();
    }
    // Center zone: pause/resume
    else {
      handleTogglePause(e);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyPress = (e) => {
      // Prevent default spacebar scroll behavior
      if (e.key === " ") {
        e.preventDefault();
        handleTogglePause(e);
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isOpen, currentStoryIndex, stories.length, isPaused]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen || loading || stories.length === 0) {
    return null;
  }

  const currentStory = stories[currentStoryIndex];
  const isOwner =
    currentUser && currentStory
      ? currentStory.userId === currentUser._id ||
        currentStory.userId?._id === currentUser._id
      : false;

  const handleDeleteStory = async () => {
    if (!currentStory) return;
    try {
      const res = await fetch(`/api/stories/${currentStory.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const remaining = stories.filter((s) => s.id !== currentStory.id);
      if (remaining.length === 0) {
        onClose();
      } else {
        setStories(remaining);
        setCurrentStoryIndex((idx) =>
          idx >= remaining.length ? remaining.length - 1 : idx
        );
      }
      toast.success("Story deleted");
      onDeleteModalClose();
    } catch (error) {
      console.error("Error deleting story:", error);
      toast.error(error.message || "Failed to delete story");
    }
  };

  const handleEditCaption = async (e) => {
    e.stopPropagation();
    if (!currentStory) return;
    const newCaption = window.prompt(
      "Edit caption",
      currentStory.caption || ""
    );
    if (newCaption === null) return;
    if (newCaption.length > 2200) {
      toast.error("Caption must be 2200 characters or less");
      return;
    }
    try {
      const res = await fetch(`/api/stories/${currentStory.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ caption: newCaption }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setStories((prev) =>
        prev.map((s) =>
          s.id === currentStory.id ? { ...s, caption: data.story.caption } : s
        )
      );
      toast.success("Story updated");
    } catch (error) {
      console.error("Error updating story:", error);
      toast.error(error.message || "Failed to update story");
    }
  };

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg={bg}
      zIndex={9999}
      onClick={handleClick}
      cursor="pointer"
    >
      {/* Progress Bars */}
      <Flex
        position="absolute"
        top={0}
        left={0}
        right={0}
        gap={1}
        p={2}
        zIndex={10000}
      >
        {stories.map((story, index) => (
          <Box key={story.id} flex={1} position="relative">
            <Progress
              value={
                index < currentStoryIndex
                  ? 100
                  : index === currentStoryIndex
                  ? progress
                  : 0
              }
              colorScheme="whiteAlpha"
              bg="rgba(255,255,255,0.3)"
              height="3px"
              borderRadius="full"
            />
          </Box>
        ))}
      </Flex>

      {/* Close Button */}
      <CloseButton
        position="absolute"
        top={4}
        right={4}
        zIndex={10001}
        color="white"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />

      {/* Pause/Play Indicator */}
      {isPaused && (
        <Flex
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          zIndex={10001}
          pointerEvents="none"
        >
          <Box
            bg="rgba(0,0,0,0.6)"
            borderRadius="full"
            p={4}
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <FaPause size={32} color="white" />
          </Box>
        </Flex>
      )}

      {/* Story Media (centered card, smaller UI) */}
      <Flex
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        alignItems="center"
        justifyContent="center"
        pointerEvents="none"
      >
        <Box
          bg={useColorModeValue("white", "gray.800")}
          borderRadius="2xl"
          overflow="hidden"
          boxShadow="0 24px 60px rgba(0,0,0,0.65)"
          maxW={{ base: "90vw", md: "420px" }}
          w="full"
          pointerEvents="auto"
        >
          {currentStory.mediaType === "image" ? (
            <Image
              src={currentStory.mediaUrl}
              alt="Story"
              maxH="75vh"
              w="full"
              objectFit="cover"
            />
          ) : (
            <video
              ref={videoRef}
              src={currentStory.mediaUrl}
              autoPlay={!isPaused}
              playsInline
              style={{
                maxHeight: "75vh",
                width: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          )}
        </Box>
      </Flex>

      {/* Caption + owner controls */}
      <Box
        position="absolute"
        bottom={20}
        left={4}
        right={4}
        zIndex={10001}
        display="flex"
        justifyContent="space-between"
        alignItems="flex-end"
        pointerEvents="none"
      >
        {currentStory.caption && (
          <Text
            color="white"
            fontSize="sm"
            textShadow="0 1px 2px rgba(0,0,0,0.8)"
            maxW="70%"
            pointerEvents="auto"
          >
            {currentStory.caption}
          </Text>
        )}
        {isOwner && (
          <Flex gap={2} pointerEvents="auto" data-control>
            <IconButton
              aria-label="Edit caption"
              icon={<AiOutlineEdit />}
              size="sm"
              variant="ghost"
              colorScheme="whiteAlpha"
              color="white"
              onClick={handleEditCaption}
            />
            <IconButton
              aria-label="Delete story"
              icon={<AiOutlineDelete />}
              size="sm"
              variant="ghost"
              colorScheme="red"
              color="white"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteModalOpen();
              }}
            />
          </Flex>
        )}
      </Box>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={onDeleteModalClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Delete Story</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>
              Are you sure you want to delete this story? This action cannot be
              undone.
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onDeleteModalClose}>
              Cancel
            </Button>
            <Button colorScheme="red" onClick={handleDeleteStory}>
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Navigation Zones */}
      <Box
        position="absolute"
        left={0}
        top={0}
        bottom={0}
        w="30%"
        onClick={(e) => {
          e.stopPropagation();
          handlePrev();
        }}
        cursor="pointer"
        data-control
      />
      <Box
        position="absolute"
        right={0}
        top={0}
        bottom={0}
        w="30%"
        onClick={(e) => {
          e.stopPropagation();
          handleNext();
        }}
        cursor="pointer"
        data-control
      />
      {/* Center zone for pause/resume */}
      <Box
        position="absolute"
        left="30%"
        right="30%"
        top={0}
        bottom={0}
        onClick={handleTogglePause}
        cursor="pointer"
        data-control
      />
    </Box>
  );
};

export default StoryViewer;
