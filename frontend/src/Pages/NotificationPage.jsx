import React, { useEffect, useState } from "react";
import { TimeIcon } from "@chakra-ui/icons";
import toast from "react-hot-toast";
import { MdOutlineDelete } from "react-icons/md";
import { useSocket } from "../context/SocketContext";
import { useRecoilState } from "recoil";
import postsAtom from "../atoms/postsAtom";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Box,
  Image,
  Flex,
  Text,
  Button,
  Badge,
  useColorModeValue,
} from "@chakra-ui/react";

const NotificationPage = () => {
  // const [notifications, setNotifications] = useState([]);
  const {socket,onlineUsers,notifications,setNotifications} =useSocket()
  const [posts,setPosts]=useRecoilState(postsAtom)
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedPreview, setSelectedPreview] = useState(null);
  const surfaceBg = useColorModeValue("whiteAlpha.900", "blackAlpha.400");
  const surfaceBorder = useColorModeValue("sand.200", "ink.700");
  const mutedText = useColorModeValue("ink.500", "whiteAlpha.600");
  // useEffect(() => {
  //   const getNotification = async () => {
  //     try {
  //       const res = await fetch("/api/notification/getNotification", {
  //         method: "POST",
  //         headers: {
  //           "Content-Type": "application/json",
  //         },
  //       });
  //       const data = await res.json();
  //       console.log("notification",data)
  //       if (data.error) {
  //         throw new Error(data.error);
  //       }
  //       setNotifications(data);
  //     } catch (error) {
  //       console.error("Error fetching notifications:", error);
  //       toast.error(error.message);
  //     }
  //   };
  //   getNotification();
  // }, [setNotifications]);

  const handleMarkAsRead = async (id) => {
    try {
      const res = await fetch("/api/notification/readNotification", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notificationId: id }),
      });
      const data = await res.json();
      console.log("read",data)
      if (data.error) {
        throw new Error(data.error);
      }
      setNotifications((prev) =>
        prev.map((notif) => (notif._id === id ? { ...notif, ...data } : notif))
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
      toast.error(error.message);
    }
  };

  const handleDelete = async(id)=>{
    try {
      const res = await fetch(`/api/notification/deleteNotification`,{
        method:"POST",
        headers:{
          "Content-type":"application/json"
        },
        body:JSON.stringify({notificationId:id})

      })
      const data = await res.json()
   
      if(data.error){
        throw new Error(data.error)
      }
      toast.success(data.message)

      setNotifications((prevNo)=>prevNo.filter((prev)=>prev._id !== id))
       console.log("notificationDeleted",data)
    } catch (error) {
      console.log("error in deleteNotification",error)
      toast.error(error.message)
    }
  }

  useEffect(()=>{
   
  socket?.on("live",({notification})=>{
    console.log("likeNotification",notification)
    if(notification){
      setNotifications((preNotifi)=>[...preNotifi,notification].reverse())
    }
   
  })
   return ()=> socket?.off("live")
  },[setNotifications,socket,setPosts])

  
  useEffect(()=>{
   
    socket?.on("commentLive",({notification})=>{
      console.log("livecomment",notification)
      if(notification){
        setNotifications((preNotifi)=>[...preNotifi,notification].reverse())
      }

    })
     return ()=> socket?.off("commentLive")
    },[setNotifications,socket,setPosts])
  


  const formatDate = (dateString) => {
    const options = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const handlePreviewClick = (notification) => {
    const previewData = {
      text: notification.likedText || "",
      image: notification.postImg || null,
      video: notification.postVideo || null,
      videoFileId: notification.postVideoFileId || null,
      hasVideo: notification.hasVideo || false,
    };
    setSelectedPreview(previewData);
    onOpen();
  };

  return (
    <Box w="full" maxW="680px" mx="auto" px={{ base: 4, md: 0 }} pb={{ base: 6, md: 10 }}>
      <Box
        bg={surfaceBg}
        border="1px solid"
        borderColor={surfaceBorder}
        borderRadius="2xl"
        p={{ base: 4, md: 6 }}
        backdropFilter="blur(10px)"
        boxShadow="0 20px 40px -30px rgba(0, 0, 0, 0.35)"
      >
        <Text fontSize="xl" fontWeight="bold" textAlign="center" mb={6}>
          Notifications
        </Text>

        <Flex direction="column" gap={4}>
          {notifications.map((notification) => {
            const isRead = notification.read || notification.isRead;
            return (
              <Box
                key={notification._id}
                p={4}
                bg={useColorModeValue("white", "ink.800")}
                border="1px solid"
                borderColor={surfaceBorder}
                borderLeftWidth="4px"
                borderLeftColor={isRead ? useColorModeValue("sand.300", "ink.600") : "brand.400"}
                borderRadius="lg"
              >
                <Flex justifyContent="space-between" alignItems="center" mb={2} gap={3}>
                  <Flex alignItems="center" gap={3}>
                    {notification.from && (
                      <>
                        <Image
                          w="32px"
                          h="32px"
                          borderRadius="full"
                          src={notification.postUserimg?.img || ""}
                          alt={notification.postUsername?.user || ""}
                        />
                        <Text fontWeight="bold">
                          {notification.postUsername?.user || "User"}
                        </Text>
                      </>
                    )}
                  </Flex>
                  <Badge colorScheme="brand" textTransform="capitalize">
                    {notification.type}
                  </Badge>
                </Flex>

                <Box
                  mt={3}
                  mb={3}
                  p={2}
                  bg={useColorModeValue("sand.50", "ink.700")}
                  borderRadius="md"
                  cursor="pointer"
                  transition="all 150ms ease"
                  _hover={{ bg: useColorModeValue("sand.100", "ink.600") }}
                  onClick={() => handlePreviewClick(notification)}
                >
                  {notification.likedText &&
                    typeof notification.likedText === "string" &&
                    notification.likedText.trim() !== "" && (
                      <Text fontSize="xs" color={mutedText} mb={2}>
                        {notification.likedText.length > 30
                          ? `${notification.likedText.slice(0, 30)}...`
                          : notification.likedText}
                      </Text>
                    )}

                  {notification.postImg &&
                    notification.postImg.trim() !== "" &&
                    notification.postImg !== "null" && (
                      <Box
                        w="64px"
                        h="64px"
                        borderRadius="md"
                        overflow="hidden"
                        mb={2}
                        border="2px solid"
                        borderColor={useColorModeValue("sand.300", "ink.600")}
                      >
                        <Image
                          w="full"
                          h="full"
                          objectFit="cover"
                          src={notification.postImg}
                          alt="Post preview"
                        />
                      </Box>
                    )}

                  {notification.postVideo &&
                    notification.postVideo.trim() !== "" &&
                    notification.postVideo !== "null" &&
                    notification.postVideo.includes("res.cloudinary.com") &&
                    notification.postVideo.includes("/video/upload/") && (
                      <Box
                        w="64px"
                        h="64px"
                        borderRadius="md"
                        overflow="hidden"
                        mb={2}
                        position="relative"
                        bg="black"
                        border="2px solid"
                        borderColor={useColorModeValue("sand.300", "ink.600")}
                      >
                        <video
                          className="w-full h-full object-cover opacity-70"
                          preload="metadata"
                          muted
                          playsInline
                        >
                          <source src={notification.postVideo} type="video/mp4" />
                        </video>
                        <Box
                          position="absolute"
                          inset={0}
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          color="white"
                          fontSize="sm"
                        >
                          Play
                        </Box>
                      </Box>
                    )}

                  {notification.hasVideo && notification.postVideoFileId && (
                    <Box
                      w="64px"
                      h="64px"
                      borderRadius="md"
                      overflow="hidden"
                      mb={2}
                      position="relative"
                      bg="black"
                      border="2px solid"
                      borderColor={useColorModeValue("sand.300", "ink.600")}
                    >
                      <video
                        className="w-full h-full object-cover opacity-70"
                        preload="metadata"
                        muted
                        playsInline
                      >
                        <source
                          src={`/api/posts/video/${notification.postVideoFileId}`}
                          type="video/mp4"
                        />
                      </video>
                      <Box
                        position="absolute"
                        inset={0}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        color="white"
                        fontSize="sm"
                      >
                        Play
                      </Box>
                    </Box>
                  )}

                  {!notification.postImg &&
                    !notification.postVideo &&
                    !notification.hasVideo &&
                    (!notification.likedText ||
                      (typeof notification.likedText === "string" &&
                        notification.likedText.trim() === "")) && (
                      <Text fontSize="xs" color={mutedText} fontStyle="italic">
                        Tap to view
                      </Text>
                    )}
                </Box>

                <Flex justifyContent="space-between" alignItems="center" mt={3} gap={3}>
                  <Flex alignItems="center" gap={2} color={mutedText}>
                    <TimeIcon fontSize="small" />
                    <Text fontSize="xs">{formatDate(notification.createdAt)}</Text>
                  </Flex>
                  <Flex alignItems="center" gap={2}>
                    {!isRead && (
                      <Button size="xs" onClick={() => handleMarkAsRead(notification._id)}>
                        Read
                      </Button>
                    )}
                    {isRead && (
                      <Button
                        size="xs"
                        colorScheme="red"
                        variant="ghost"
                        onClick={() => handleDelete(notification._id)}
                        leftIcon={<MdOutlineDelete />}
                      >
                        Delete
                      </Button>
                    )}
                  </Flex>
                </Flex>
              </Box>
            );
          })}
        </Flex>
      </Box>

      {/* Full Preview Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent maxW="90vw" maxH="90vh">
          <ModalCloseButton />
          <ModalBody p={4}>
            {selectedPreview && (
              <Box>
                {selectedPreview.text && selectedPreview.text.trim() !== "" && (
                  <Box
                    mb={4}
                    p={3}
                    bg={useColorModeValue("sand.50", "ink.700")}
                    borderRadius="md"
                  >
                    <Text fontSize="sm">{selectedPreview.text}</Text>
                  </Box>
                )}

                {selectedPreview.image &&
                  selectedPreview.image.trim() !== "" &&
                  selectedPreview.image !== "null" && (
                    <Box mb={4} borderRadius="md" overflow="hidden">
                      <Image
                        src={selectedPreview.image}
                        alt="Post preview"
                        maxH="70vh"
                        w="full"
                        objectFit="contain"
                      />
                    </Box>
                  )}

                {selectedPreview.video &&
                  selectedPreview.video.trim() !== "" &&
                  selectedPreview.video !== "null" &&
                  selectedPreview.video.includes("res.cloudinary.com") &&
                  selectedPreview.video.includes("/video/upload/") && (
                    <Box mb={4} borderRadius="md" overflow="hidden">
                      <video
                        controls
                        preload="metadata"
                        style={{
                          width: "100%",
                          maxHeight: "70vh",
                          display: "block",
                        }}
                      >
                        <source src={selectedPreview.video} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    </Box>
                  )}

                {selectedPreview.hasVideo && selectedPreview.videoFileId && (
                  <Box mb={4} borderRadius="md" overflow="hidden">
                    <video
                      controls
                      preload="metadata"
                      style={{
                        width: "100%",
                        maxHeight: "70vh",
                        display: "block",
                      }}
                    >
                      <source
                        src={`/api/posts/video/${selectedPreview.videoFileId}`}
                        type="video/mp4"
                      />
                      Your browser does not support the video tag.
                    </video>
                  </Box>
                )}
              </Box>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default NotificationPage;
