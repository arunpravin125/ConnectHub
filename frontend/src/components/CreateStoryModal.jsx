import {
  Box,
  Button,
  Flex,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
  Text,
  Textarea,
  useDisclosure,
} from "@chakra-ui/react";
import React, { useState, useRef } from "react";
import { BsFillImageFill, BsFillCameraVideoFill } from "react-icons/bs";
import usePrevMedia from "../hooks/usePrevMedia";
import { useRecoilValue } from "recoil";
import userAtom from "../atoms/userAtom";
import toast from "react-hot-toast";

const CreateStoryModal = ({ isOpen, onClose, onStoryCreated }) => {
  const user = useRecoilValue(userAtom);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const mediaInputRef = useRef(null);
  const {
    handleMediaChange,
    imageUrl,
    videoUrl,
    mediaType,
    isProcessing,
    resetMedia,
  } = usePrevMedia(false);

  const handleFileSelect = () => {
    mediaInputRef.current?.click();
  };

  const handleMediaSelected = (e) => {
    handleMediaChange(e);
  };

  const handleUpload = async () => {
    if (!imageUrl && !videoUrl) {
      toast.error("Please select an image or video");
      return;
    }

    if (!mediaType) {
      toast.error("Invalid media type");
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // Get base64 data
      const mediaData = imageUrl || videoUrl;
      if (!mediaData) {
        throw new Error("No media data available");
      }

      // Send as JSON with base64 (matching existing pattern)
      const response = await fetch("/api/stories/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mediaType,
          media: mediaData,
          caption: caption.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast.success("Story created successfully!");
      resetMedia();
      setCaption("");
      setUploadProgress(0);
      onStoryCreated();
    } catch (error) {
      console.error("Error creating story:", error);
      toast.error(error.message || "Failed to create story");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      resetMedia();
      setCaption("");
      setUploadProgress(0);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Create Story</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {!imageUrl && !videoUrl ? (
            <Flex
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              gap={4}
              py={8}
            >
              <Text>Select an image or video for your story</Text>
              <Flex gap={4}>
                <Button
                  leftIcon={<BsFillImageFill />}
                  onClick={handleFileSelect}
                  disabled={isProcessing}
                >
                  Image
                </Button>
                <Button
                  leftIcon={<BsFillCameraVideoFill />}
                  onClick={handleFileSelect}
                  disabled={isProcessing}
                >
                  Video
                </Button>
              </Flex>
              <input
                ref={mediaInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleMediaSelected}
                style={{ display: "none" }}
              />
            </Flex>
          ) : (
            <Flex flexDirection="column" gap={4}>
              {imageUrl && (
                <Image src={imageUrl} alt="Story preview" maxH="400px" objectFit="contain" />
              )}
              {videoUrl && (
                <Box>
                  <video
                    src={videoUrl}
                    controls
                    style={{ maxHeight: "400px", width: "100%" }}
                  />
                </Box>
              )}
              <Textarea
                placeholder="Add a caption (optional)"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={2200}
                rows={3}
              />
              {uploading && (
                <Box>
                  <Progress value={uploadProgress} colorScheme="blue" />
                  <Text fontSize="sm" mt={2} textAlign="center">
                    Uploading... {uploadProgress}%
                  </Text>
                </Box>
              )}
            </Flex>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          {(imageUrl || videoUrl) && (
            <Button
              colorScheme="blue"
              onClick={handleUpload}
              isLoading={uploading}
              disabled={isProcessing}
            >
              Share Story
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CreateStoryModal;

