import {
  Box,
  Button,
  Flex,
  FormControl,
  Input,
  Text,
  Textarea,
  useDisclosure,
  Avatar,
  useColorModeValue,
} from "@chakra-ui/react";
import { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";
import userAtom from "../atoms/userAtom";
import { useNavigate } from "react-router-dom";

import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
} from "@chakra-ui/react";
import postsAtom from "../atoms/postsAtom";
import { useSocket } from "../context/SocketContext";
import {
  selectedConversationAtom,
  conversationAtom,
} from "../atoms/conversationAtom";

const Actions = ({ post, counts, viewerState }) => {
  const [posts, setPosts] = useRecoilState(postsAtom);
  const user = useRecoilValue(userAtom);
  const computedCounts = counts || post.counts || {};
  const computedViewerState = viewerState || post.viewerState || {};
  let [liked, setLiked] = useState(post.likes?.includes(user?._id));
  const [isLiking, setIsLiking] = useState(false);
  const [saved, setSaved] = useState(computedViewerState.saved || false);
  const [isSaving, setIsSaving] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isQuoteOpen,
    onOpen: onQuoteOpen,
    onClose: onQuoteClose,
  } = useDisclosure();
  const {
    isOpen: isShareOpen,
    onOpen: onShareOpen,
    onClose: onShareClose,
  } = useDisclosure();
  const [reply, setReply] = useState("");
  const [quoteText, setQuoteText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [isReposting, setIsReposting] = useState(false);
  const [shareSearch, setShareSearch] = useState("");
  const [shareSuggestions, setShareSuggestions] = useState([]);
  const [loadingShareSuggestions, setLoadingShareSuggestions] = useState(false);
  const [showShareSuggestions, setShowShareSuggestions] = useState(false);
  const shareSearchTimeoutRef = useRef(null);
  const shareInputRef = useRef(null);
  const navigate = useNavigate();
  const setSelectedConversation = useSetRecoilState(selectedConversationAtom);
  const setConversations = useSetRecoilState(conversationAtom);
  const [reposted, setReposted] = useState(
    computedViewerState.reposted || false
  );
  const [repostCount, setRepostCount] = useState(
    computedCounts.reposts ?? post.repostCount ?? 0
  );
  const quick = useState();
  const { socket, onlineUsers } = useSocket();
  const { likes, setLikes } = useState();
  const [realTime, setRealTime] = useState();
  const [newCommand, setNewCommand] = useState();
  const [likeId, setLikeId] = useState();
  useEffect(() => {
    setReposted(computedViewerState.reposted || false);
  }, [computedViewerState.reposted]);

  useEffect(() => {
    setRepostCount(computedCounts.reposts ?? post.repostCount ?? 0);
  }, [computedCounts.reposts, post.repostCount]);
  const replyCount = Array.isArray(post.replies)
    ? post.replies.length
    : computedCounts.replies || 0;
  const likeCount = Array.isArray(post.likes)
    ? post.likes.length
    : computedCounts.likes || 0;

  const handleSaveUnsave = async () => {
    if (isSaving) return;
    if (!user) {
      return toast.error("You must login to save a post");
    }
    setIsSaving(true);
    try {
      const postId = post._id || (post.post && post.post._id);
      if (!postId) {
        throw new Error("Post ID not found");
      }
      const res = await fetch(`/api/posts/save/${postId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setSaved(!!data.saved);
    } catch (error) {
      console.error("error in save/unsave post:", error.message);
      toast.error(error.message || "Failed to update saved post");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLikeUnlike = async () => {
    if (isLiking) return;
    setIsLiking(true);

    if (!user) return toast.error("You must login to like a post");
    try {
      const res = await fetch(`/api/posts/like/${post._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();
      // setQuick(post._id);
      console.log("likeUnlike:", data, "liked:", liked);

      socket.emit("Like", {
        postId: post._id,
        authId: data,
      });
      if (!liked) {
        // add id of the current array to likes array
        const updatedPosts = posts.map((p) => {
          if (post._id == p._id) {
            return { ...p, likes: data };
          }
          return p;
        });
        setPosts(updatedPosts);
      } else {
        //   // remove userid from the postLikes array
        const updatedPosts = posts.map((p) => {
          if (post._id == p._id) {
            return { ...p, likes: data };
          }
          return p;
        });
        setPosts(updatedPosts);
      }

      setLiked(!liked);

      if (data.error) {
        toast.error(data.error);
        throw new Error(data.error);
      }
    } catch (error) {
      console.log("error in likeUnlike:", error.message);
      toast.error(error.message);
    } finally {
      setIsLiking(false);
    }
  };

  useEffect(() => {
    socket.on("newLike", ({ postId, authId }) => {
      setLikeId(authId);
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post._id === postId ? { ...post, likes: authId } : post
        )
      );
      // const updatedPosts = posts.map((p)=>{
      //   if(postId == p._id){
      //     return {...p,likes:authId}
      //   }
      //   return p;
      //  })
      //  setPosts(updatedPosts)
      setLikeId("");
    });

    return () => socket && socket.off("newLike");
    //  return ()=> socket.off("updateAll")
  }, [setPosts, socket]);
  //quick,setLiked,liked,setPosts
  const handleReply = async () => {
    if (isReplying) return;
    setIsReplying(true);
    console.log(reply);
    setLoading(true);
    if (!user) {
      toast.error("Ypu must login to reply the posts");
      setLoading(false);
    }
    try {
      const res = await fetch(`/api/posts/reply/${post._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: reply }),
      });
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setNewCommand(data);
      //  setPost({...post,replies:[...post.replies,data.post.replies]})
      socket.emit("comment", {
        newComment: data,
        postId: post._id,
      });
      const updatedPosts = posts.map((p) => {
        if (post._id == p._id) {
          return { ...p, replies: data };
        }
        return p;
      });

      setPosts(updatedPosts);
      toast.success("Reply posted Successfully");
      onClose();
      setReply("");
    } catch (error) {
      console.log("error in reply:", error.message);
      toast.error(error.message);
    } finally {
      setLoading(false);
      setIsReplying(false);
    }
  };

  useEffect(() => {
    socket.on("new-comment", ({ newComment, postId }) => {
      setRealTime(newComment);
      // const updatedPosts = posts.map((p)=>{
      //   if(postId==p._id){
      //     return {...p,replies:newComment}
      //   }
      //   return p
      // })
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post._id === postId ? { ...post, replies: newComment } : post
        )
      );

      // setPosts(updatedPosts)
      setRealTime("");
    });
    return () => socket && socket.off("new-comment");
  }, [setPosts, socket]);

  const handleRepost = async () => {
    if (isReposting) return;
    if (!user) {
      toast.error("You must login to repost");
      return;
    }

    // If already reposted, show menu to undo or quote
    if (reposted) {
      // For now, just undo - can add menu later
      handleUndoRepost();
      return;
    }

    // Show menu: Repost or Quote
    onQuoteOpen();
  };

  const handleSimpleRepost = async () => {
    setIsReposting(true);
    try {
      // Get the actual post ID (handle both direct post and nested post structure)
      const postId = post._id || (post.post && post.post._id);
      if (!postId) {
        throw new Error("Post ID not found");
      }

      console.log(
        "Simple repost - Post ID:",
        postId,
        "URL:",
        `/api/posts/${postId}/repost`
      );

      const res = await fetch(`/api/posts/${postId}/repost`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Repost error response:", res.status, errorText);
        throw new Error(`HTTP ${res.status}: ${errorText.substring(0, 100)}`);
      }

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setReposted(true);
      setRepostCount(data.repostCount || repostCount + 1);

      // Update post in posts array
      const updatedPosts = posts.map((p) => {
        const pId = p._id || (p.post && p.post._id);
        if (pId === postId) {
          const targetPost = p.post || p;
          return {
            ...p,
            post: p.post
              ? {
                  ...p.post,
                  repostCount: data.repostCount,
                  viewerState: {
                    ...(targetPost.viewerState || {}),
                    reposted: true,
                  },
                }
              : undefined,
            repostCount: data.repostCount,
            viewerState: { ...(targetPost.viewerState || {}), reposted: true },
            counts: {
              ...(p.counts || {}),
              reposts: data.repostCount,
            },
          };
        }
        return p;
      });
      setPosts(updatedPosts);

      toast.success("Post reposted");
      onQuoteClose();
    } catch (error) {
      console.log("error in repost:", error.message);
      toast.error(error.message);
    } finally {
      setIsReposting(false);
    }
  };

  const handleQuoteRepost = async () => {
    if (!quoteText.trim()) {
      toast.error("Please enter a quote");
      return;
    }
    if (quoteText.length > 500) {
      toast.error("Quote must be 500 characters or less");
      return;
    }

    setIsReposting(true);
    try {
      // Get the actual post ID (handle both direct post and nested post structure)
      const postId = post._id || (post.post && post.post._id);
      if (!postId) {
        throw new Error("Post ID not found");
      }

      console.log(
        "Quote repost - Post ID:",
        postId,
        "URL:",
        `/api/posts/${postId}/quote`
      );

      const res = await fetch(`/api/posts/${postId}/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: quoteText.trim() }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(
          "Quote repost error response:",
          res.status,
          errorText.substring(0, 200)
        );
        throw new Error(
          `HTTP ${res.status}: ${
            res.status === 404
              ? "Route not found. Make sure the backend server is running and routes are registered."
              : errorText.substring(0, 100)
          }`
        );
      }

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setRepostCount(data.repostCount || repostCount + 1);
      setQuoteText("");
      onQuoteClose();

      // Add quote repost to feed (it will appear as a new item)
      // The feed will be refreshed on next load, or we can add it manually
      toast.success("Quote reposted");
    } catch (error) {
      console.log("error in quote repost:", error.message);
      toast.error(error.message);
    } finally {
      setIsReposting(false);
    }
  };

  const handleUndoRepost = async () => {
    setIsReposting(true);
    try {
      // Get the actual post ID (handle both direct post and nested post structure)
      const postId = post._id || (post.post && post.post._id);
      if (!postId) {
        throw new Error("Post ID not found");
      }

      const res = await fetch(`/api/posts/${postId}/repost`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setReposted(false);
      setRepostCount(data.repostCount || Math.max(0, repostCount - 1));

      // Update post in posts array
      const updatedPosts = posts.map((p) => {
        const pId = p._id || (p.post && p.post._id);
        if (pId === postId) {
          const targetPost = p.post || p;
          return {
            ...p,
            post: p.post
              ? {
                  ...p.post,
                  repostCount: data.repostCount,
                  viewerState: {
                    ...(targetPost.viewerState || {}),
                    reposted: false,
                  },
                }
              : undefined,
            repostCount: data.repostCount,
            viewerState: { ...(targetPost.viewerState || {}), reposted: false },
            counts: {
              ...(p.counts || {}),
              reposts: data.repostCount,
            },
          };
        }
        return p;
      });
      setPosts(updatedPosts);

      toast.success("Repost removed");
    } catch (error) {
      console.log("error in undo repost:", error.message);
      toast.error(error.message);
    } finally {
      setIsReposting(false);
    }
  };

  // Share to chat functionality
  useEffect(() => {
    // Clear previous timeout
    if (shareSearchTimeoutRef.current) {
      clearTimeout(shareSearchTimeoutRef.current);
    }

    // If search is empty, clear suggestions
    if (shareSearch.trim() === "") {
      setShareSuggestions([]);
      setShowShareSuggestions(false);
      return;
    }

    // Debounce search - wait 300ms after user stops typing
    shareSearchTimeoutRef.current = setTimeout(async () => {
      setLoadingShareSuggestions(true);
      try {
        const res = await fetch(
          `/api/users/search?query=${encodeURIComponent(shareSearch.trim())}`
        );
        const data = await res.json();

        if (data.error) {
          throw new Error(data.error);
        }

        setShareSuggestions(data);
        setShowShareSuggestions(data.length > 0);
      } catch (error) {
        console.error("Error fetching share suggestions:", error);
        setShareSuggestions([]);
        setShowShareSuggestions(false);
      } finally {
        setLoadingShareSuggestions(false);
      }
    }, 300);

    // Cleanup function
    return () => {
      if (shareSearchTimeoutRef.current) {
        clearTimeout(shareSearchTimeoutRef.current);
      }
    };
  }, [shareSearch]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        shareInputRef.current &&
        !shareInputRef.current.contains(event.target) &&
        !event.target.closest("[data-suggestion-item]")
      ) {
        setShowShareSuggestions(false);
      }
    };

    if (isShareOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isShareOpen]);

  const handleShareToChat = async (selectedUser) => {
    if (!user) {
      toast.error("You must be logged in to share a post");
      return;
    }

    if (selectedUser._id === user._id) {
      toast.error("You cannot share with yourself");
      return;
    }

    try {
      // Get or create conversation
      const res = await fetch("/api/messages/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const conversations = await res.json();

      if (res.error) {
        throw new Error(res.error);
      }

      // Find existing conversation or create mock
      const existingConversation = conversations.find(
        (conversation) =>
          conversation &&
          conversation.participants &&
          conversation.participants.length > 0 &&
          conversation.participants[0] &&
          conversation.participants[0]._id === selectedUser._id
      );

      let conversationId;
      if (existingConversation) {
        conversationId = existingConversation._id;
        setConversations(conversations);
      } else {
        // Create mock conversation
        const mockConversation = {
          mock: true,
          lastMessage: {
            text: "",
            sender: "",
          },
          _id: Date.now(),
          participants: [
            {
              _id: selectedUser._id,
              username: selectedUser.username,
              profilePic: selectedUser.profilePic,
            },
          ],
        };
        setConversations([...conversations, mockConversation]);
        conversationId = mockConversation._id;
      }

      // Set selected conversation
      setSelectedConversation({
        _id: conversationId,
        userId: selectedUser._id,
        userProfilePic: selectedUser.profilePic,
        username: selectedUser.username,
      });

      // Create post share message - need to get username from post
      // Try to get username from postedBy if it's populated, otherwise fetch it
      let postUsername = "";
      if (
        post.postedBy &&
        typeof post.postedBy === "object" &&
        post.postedBy.username
      ) {
        postUsername = post.postedBy.username;
      } else {
        // If postedBy is just an ID, we'll use a generic format
        // The recipient can still access the post via the post ID
        postUsername = "user"; // Fallback, will be resolved on the post page
      }

      const postUrl = `${window.location.origin}/${postUsername}/post/${post._id}`;
      const shareMessage = `Check out this post: ${postUrl}`;

      // Send message with post link
      const messageRes = await fetch("/api/messages/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientId: selectedUser._id,
          message: shareMessage,
        }),
      });

      const messageData = await messageRes.json();
      if (messageData.error) {
        throw new Error(messageData.error);
      }

      // Close modal and navigate to chat
      onShareClose();
      setShareSearch("");
      setShareSuggestions([]);
      navigate("/chat");
      toast.success(`Post shared with ${selectedUser.username}`);
    } catch (error) {
      console.error("Error sharing post:", error);
      toast.error(error.message || "Failed to share post");
    }
  };

  // console.log("realTimeCommand",realTime)
  return (
    <Flex flexDirection={"column"}>
      <Flex gap={3} my={2} onClick={(e) => e.preventDefault()}>
        <svg
          aria-label="Like"
          color={liked ? "rgb(237, 73, 86)" : ""}
          fill={liked ? "rgb(237, 73, 86)" : "transparent"}
          height="19"
          role="img"
          viewBox="0 0 24 22"
          width="20"
          onClick={handleLikeUnlike}
        >
          <path
            d="M1 7.66c0 4.575 3.899 9.086 9.987 12.934.338.203.74.406 1.013.406.283 0 .686-.203 1.013-.406C19.1 16.746 23 12.234 23 7.66 23 3.736 20.245 1 16.672 1 14.603 1 12.98 1.94 12 3.352 11.042 1.952 9.408 1 7.328 1 3.766 1 1 3.736 1 7.66Z"
            stroke="currentColor"
            strokeWidth="2"
          ></path>
        </svg>

        <svg
          onClick={onOpen}
          aria-label="Comment"
          color=""
          fill=""
          height="20"
          role="img"
          viewBox="0 0 24 24"
          width="20"
        >
          <title>Comment</title>
          <path
            d="M20.656 17.008a9.993 9.993 0 1 0-3.59 3.615L22 22Z"
            fill="none"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="2"
          ></path>
        </svg>

        <Box
          onClick={handleRepost}
          cursor="pointer"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
        >
          <RepostSVG color={reposted ? "rgb(0, 186, 124)" : "currentColor"} />
        </Box>
        <Box
          onClick={onShareOpen}
          cursor="pointer"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
        >
          <ShareSVG />
        </Box>
        <Box
          onClick={handleSaveUnsave}
          cursor={isSaving ? "not-allowed" : "pointer"}
          opacity={isSaving ? 0.6 : 1}
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
        >
          <SaveSVG filled={saved} />
        </Box>
      </Flex>

      <Flex gap={2} alignItems={"center"}>
        <Text color={useColorModeValue("ink.500", "whiteAlpha.600")} fontSize={"sm"}>
          {replyCount} replies
        </Text>
        <Box w={0.5} h={0.5} borderRadius={"full"} bg={useColorModeValue("sand.300", "ink.600")}></Box>
        <Text color={useColorModeValue("ink.500", "whiteAlpha.600")} fontSize={"sm"}>
          {likeCount} likes
        </Text>
        {(repostCount > 0 || reposted) && (
          <>
            <Box w={0.5} h={0.5} borderRadius={"full"} bg={useColorModeValue("sand.300", "ink.600")}></Box>
            <Text color={useColorModeValue("ink.500", "whiteAlpha.600")} fontSize={"sm"}>
              {repostCount} reposts
            </Text>
          </>
        )}
      </Flex>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader></ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl mt={4}>
              <Input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Reply goes here......"
              />
            </FormControl>
          </ModalBody>

          <ModalFooter>
            <Button
              isLoading={loading}
              onClick={handleReply}
              size={"sm"}
              colorScheme="blue"
              mr={3}
            >
              Reply
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Quote Repost Modal */}
      <Modal isOpen={isQuoteOpen} onClose={onQuoteClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Quote Repost</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl mt={4}>
              <Textarea
                value={quoteText}
                onChange={(e) => setQuoteText(e.target.value)}
                placeholder="Add a comment..."
                maxLength={500}
                rows={4}
              />
              <Text fontSize="xs" color="gray.500" mt={2} textAlign="right">
                {quoteText.length}/500
              </Text>
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              size="sm"
              mr={3}
              onClick={handleSimpleRepost}
              isLoading={isReposting}
            >
              Repost
            </Button>
            <Button
              size="sm"
              colorScheme="blue"
              onClick={handleQuoteRepost}
              isLoading={isReposting}
            >
              Quote
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Share to Chat Modal */}
      <Modal isOpen={isShareOpen} onClose={onShareClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Share Post</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Text mb={4} fontSize="sm" color="gray.500">
              Select a user to share this post with
            </Text>
            <Box position="relative" w="full">
              <FormControl>
                <Input
                  ref={shareInputRef}
                  value={shareSearch}
                  onChange={(e) => {
                    setShareSearch(e.target.value);
                    setShowShareSuggestions(true);
                  }}
                  onFocus={() => {
                    if (shareSuggestions.length > 0) {
                      setShowShareSuggestions(true);
                    }
                  }}
                  placeholder="Search for a user..."
                  autoComplete="off"
                />
                {/* Share Suggestions Dropdown */}
                {showShareSuggestions && (
                  <Box
                    position="absolute"
                    top="100%"
                    left={0}
                    right={0}
                    mt={1}
                    bg={useColorModeValue("white", "gray.800")}
                    border="1px solid"
                    borderColor={useColorModeValue("gray.200", "gray.700")}
                    borderRadius="md"
                    boxShadow="lg"
                    zIndex={1000}
                    maxH="300px"
                    overflowY="auto"
                  >
                    {loadingShareSuggestions ? (
                      <Flex p={3} align="center" justify="center">
                        <Text fontSize="sm" color="gray.500">
                          Searching...
                        </Text>
                      </Flex>
                    ) : shareSuggestions.length === 0 ? (
                      <Flex p={3} align="center" justify="center">
                        <Text fontSize="sm" color="gray.500">
                          No users found
                        </Text>
                      </Flex>
                    ) : (
                      shareSuggestions.map((shareUser) => (
                        <Flex
                          key={shareUser._id}
                          data-suggestion-item
                          p={3}
                          align="center"
                          gap={3}
                          cursor="pointer"
                          _hover={{
                            bg: useColorModeValue("gray.100", "gray.700"),
                          }}
                          onClick={() => handleShareToChat(shareUser)}
                          borderBottom="1px solid"
                          borderColor={useColorModeValue(
                            "gray.100",
                            "gray.700"
                          )}
                          _last={{ borderBottom: "none" }}
                        >
                          <Avatar
                            size="sm"
                            src={shareUser.profilePic}
                            name={shareUser.name}
                          />
                          <Box flex={1}>
                            <Text fontSize="sm" fontWeight="semibold">
                              {shareUser.username}
                            </Text>
                            <Text fontSize="xs" color="gray.500">
                              {shareUser.name}
                            </Text>
                          </Box>
                        </Flex>
                      ))
                    )}
                  </Box>
                )}
              </FormControl>
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Flex>
  );
};

