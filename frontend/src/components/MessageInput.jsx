import {
  Box,
  Flex,
  Image,
  Input,
  InputGroup,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Progress,
  Spinner,
  Text,
  useDisclosure,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton,
} from "@chakra-ui/react";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { IoSendSharp } from "react-icons/io5";
import { useRecoilValue, useSetRecoilState } from "recoil";
import {
  conversationAtom,
  selectedConversationAtom,
} from "../atoms/conversationAtom";
import toast from "react-hot-toast";
import { BsFillImageFill } from "react-icons/bs";
import { BsFillCameraVideoFill } from "react-icons/bs";
import { BsFileEarmark } from "react-icons/bs";
import { FaMicrophone, FaStop } from "react-icons/fa";
import { FiMoreHorizontal } from "react-icons/fi";
import usePrevMedia from "../hooks/usePrevMedia";
import { useSocket } from "../context/SocketContext";

const MessageInput = ({ setMessages }) => {
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(false);
  const selectedConversation = useRecoilValue(selectedConversationAtom);
  const setConversation = useSetRecoilState(conversationAtom);
  const {
    socket,
    typing,
    setTyping,
    selectedUserId,
    setSelectedUserId,
    toUser,
    setToUser,
  } = useSocket();
  const {
    handleMediaChange,
    imageUrl,
    videoUrl,
    mediaType,
    isProcessing,
    resetMedia,
  } = usePrevMedia(true); // true for chat
  const { onClose } = useDisclosure();
  const [isSending, setIsSending] = useState(false);
  const MediaRef = useRef(null);
  const FileRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  
  // Typing indicator state and refs
  const [isMeTyping, setIsMeTyping] = useState(false);
  const lastStartEmitRef = useRef(0);
  const stopTimerRef = useRef(null);
  const currentChatIdRef = useRef(null);

  // Upload with progress tracking using XMLHttpRequest
  const uploadWithProgress = (url, formData, onProgress) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const milestones = [10, 30, 50, 70, 90, 100];
      let lastMilestone = 0;
      
      // Set timeout to 5 minutes (300000ms) for large audio files
      xhr.timeout = 300000; // 5 minutes

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
            onProgress(100);
          } else if (percentComplete > lastMilestone) {
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
      
      xhr.addEventListener("timeout", () => {
        reject(new Error("Upload timeout - file may be too large or connection too slow"));
      });

      xhr.open("POST", url);
      // Don't set Content-Type - browser will set it with boundary for FormData
      xhr.send(formData);
    });
  };

  // Helper function to get user-friendly error message for microphone access
  const getMicrophoneErrorMessage = (error) => {
    if (!error) return "Failed to access microphone";
    
    const errorName = error.name || "";
    const errorMessage = error.message || "";

    // Check if it's a secure context issue
    const isSecureContext = window.isSecureContext || 
      window.location.protocol === 'https:' || 
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1';

    if (!isSecureContext) {
      return "Microphone access requires HTTPS. Please access this site via HTTPS or use localhost. For network access, you need to set up SSL/TLS.";
    }

    if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
      return "Microphone permission denied. Please allow microphone access in your browser settings and try again.";
    } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
      return "No microphone found. Please connect a microphone and try again.";
    } else if (errorName === "NotReadableError" || errorName === "TrackStartError") {
      return "Microphone is already in use by another application. Please close other apps using the microphone.";
    } else if (errorName === "OverconstrainedError" || errorName === "ConstraintNotSatisfiedError") {
      return "Microphone doesn't support required settings. Please try a different microphone.";
    } else if (errorName === "TypeError" && (errorMessage.includes("getUserMedia") || errorMessage.includes("secure context"))) {
      return "Microphone access requires HTTPS. Please access this site via HTTPS or use localhost.";
    } else {
      return `Failed to access microphone: ${errorMessage || errorName}`;
    }
  };

  // Check if getUserMedia is available and if we're in a secure context
  const checkMediaDevicesSupport = () => {
    // Check if we're in a secure context (HTTPS or localhost)
    const isSecureContext = window.isSecureContext || 
      window.location.protocol === 'https:' || 
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1';

    if (!isSecureContext) {
      return {
        supported: false,
        message: "Microphone access requires HTTPS. Please access this site via HTTPS or use localhost. For network access, you need to set up SSL/TLS."
      };
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return {
        supported: false,
        message: "Your browser doesn't support microphone access. Please use a modern browser (Chrome, Firefox, Safari, Edge)."
      };
    }
    return { supported: true };
  };

  const startRecording = async () => {
    try {
      // Check browser support
      const support = checkMediaDevicesSupport();
      if (!support.supported) {
        toast.error(support.message, { duration: 5000 });
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length === 0) {
          console.error("No audio data recorded");
          toast.error("No audio recorded. Please try again.");
          stream.getTracks().forEach((track) => track.stop());
          setIsRecording(false);
          if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
          }
          return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm;codecs=opus" });
        
        // Validate blob size (min 1KB, max 20MB)
        if (audioBlob.size < 1024) {
          console.error("Audio blob too small:", audioBlob.size);
          toast.error("Recording too short. Please record again.");
          stream.getTracks().forEach((track) => track.stop());
          setIsRecording(false);
          if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
          }
          return;
        }
        
        if (audioBlob.size > 20 * 1024 * 1024) {
          console.error("Audio blob too large:", audioBlob.size);
          toast.error("Recording too large. Maximum 20MB allowed.");
          stream.getTracks().forEach((track) => track.stop());
          setIsRecording(false);
          if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
          }
          return;
        }
        
        const url = URL.createObjectURL(audioBlob);
        setAudioBlob(audioBlob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
        console.log("Audio recorded successfully. Size:", audioBlob.size, "bytes");
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer - use local counter for reliable updates
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      
      let timeElapsed = 0;
      recordingTimerRef.current = setInterval(() => {
        timeElapsed += 1;
        setRecordingTime(timeElapsed);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      const errorMessage = getMicrophoneErrorMessage(error);
      toast.error(errorMessage, { duration: 5000 });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    audioChunksRef.current = [];
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText && !imageUrl && !videoUrl && !selectedFile && !audioBlob) return;
    if (isSending || isProcessing) return;
    
    setLoading(true);
    setIsSending(true);
    
    try {
      let data;
      
      // If file is selected, use FormData with progress tracking
      if (selectedFile) {
        setIsUploading(true);
        setUploadProgress(0);
        
        const formData = new FormData();
        formData.append("recipientId", selectedConversation.userId);
        formData.append("message", messageText);
        formData.append("file", selectedFile);
        
        data = await uploadWithProgress(
          "/api/messages/",
          formData,
          (progress) => {
            setUploadProgress(progress);
            console.log(`Upload progress: ${progress}%`);
          }
        );
        
        setIsUploading(false);
        setUploadProgress(0);
        setSelectedFile(null);
      } else if (audioBlob) {
        // Handle audio recording
        // Validate audio blob before sending
        if (!audioBlob || audioBlob.size === 0) {
          throw new Error("Invalid audio recording. Please record again.");
        }
        
        if (audioBlob.size > 20 * 1024 * 1024) {
          throw new Error("Audio file too large. Maximum 20MB allowed.");
        }
        
        setIsUploading(true);
        setUploadProgress(0);
        
        try {
          const formData = new FormData();
          formData.append("recipientId", selectedConversation.userId);
          formData.append("message", messageText || "");
          
          // Create a File object with proper MIME type
          const audioFile = new File([audioBlob], "audio.webm", { 
            type: "audio/webm;codecs=opus" 
          });
          formData.append("file", audioFile);
          
          console.log("Sending audio file. Size:", audioFile.size, "Type:", audioFile.type);
          
          data = await uploadWithProgress(
            "/api/messages/",
            formData,
            (progress) => {
              setUploadProgress(progress);
              console.log(`Upload progress: ${progress}%`);
            }
          );
          
          setIsUploading(false);
          setUploadProgress(0);
          setAudioBlob(null);
          setAudioUrl(null);
          setRecordingTime(0);
          if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
          }
        } catch (uploadError) {
          setIsUploading(false);
          setUploadProgress(0);
          throw uploadError;
        }
      } else {
        // Use JSON for base64 images/videos (legacy support)
        const res = await fetch("/api/messages/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipientId: selectedConversation.userId,
            message: messageText,
            img: imageUrl || null,
            video: videoUrl || null,
          }),
        });
        data = await res.json();
      }

      if (data.error) {
        throw new Error(data.error);
      }

      console.log("sendMessage:", data);

      // Add message optimistically, but socket event will handle it too
      // The duplicate check in MessageContainer will prevent duplicates
      setMessages((messages) => {
        // Check if message already exists to prevent duplicates
        const messageExists = messages.some((msg) => msg._id === data._id);
        if (messageExists) {
          return messages;
        }
        return [...messages, data];
      });
      setConversation((prevConversation) => {
        const updatedConversation = prevConversation.map((conversation) => {
          if (conversation._id == selectedConversation._id) {
            return {
              ...conversation,
              lastMessage: {
                text: messageText || (data.img ? "📷 Image" : data.video ? "🎥 Video" : data.audio ? "🎤 Audio" : data.fileName ? `📎 ${data.fileName}` : ""),
                sender: data.sender,
              },
            };
          }
          return conversation;
        });
        return updatedConversation;
      });
      setMessageText("");
      resetMedia();
      setTyping(null);
      // Stop typing when message is sent
      stopTyping();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
    } catch (error) {
      console.log("error in sendMessage:", error.message);
      toast.error(error.message);
      setIsUploading(false);
      setUploadProgress(0);
    } finally {
      setLoading(false);
      setIsSending(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      "image/",
      "video/",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    const isValidType =
      allowedTypes.some((type) => file.type.startsWith(type)) ||
      file.type === "application/pdf" ||
      file.type === "application/msword" ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    if (!isValidType) {
      toast.error("Only images, videos, PDF, DOC, and DOCX files are allowed");
      return;
    }

    // Validate file size (20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File size must be less than 20MB");
      return;
    }

    setSelectedFile(file);
  };

  // Join/leave chat room when conversation changes
  useEffect(() => {
    if (!socket || !selectedConversation?._id) return;

    const chatId = selectedConversation._id;
    
    // Leave previous chat room if switching
    if (currentChatIdRef.current && currentChatIdRef.current !== chatId) {
      socket.emit("chat:leave", { chatId: currentChatIdRef.current });
      // Stop typing in previous chat
      if (isMeTyping) {
        socket.emit("chat:typing_stop", { chatId: currentChatIdRef.current });
        setIsMeTyping(false);
      }
      // Clear timers
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
    }

    // Join new chat room
    socket.emit("chat:join", { chatId });
    currentChatIdRef.current = chatId;

    return () => {
      // Leave room on unmount or conversation change
      if (currentChatIdRef.current) {
        socket.emit("chat:leave", { chatId: currentChatIdRef.current });
        if (isMeTyping) {
          socket.emit("chat:typing_stop", { chatId: currentChatIdRef.current });
        }
      }
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
      }
    };
  }, [socket, selectedConversation?._id, isMeTyping]);

  // Typing indicator handler
  const startTyping = () => {
    if (!socket || !selectedConversation?._id) return;
    
    const chatId = selectedConversation._id;
    const now = Date.now();
    
    // Emit typing_start only if not already typing OR if last emit > 2.5s
    if (!isMeTyping || (now - lastStartEmitRef.current > 2500)) {
      socket.emit("chat:typing_start", { chatId });
      lastStartEmitRef.current = now;
      setIsMeTyping(true);
    }

    // Clear existing stop timer
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
    }

    // Schedule typing stop after 900ms of inactivity
    stopTimerRef.current = setTimeout(() => {
      socket.emit("chat:typing_stop", { chatId });
      setIsMeTyping(false);
      stopTimerRef.current = null;
    }, 900);
  };

  const stopTyping = () => {
    if (!socket || !selectedConversation?._id || !isMeTyping) return;
    
    const chatId = selectedConversation._id;
    
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    
    socket.emit("chat:typing_stop", { chatId });
    setIsMeTyping(false);
  };

  // Handle typing on input change
  useEffect(() => {
    if (!socket || !selectedConversation?._id) return;

    if (messageText && messageText.trim().length > 0) {
      startTyping();
    } else {
      // Input cleared - stop typing immediately
      stopTyping();
    }

    return () => {
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
      }
    };
  }, [socket, messageText, selectedConversation?._id]);

  // Listen for typing indicators from others
  useEffect(() => {
    if (!socket) return;

    const handleCurrentTyping = ({ typing }) => {
      console.log("📝 Typing indicator received:", typing);
      setTyping(typing);
    };

    const handleCurrentUserId = ({ conversationId }) => {
      console.log("👤 Current user ID received for conversation:", conversationId);
      if (selectedConversation?._id == conversationId) {
        setToUser(conversationId);
      }
    };

    socket.on("currentTyping", handleCurrentTyping);
    socket.on("currentUserId", handleCurrentUserId);

    return () => {
      socket.off("currentTyping", handleCurrentTyping);
      socket.off("currentUserId", handleCurrentUserId);
    };
  }, [socket, selectedConversation?._id, setTyping, setToUser]);


  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl, isRecording]);

  return (
    <Flex gap={2} alignItems={"center"}>
      <form onSubmit={handleSendMessage} style={{ flex: 95 }}>
        <InputGroup>
          <Input
            w={"full"}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type a Message"
          ></Input>
          <InputRightElement _disabled={loading} onClick={handleSendMessage}>
            {loading ? (
              <Spinner
                thickness="4px"
                speed="0.65s"
                emptyColor="gray.200"
                color="blue.500"
                size="xs"
              />
            ) : (
              <IoSendSharp color="green.500" />
            )}
          </InputRightElement>
        </InputGroup>
      </form>
      <Flex flex={5} cursor={"pointer"} gap={2} alignItems="center">
        {!isRecording ? (
          <FaMicrophone
            size={20}
            onClick={() => {
              if (!isProcessing && !isUploading && !isRecording) {
                startRecording();
              }
            }}
            opacity={isProcessing || isUploading ? 0.5 : 1}
            title="Push to talk"
            color={isRecording ? "red" : "gray"}
          />
        ) : (
          <FaStop
            size={20}
            onClick={stopRecording}
            color="red"
            title="Stop recording"
          />
        )}
        <Menu>
          <MenuButton
            as={IconButton}
            aria-label="More attach options"
            icon={<FiMoreHorizontal />}
            size="sm"
            variant="ghost"
            isDisabled={isProcessing || isUploading || isRecording}
          />
          <MenuList>
            <MenuItem
              icon={<BsFillImageFill />}
              onClick={() => {
                if (!isProcessing && !isUploading && !isRecording) {
                  // Allow only images
                  if (MediaRef.current) {
                    MediaRef.current.accept = "image/*";
                  }
                  MediaRef.current?.click();
                }
              }}
            >
              Picture
            </MenuItem>
            <MenuItem
              icon={<BsFillCameraVideoFill />}
              onClick={() => {
                if (!isProcessing && !isUploading && !isRecording) {
                  // Allow only videos
                  if (MediaRef.current) {
                    MediaRef.current.accept =
                      "video/mp4,video/webm,video/quicktime,video/x-msvideo,video/3gpp,video/3gp,.mp4,.webm,.mov,.avi,.3gp,.3gpp";
                  }
                  MediaRef.current?.click();
                }
              }}
            >
              Video
            </MenuItem>
            <MenuItem
              icon={<BsFileEarmark />}
              onClick={() => {
                if (!isProcessing && !isUploading && !isRecording) {
                  FileRef.current?.click();
                }
              }}
            >
              Document
            </MenuItem>
          </MenuList>
        </Menu>
        {(isProcessing || isUploading) && <Spinner size="xs" />}
        {isRecording && (
          <Text fontSize="xs" color="red.500" fontWeight="bold">
            {formatTime(recordingTime)}
          </Text>
        )}
        <Input
          type={"file"}
          hidden
          ref={MediaRef}
          onChange={handleMediaChange}
          accept="image/*,video/mp4,video/webm,video/quicktime,video/x-msvideo,video/3gpp,video/3gp,.mp4,.webm,.mov,.avi,.3gp,.3gpp"
        />
        <Input
          type={"file"}
          hidden
          ref={FileRef}
          onChange={handleFileChange}
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        />
      </Flex>
      <Modal
        isOpen={!!(imageUrl || videoUrl || selectedFile || audioUrl)}
        onClose={() => {
          onClose();
          resetMedia();
          setSelectedFile(null);
          cancelRecording();
        }}
      >
        <ModalOverlay />
        <ModalContent maxW="90vw" maxH="90vh">
          <ModalHeader>
            {audioUrl
              ? "Audio Preview"
              : selectedFile
              ? "File Preview"
              : mediaType === "video"
              ? "Video Preview"
              : "Image Preview"}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {imageUrl && (
              <Flex mt={5} w={"full"} justifyContent="center">
                <Image src={imageUrl} maxH="60vh" objectFit="contain" />
              </Flex>
            )}
            {videoUrl && (
              <Flex
                mt={5}
                w={"full"}
                justifyContent="center"
                flexDirection="column"
              >
                <Box
                  as="video"
                  src={videoUrl}
                  controls
                  maxH="60vh"
                  maxW="full"
                  borderRadius="md"
                />
                <Text fontSize="xs" color="gray.500" mt={2} textAlign="center">
                  Video will be compressed for chat (max 60 seconds)
                </Text>
              </Flex>
            )}
            {audioUrl && (
              <Flex
                mt={5}
                w={"full"}
                justifyContent="center"
                flexDirection="column"
                gap={3}
              >
                <Box
                  p={4}
                  border="1px solid"
                  borderColor="gray.300"
                  borderRadius="md"
                  bg="gray.50"
                >
                  <Flex alignItems="center" gap={3} mb={3}>
                    <FaMicrophone size={32} color="red" />
                    <Box flex={1}>
                      <Text fontWeight="semibold">Voice Message</Text>
                      <Text fontSize="xs" color="gray.500">
                        {formatTime(recordingTime)} • {(audioBlob?.size / 1024).toFixed(2)} KB
                      </Text>
                    </Box>
                  </Flex>
                  <Box as="audio" src={audioUrl} controls w="full" />
                </Box>
                {isUploading && (
                  <Box w="full" p={3} bg="gray.50" borderRadius="md">
                    <Flex justifyContent="space-between" mb={2} alignItems="center">
                      <Text fontSize="sm" color="gray.700" fontWeight="semibold">
                        📤 Uploading...
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
                    <Text fontSize="xs" color="gray.500" mt={2}>
                      {uploadProgress < 100
                        ? `Uploading... ${uploadProgress}%`
                        : "Processing audio..."}
                    </Text>
                  </Box>
                )}
              </Flex>
            )}
            {selectedFile && (
              <Flex
                mt={5}
                w={"full"}
                justifyContent="center"
                flexDirection="column"
                gap={3}
              >
                <Box
                  p={4}
                  border="1px solid"
                  borderColor="gray.300"
                  borderRadius="md"
                  bg="gray.50"
                >
                  <Flex alignItems="center" gap={3}>
                    <BsFileEarmark size={32} color="blue" />
                    <Box flex={1}>
                      <Text fontWeight="semibold">{selectedFile.name}</Text>
                      <Text fontSize="xs" color="gray.500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </Text>
                    </Box>
                  </Flex>
                </Box>
                {isUploading && (
                  <Box w="full" p={3} bg="gray.50" borderRadius="md">
                    <Flex justifyContent="space-between" mb={2} alignItems="center">
                      <Text fontSize="sm" color="gray.700" fontWeight="semibold">
                        📤 Uploading...
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
                    <Text fontSize="xs" color="gray.500" mt={2}>
                      {uploadProgress < 100
                        ? `Uploading... ${uploadProgress}%`
                        : "Processing file..."}
                    </Text>
                  </Box>
                )}
              </Flex>
            )}
            <Flex justifyContent={"flex-end"} my={2} gap={2}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetMedia();
                  setSelectedFile(null);
                  cancelRecording();
                }}
              >
                Cancel
              </Button>
              {!isSending && !isUploading ? (
                <Button
                  colorScheme="blue"
                  size="sm"
                  onClick={handleSendMessage}
                  leftIcon={<IoSendSharp />}
                >
                  Send
                </Button>
              ) : (
                <Spinner size={"md"} />
              )}
            </Flex>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Flex>
  );
};

export default MessageInput;
