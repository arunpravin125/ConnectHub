import { AddIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  CloseButton,
  Flex,
  FormControl,
  Image,
  Input,
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
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import usePrevMedia from "../hooks/usePrevMedia";
import { BsFillImageFill } from "react-icons/bs";
import { BsFillCameraVideoFill } from "react-icons/bs";
import { useRef } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import userAtom from "../atoms/userAtom";
import toast from "react-hot-toast";
import postsAtom from "../atoms/postsAtom";
import { useParams } from "react-router-dom";
import { useSocket } from "../context/SocketContext";

const MAX_CHAR = 500;

const CreatePost = () => {
  const user = useRecoilValue(userAtom);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [postText, setPostText] = useState("");
  const MediaRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const {
    handleMediaChange,
    imageUrl,
    videoUrl,
    mediaType,
    isProcessing,
    resetMedia,
  } = usePrevMedia(false);
  const [remainingChar, setRemainingChar] = useState(MAX_CHAR);
  const { username } = useParams();
  const [posts, setPosts] = useRecoilState(postsAtom);

  const { socket, onlineUsers } = useSocket();
  const [createdLivePost, setCreatedLivePost] = useState();

  const handleTextChange = (e) => {
    const inputText = e.target.value;
    if (inputText.length > MAX_CHAR) {
      const truncatedText = inputText.slice(0, MAX_CHAR);
      setPostText(truncatedText);
      setRemainingChar(0);
    } else {
      setPostText(inputText);
      setRemainingChar(MAX_CHAR - inputText.length);
    }
  };

  // Upload with progress tracking using XMLHttpRequest
  const uploadWithProgress = (url, data, onProgress) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const milestones = [10, 30, 50, 70, 90, 100];
      let lastMilestone = 0;

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);

          // Find the next milestone that we've reached
          const reachedMilestone = milestones.find(
            (milestone) =>
              percentComplete >= milestone && milestone > lastMilestone
          );

          if (reachedMilestone) {
            lastMilestone = reachedMilestone;
            onProgress(reachedMilestone);
          } else if (percentComplete === 100) {
            // Ensure 100% is always shown
            onProgress(100);
          } else if (percentComplete > lastMilestone) {
            // Update progress between milestones
            onProgress(percentComplete);
          }
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error("Failed to parse response"));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.error || "Upload failed"));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Network error during upload"));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error("Upload aborted"));
      });

      xhr.open("POST", url);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(JSON.stringify(data));
    });
  };

  const handleCreatePost = async () => {
    setLoading(true);
    setIsUploading(false);
    setUploadProgress(0);

    try {
      // Debug logging
      console.log("Creating post with:", {
        hasImage: !!imageUrl,
        hasVideo: !!videoUrl,
        videoUrlType: typeof videoUrl,
        videoUrlLength: videoUrl?.length,
        mediaType,
      });

      // Validate user is logged in
      if (!user || !user._id) {
        toast.error("Please log in to create a post");
        return;
      }

      // Validate that at least text or media is provided
      if (!postText.trim() && !imageUrl && !videoUrl) {
        toast.error("Please add text, image, or video to your post");
        return;
      }

      const requestBody = {
        postedBy: user._id,
        text: postText.trim() || "", // Ensure text is always a string (can be empty)
      };

      // Only include img if it exists
      if (imageUrl && imageUrl.trim() !== "") {
        requestBody.img = imageUrl;
      }

      // Only include video if it exists
      if (videoUrl && videoUrl.trim() !== "") {
        requestBody.video = videoUrl;
        console.log("Including video in request, length:", videoUrl.length);
        setIsUploading(true); // Show progress bar for video uploads
      } else {
        console.log("No video to include in request");
      }

      // Use XMLHttpRequest for video uploads to track progress, fetch for images
      let data;
      if (videoUrl && videoUrl.trim() !== "") {
        // Video upload with progress tracking
        data = await uploadWithProgress(
          "/api/posts/create",
          requestBody,
          (progress) => {
            setUploadProgress(progress);
            console.log(`Upload progress: ${progress}%`);
          }
        );
      } else {
        // Image upload without progress (faster)
        const res = await fetch("/api/posts/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });
        data = await res.json();
      }

      // Debug: Log the response to see if video field is present
      console.log("createdPost - Full response:", data);
      console.log(
        "createdPost - Has video:",
        !!data.video,
        "Video URL:",
        data.video
      );
      console.log("createdPost - Has img:", !!data.img, "Img URL:", data.img);
      console.log("createdPost - All keys:", Object.keys(data));

      socket.emit("livePost", { livePost: data });
      if (username == user.username) {
        // setPosts(data);
        setPosts([data, ...posts]);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setPostText("");
      resetMedia();
      setUploadProgress(0);
      setIsUploading(false);
      toast.success("Post created successfully");

      onClose();
    } catch (error) {
      console.log("error in createPost:", error.message);
      toast.error(error.message);
      setUploadProgress(0);
      setIsUploading(false);
    } finally {
      setLoading(false);
    }
  };

  //   useEffect(()=>{
  //     socket?.on("postLive",({livePost})=>{
  //      console.log("socketPostLive",livePost)
  //      if(livePost?.postedBy !== user?._id){
  //       setPosts((prev)=>[livePost,...prev]);
  //      }
  //     })
  //     // return ()=>socket?.off("postLive")
  // },[setPosts,socket])

  return (
    <>
      <Button
        onClick={onOpen}
        position={"fixed"}
        bottom={{ base: 6, md: 10 }}
        right={{ base: 4, md: 6 }}
        bg={useColorModeValue("white", "ink.800")}
        border="1px solid"
        borderColor={useColorModeValue("sand.200", "ink.700")}
        borderRadius="full"
        boxShadow="0 16px 30px -20px rgba(0, 0, 0, 0.6)"
        _hover={{ transform: "translateY(-2px)" }}
        transition="all 180ms ease"
      >
        <AddIcon size={{ base: "sm", sm: "md" }} />
      </Button>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />

        <ModalContent>
          <ModalHeader>Create Post</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl>
              <Textarea
                value={postText}
                onChange={handleTextChange}
                placeholder="Post content goes here.."
              ></Textarea>
              <Text
                fontSize="xs"
                fontWeight={"bold"}
                textAlign={"right"}
                m={"1"}
                color={"gray.800"}
              >
                {remainingChar}/{MAX_CHAR}
              </Text>
              <Input
                type={"file"}
                hidden
                ref={MediaRef}
                onChange={handleMediaChange}
                accept="image/*,video/mp4,video/webm,video/quicktime,video/x-msvideo,video/3gpp,video/3gp,.mp4,.webm,.mov,.avi,.3gp,.3gpp"
              ></Input>
              <Flex gap={3} alignItems="center" mt={2}>
                <Flex
                  gap={1}
                  alignItems="center"
                  cursor="pointer"
                  opacity={isProcessing ? 0.5 : 1}
                  onClick={() => !isProcessing && MediaRef.current?.click()}
                  _hover={{ opacity: 0.7 }}
                  title="Upload image or video"
                >
                  <BsFillImageFill size={18} color="gray.600" />
                  <BsFillCameraVideoFill size={18} color="gray.600" />
                  <Text fontSize="xs" color="gray.500" ml={1}>
                    Image / Video
                  </Text>
                </Flex>
                {isProcessing && (
                  <Text fontSize="xs" color="gray.500">
                    Processing...
                  </Text>
                )}
              </Flex>
            </FormControl>
            {imageUrl && (
              <Flex mt={5} w={"full"} position={"relative"}>
                <Image
                  src={imageUrl}
                  alt="selected media"
                  maxH="400px"
                  objectFit="contain"
                />
                <CloseButton
                  bg={"gray.800"}
                  position={"absolute"}
                  top={2}
                  right={2}
                  onClick={resetMedia}
                />
              </Flex>
            )}
            {videoUrl && (
              <Flex
                mt={5}
                w={"full"}
                position={"relative"}
                flexDirection="column"
              >
                <Box
                  as="video"
                  src={videoUrl}
                  controls
                  maxH="400px"
                  w="full"
                  borderRadius="md"
                />
                <CloseButton
                  bg={"gray.800"}
                  position={"absolute"}
                  top={2}
                  right={2}
                  onClick={resetMedia}
                />
                <Text fontSize="xs" color="gray.500" mt={2}>
                  Video preview -{" "}
                  {mediaType === "video" ? "Ready to upload" : ""}
                </Text>

                {/* Upload Progress Bar - Only show when uploading */}
                {isUploading && uploadProgress > 0 && (
                  <Box mt={3} w="full" p={3} bg="gray.50" borderRadius="md">
                    <Flex
                      justifyContent="space-between"
                      mb={2}
                      alignItems="center"
                    >
                      <Text
                        fontSize="sm"
                        color="gray.700"
                        fontWeight="semibold"
                      >
                        📤 Uploading video...
                      </Text>
                      <Text
                        fontSize="sm"
                        color="blue.600"
                        fontWeight="bold"
                        fontFamily="mono"
                      >
                        {uploadProgress}%
                      </Text>
                    </Flex>
                    <Progress
                      value={uploadProgress}
                      colorScheme="blue"
                      size="lg"
                      borderRadius="full"
                      isAnimated
                      hasStripe
                    />
                    <Flex justifyContent="space-between" mt={2}>
                      <Text fontSize="xs" color="gray.500">
                        {uploadProgress < 100
                          ? `Uploading... ${uploadProgress}%`
                          : "Processing video on server..."}
                      </Text>
                      {uploadProgress === 100 && (
                        <Text fontSize="xs" color="green.500" fontWeight="bold">
                          ✓ Upload complete
                        </Text>
                      )}
                    </Flex>
                  </Box>
                )}
              </Flex>
            )}
          </ModalBody>

          <ModalFooter>
            <Button
              colorScheme="blue"
              mr={3}
              onClick={handleCreatePost}
              isLoading={loading}
            >
              Post
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default CreatePost;