export default Actions;

export const RepostSVG = ({ color = "currentColor" }) => {
  return (
    <svg
      aria-label="Repost"
      color={color}
      fill={color}
      height="20"
      role="img"
      viewBox="0 0 24 24"
      width="20"
    >
      <title>Repost</title>
      <path
        fill={color}
        d="M19.998 9.497a1 1 0 0 0-1 1v4.228a3.274 3.274 0 0 1-3.27 3.27h-5.313l1.791-1.787a1 1 0 0 0-1.412-1.416L7.29 18.287a1.004 1.004 0 0 0-.294.707v.001c0 .023.012.042.013.065a.923.923 0 0 0 .281.643l3.502 3.504a1 1 0 0 0 1.414-1.414l-1.797-1.798h5.318a5.276 5.276 0 0 0 5.27-5.27v-4.228a1 1 0 0 0-1-1Zm-6.41-3.496-1.795 1.795a1 1 0 1 0 1.414 1.414l3.5-3.5a1.003 1.003 0 0 0 0-1.417l-3.5-3.5a1 1 0 0 0-1.414 1.414l1.794 1.794H8.27A5.277 5.277 0 0 0 3 9.271V13.5a1 1 0 0 0 2 0V9.271a3.275 3.275 0 0 1 3.271-3.27Z"
      ></path>
    </svg>
  );
};

export const ShareSVG = () => {
  return (
    <svg
      aria-label="Share"
      color=""
      fill="rgb(243, 245, 247)"
      height="20"
      role="img"
      viewBox="0 0 24 24"
      width="20"
    >
      <title>Share</title>
      <line
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
        x1="22"
        x2="9.218"
        y1="3"
        y2="10.083"
      ></line>
      <polygon
        fill="none"
        points="11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      ></polygon>
    </svg>
  );
};

export const SaveSVG = ({ filled = false }) => {
  const fillColor = filled ? "currentColor" : "none";
  return (
    <svg
      aria-label="Save"
      color="currentColor"
      fill={fillColor}
      height="20"
      role="img"
      viewBox="0 0 24 24"
      width="20"
    >
      <title>Save</title>
      <path
        d="M5 3a2 2 0 0 0-2 2v16l9-5.25L21 21V5a2 2 0 0 0-2-2H5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// import {
// 	Box,
// 	Button,
// 	Flex,
// 	FormControl,
// 	Input,
// 	Modal,
// 	ModalBody,
// 	ModalCloseButton,
// 	ModalContent,
// 	ModalFooter,
// 	ModalHeader,
// 	ModalOverlay,
// 	Text,
// 	useDisclosure,
// } from "@chakra-ui/react";
// import { useState } from "react";
// import { useRecoilState, useRecoilValue } from "recoil";
// import userAtom from "../atoms/userAtom";
// import useShowToast from "../hooks/useShowToast";
// import postsAtom from "../atoms/postsAtom";

// const Actions = ({ post }) => {
// 	const user = useRecoilValue(userAtom);
// 	const [liked, setLiked] = useState(post.likes.includes(user?._id));
// 	const [posts, setPosts] = useRecoilState(postsAtom);
// 	const [isLiking, setIsLiking] = useState(false);
// 	const [isReplying, setIsReplying] = useState(false);
// 	const [reply, setReply] = useState("");

// 	const showToast = useShowToast();
// 	const { isOpen, onOpen, onClose } = useDisclosure();

// 	const handleLikeAndUnlike = async () => {
// 		if (!user) return showToast("Error", "You must be logged in to like a post", "error");
// 		if (isLiking) return;
// 		setIsLiking(true);
// 		try {
// 			const res = await fetch("/api/posts/like/" + post._id, {
// 				method: "PUT",
// 				headers: {
// 					"Content-Type": "application/json",
// 				},
// 			});
// 			const data = await res.json();
// 			if (data.error) return showToast("Error", data.error, "error");

// 			if (!liked) {
// 				// add the id of the current user to post.likes array
// 				const updatedPosts = posts.map((p) => {
// 					if (p._id === post._id) {
// 						return { ...p, likes: [...p.likes, user._id] };
// 					}
// 					return p;
// 				});
// 				setPosts(updatedPosts);
// 			} else {
// 				// remove the id of the current user from post.likes array
// 				const updatedPosts = posts.map((p) => {
// 					if (p._id === post._id) {
// 						return { ...p, likes: p.likes.filter((id) => id !== user._id) };
// 					}
// 					return p;
// 				});
// 				setPosts(updatedPosts);
// 			}

// 			setLiked(!liked);
// 		} catch (error) {
// 			showToast("Error", error.message, "error");
// 		} finally {
// 			setIsLiking(false);
// 		}
// 	};

// 	const handleReply = async () => {
// 		if (!user) return showToast("Error", "You must be logged in to reply to a post", "error");
// 		if (isReplying) return;
// 		setIsReplying(true);
// 		try {
// 			const res = await fetch("/api/posts/reply/" + post._id, {
// 				method: "PUT",
// 				headers: {
// 					"Content-Type": "application/json",
// 				},
// 				body: JSON.stringify({ text: reply }),
// 			});
// 			const data = await res.json();
// 			if (data.error) return showToast("Error", data.error, "error");

// 			const updatedPosts = posts.map((p) => {
// 				if (p._id === post._id) {
// 					return { ...p, replies: [...p.replies, data] };
// 				}
// 				return p;
// 			});
// 			setPosts(updatedPosts);
// 			showToast("Success", "Reply posted successfully", "success");
// 			onClose();
// 			setReply("");
// 		} catch (error) {
// 			showToast("Error", error.message, "error");
// 		} finally {
// 			setIsReplying(false);
// 		}
// 	};

// 	return (
// 		<Flex flexDirection='column'>
// 			<Flex gap={3} my={2} onClick={(e) => e.preventDefault()}>
// 				<svg
// 					aria-label='Like'
// 					color={liked ? "rgb(237, 73, 86)" : ""}
// 					fill={liked ? "rgb(237, 73, 86)" : "transparent"}
// 					height='19'
// 					role='img'
// 					viewBox='0 0 24 22'
// 					width='20'
// 					onClick={handleLikeAndUnlike}
// 				>
// 					<path
// 						d='M1 7.66c0 4.575 3.899 9.086 9.987 12.934.338.203.74.406 1.013.406.283 0 .686-.203 1.013-.406C19.1 16.746 23 12.234 23 7.66 23 3.736 20.245 1 16.672 1 14.603 1 12.98 1.94 12 3.352 11.042 1.952 9.408 1 7.328 1 3.766 1 1 3.736 1 7.66Z'
// 						stroke='currentColor'
// 						strokeWidth='2'
// 					></path>
// 				</svg>

// 				<svg
// 					aria-label='Comment'
// 					color=''
// 					fill=''
// 					height='20'
// 					role='img'
// 					viewBox='0 0 24 24'
// 					width='20'
// 					onClick={onOpen}
// 				>
// 					<title>Comment</title>
// 					<path
// 						d='M20.656 17.008a9.993 9.993 0 1 0-3.59 3.615L22 22Z'
// 						fill='none'
// 						stroke='currentColor'
// 						strokeLinejoin='round'
// 						strokeWidth='2'
// 					></path>
// 				</svg>

// 				<RepostSVG />
// 				<ShareSVG />
// 			</Flex>

// 			<Flex gap={2} alignItems={"center"}>
// 				<Text color={"gray.light"} fontSize='sm'>
// 					{post.replies.length} replies
// 				</Text>
// 				<Box w={0.5} h={0.5} borderRadius={"full"} bg={"gray.light"}></Box>
// 				<Text color={"gray.light"} fontSize='sm'>
// 					{post.likes.length} likes
// 				</Text>
// 			</Flex>

// 			<Modal isOpen={isOpen} onClose={onClose}>
// 				<ModalOverlay />
// 				<ModalContent>
// 					<ModalHeader></ModalHeader>
// 					<ModalCloseButton />
// 					<ModalBody pb={6}>
// 						<FormControl>
// 							<Input
// 								placeholder='Reply goes here..'
// 								value={reply}
// 								onChange={(e) => setReply(e.target.value)}
// 							/>
// 						</FormControl>
// 					</ModalBody>

// 					<ModalFooter>
// 						<Button colorScheme='blue' size={"sm"} mr={3} isLoading={isReplying} onClick={handleReply}>
// 							Reply
// 						</Button>
// 					</ModalFooter>
// 				</ModalContent>
// 			</Modal>
// 		</Flex>
// 	);
// };

// export default Actions;

// const RepostSVG = () => {
// 	return (
// 		<svg
// 			aria-label='Repost'
// 			color='currentColor'
// 			fill='currentColor'
// 			height='20'
// 			role='img'
// 			viewBox='0 0 24 24'
// 			width='20'
// 		>
// 			<title>Repost</title>
// 			<path
// 				fill=''
// 				d='M19.998 9.497a1 1 0 0 0-1 1v4.228a3.274 3.274 0 0 1-3.27 3.27h-5.313l1.791-1.787a1 1 0 0 0-1.412-1.416L7.29 18.287a1.004 1.004 0 0 0-.294.707v.001c0 .023.012.042.013.065a.923.923 0 0 0 .281.643l3.502 3.504a1 1 0 0 0 1.414-1.414l-1.797-1.798h5.318a5.276 5.276 0 0 0 5.27-5.27v-4.228a1 1 0 0 0-1-1Zm-6.41-3.496-1.795 1.795a1 1 0 1 0 1.414 1.414l3.5-3.5a1.003 1.003 0 0 0 0-1.417l-3.5-3.5a1 1 0 0 0-1.414 1.414l1.794 1.794H8.27A5.277 5.277 0 0 0 3 9.271V13.5a1 1 0 0 0 2 0V9.271a3.275 3.275 0 0 1 3.271-3.27Z'
// 			></path>
// 		</svg>
// 	);
// };

// const ShareSVG = () => {
// 	return (
// 		<svg
// 			aria-label='Share'
// 			color=''
// 			fill='rgb(243, 245, 247)'
// 			height='20'
// 			role='img'
// 			viewBox='0 0 24 24'
// 			width='20'
// 		>
// 			<title>Share</title>
// 			<line
// 				fill='none'
// 				stroke='currentColor'
// 				strokeLinejoin='round'
// 				strokeWidth='2'
// 				x1='22'
// 				x2='9.218'
// 				y1='3'
// 				y2='10.083'
// 			></line>
// 			<polygon
// 				fill='none'
// 				points='11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334'
// 				stroke='currentColor'
// 				strokeLinejoin='round'
// 				strokeWidth='2'
// 			></polygon>
// 		</svg>
// 	);
// };
// t Actions
// t Actions
