import {
  Avatar,
  Box,
  Flex,
  Image,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import Actions from "./Actions";
import toast from "react-hot-toast";
import { AiOutlineDelete } from "react-icons/ai";
import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";
import userAtom from "../atoms/userAtom";
import postsAtom from "../atoms/postsAtom";

const Post = ({
  post,
  postedBy,
  itemType,
  actor,
  quoteText,
  counts,
  viewerState,
  index = 0,
}) => {
  const [user, setUser] = useState(null);
  const currentUser = useRecoilValue(userAtom);
  const [posts, setPosts] = useRecoilState(postsAtom);

  const navigate = useNavigate();

  // Handle repost/quote structure: if itemType exists, use post.post, otherwise use post directly
  const actualPost = itemType && post.post ? post.post : post;
  const actualPostedBy = postedBy || actualPost.postedBy;
  const derivedCounts = counts ||
    actualPost.counts || {
      likes: actualPost.likes?.length || 0,
      replies: actualPost.replies?.length || 0,
      reposts: actualPost.repostCount || 0,
    };
  const derivedViewerState = viewerState || actualPost.viewerState || {};

  // Debug: Log post data to see if video field exists
  useEffect(() => {
    if (actualPost) {
      console.log("Post component - Post data:", {
        id: actualPost._id,
        hasImg: !!actualPost.img,
        hasVideo: !!actualPost.video,
        img: actualPost.img,
        video: actualPost.video,
        itemType,
        allKeys: Object.keys(actualPost),
      });
    }
  }, [actualPost, itemType]);

  useEffect(() => {
    const getUser = async () => {
      // Don't fetch if postedBy is not valid
      if (
        !actualPostedBy ||
        (typeof actualPostedBy === "string" && actualPostedBy.trim() === "")
      ) {
        console.warn("Invalid postedBy:", actualPostedBy);
        return;
      }

      // If postedBy is an object (populated), use it directly
      if (typeof actualPostedBy === "object" && actualPostedBy.username) {
        setUser(actualPostedBy);
        return;
      }

      try {
        const userId =
          typeof actualPostedBy === "object"
            ? actualPostedBy._id
            : actualPostedBy;
        const res = await fetch(`/api/users/profile/${userId}`);

        // Check if response is ok
        if (!res.ok) {
          const errorData = await res
            .json()
            .catch(() => ({ error: "Unknown error" }));
          throw new Error(
            errorData.error || `HTTP error! status: ${res.status}`
          );
        }

        const data = await res.json();

        if (data.error) {
          throw new Error(data.error);
        }

        setUser(data);
      } catch (error) {
        console.error("error in fetch getuser:", error.message);

        // Don't show toast for connection errors to avoid spam
        if (
          !error.message.includes("ECONNRESET") &&
          !error.message.includes("Failed to fetch")
        ) {
          toast.error(error.message || "Failed to load user profile");
        }

        setUser(null);
      }
    };

    getUser();
  }, [actualPostedBy]);

  const handleDeletePost = async (e) => {
    e.preventDefault();
    try {
      if (!window.confirm("Are you sure you want to delete this post?")) return;

      const res = await fetch(`/api/posts/${actualPost._id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }
      console.log("deletePost", data);
      // setPosts((prev)=>prev.filter((p)=>p._id !== post._id))
      setPosts(
        posts.filter((po) => {
          const poId = po._id || (po.post && po.post._id);
          return poId !== actualPost._id;
        })
      );
      toast.success("Post deleted");
    } catch (error) {
      console.log("error in deletePosy", error.message);
      toast.error(error.message);
    }
  };
  if (!user) {
    return null;
  }

  // Get actor info for repost/quote
  const actorUser = actor || null;

  const animationDelay =
    typeof index === "number" ? `${Math.min(index * 0.06, 0.6)}s` : "0s";

  return (
    <Link
      to={`/${user.username}/post/${actualPost._id}`}
      className="post-card"
      style={{ animationDelay }}
    >
      <Box
        bg={useColorModeValue("whiteAlpha.900", "blackAlpha.400")}
        border="1px solid"
        borderColor={useColorModeValue("sand.200", "ink.700")}
        borderRadius="2xl"
        p={{ base: 4, md: 5 }}
        mb={4}
        transition="all 200ms ease"
        _hover={{
          transform: "translateY(-2px)",
          boxShadow: "0 22px 42px -30px rgba(0, 0, 0, 0.45)",
        }}
        backdropFilter="blur(10px)"
      >
        <Flex gap={3} flexDirection="column">
          {/* Repost/Quote header */}
          {(itemType === "repost" || itemType === "quote") && actorUser && (
            <Flex alignItems="center" gap={2} mb={-2} ml={12}>
              <Text fontSize="xs" color="gray.500">
                {actorUser.name || actorUser.username}{" "}
                {itemType === "quote" ? "quoted" : "reposted"}
              </Text>
            </Flex>
          )}

          {/* Quote text */}
          {itemType === "quote" && quoteText && (
            <Box mb={2} ml={12}>
              <Text fontSize="sm">{quoteText}</Text>
            </Box>
          )}

          <Flex gap={3} w="full">
            <Flex flexDirection={"column"} alignItems={"center"}>
              <Avatar
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/${user.username}`);
                }}
                size="md"
                name={user.name}
                src={user?.profilePic}
              ></Avatar>
              <Box
                w="1px"
                h="full"
                bg={useColorModeValue("sand.300", "ink.600")}
                my={2}
              ></Box>

              <Box position={"relative"} w="full">
                {(!actualPost.replies || actualPost.replies.length == 0) && (
                  <Text textAlign={"center"}>🥱</Text>
                )}
                {actualPost.replies && actualPost.replies[0] && (
                  <Avatar
                    size="xs"
                    name="aeun"
                    src={actualPost.replies[0].userProfilePic}
                    postion={"absolute"}
                    top={"0px"}
                    left="15px"
                    padding={"2px"}
                  ></Avatar>
                )}

                {actualPost.replies && actualPost.replies[1] && (
                  <Avatar
                    size="xs"
                    name="John do"
                    src={actualPost.replies[1].userProfilePic}
                    postion={"absolute"}
                    bottom={"0px"}
                    right="-5px"
                    padding={"2px"}
                  ></Avatar>
                )}
                {actualPost.replies && actualPost.replies[2] && (
                  <Avatar
                    size="xs"
                    name="John do"
                    src={actualPost.replies[2].userProfilePic}
                    postion={"absolute"}
                    bottom={"0px"}
                    left="4px"
                    padding={"2px"}
                  ></Avatar>
                )}
              </Box>
            </Flex>
            <Flex flex={1} flexDirection={"column"} gap={2}>
              <Flex justifyContent={"space-between"} w={"full"}>
                <Flex w="full" alignItems={"center"} gap={2}>
                  {actualPost.isBreaking &&
                    actualPost.breakingExpiresAt &&
                    new Date(actualPost.breakingExpiresAt) > new Date() && (
                      <Box
                        bg="red.500"
                        color="white"
                        px={2}
                        py={0.5}
                        borderRadius="full"
                        fontSize="xs"
                        fontWeight="bold"
                        letterSpacing="0.04em"
                      >
                        🔴 BREAKING
                      </Box>
                    )}
                  <Text
                    fontSize={"sm"}
                    fontWeight={"bold"}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/${user.username}`);
                    }}
                  >
                    {user.username}
                  </Text>
                  <Image src="/verified.png" w={4} h={4} ml={1}></Image>
                </Flex>
                <Flex gap={4} alignItems={"center"}>
                  <Text
                    fontSize={"xs"}
                    width={36}
                    textAlign={"right"}
                    color={useColorModeValue("ink.500", "whiteAlpha.700")}
                  >
                    {formatDistanceToNow(new Date(actualPost.createdAt))} ago
                  </Text>

                  {currentUser?._id == user._id && (
                    <AiOutlineDelete onClick={handleDeletePost} size={20} />
                  )}
                </Flex>
              </Flex>
              {/* Show headline for breaking news, otherwise show text */}
              {actualPost.isBreaking && actualPost.headline ? (
                <Box>
                  <Text fontSize={"md"} fontWeight="bold" mb={1}>
                    {actualPost.headline}
                  </Text>
                  {actualPost.text &&
                    actualPost.text !== actualPost.headline && (
                      <Text fontSize={"sm"} color="gray.500">
                        {actualPost.text}
                      </Text>
                    )}
                  {actualPost.sourceName && actualPost.sourceUrl && (
                    <Flex alignItems="center" gap={1} mt={2}>
                      <Text fontSize="xs" color="gray.500">
                        Source:
                      </Text>
                      <Text
                        fontSize="xs"
                        color="blue.500"
                        as="a"
                        href={actualPost.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {actualPost.sourceName}
                      </Text>
                    </Flex>
                  )}
                </Box>
              ) : (
                <Text fontSize={"sm"}>{actualPost.text}</Text>
              )}
              {actualPost.img &&
                actualPost.img !== null &&
                actualPost.img.trim() !== "" && (
                  <Box
                    borderRadius="xl"
                    borderColor={useColorModeValue("sand.200", "ink.700")}
                    overflow="hidden"
                    border="1px solid"
                    my={2}
                  >
                    <Image
                      src={actualPost.img}
                      w={"full"}
                      alt="Post image"
                    ></Image>
                  </Box>
                )}
              {actualPost.video &&
                actualPost.video !== null &&
                actualPost.video !== "null" &&
                actualPost.video !== undefined &&
                typeof actualPost.video === "string" &&
                actualPost.video.trim() !== "" &&
                // Only render if it's a Cloudinary URL
                actualPost.video.includes("res.cloudinary.com") &&
                actualPost.video.includes("/video/upload/") && (
                  <Box
                    borderRadius="xl"
                    borderColor={useColorModeValue("sand.200", "ink.700")}
                    overflow="hidden"
                    border="1px solid"
                    my={2}
                  >
                    <video
                      src={actualPost.video}
                      controls
                      preload="metadata"
                      style={{
                        width: "100%",
                        maxHeight: "600px",
                        display: "block",
                        borderRadius: "6px",
                      }}
                      onError={(e) => {
                        console.error("Video load error:", e);
                        console.error("Video URL:", actualPost.video);
                        // Don't show error for non-Cloudinary URLs (they're filtered out)
                      }}
                      onLoadStart={() => {
                        console.log("Video loading:", actualPost.video);
                      }}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </Box>
                )}
              <Flex gap={3} my={1}>
                <Actions
                  post={actualPost}
                  counts={derivedCounts}
                  viewerState={derivedViewerState}
                />
              </Flex>
              {/* <Flex gap={2} alignItems={"center"}>
            <Text color={"gray.light"} fontSize={"sm"}>
              {post.replies.length} repiles
            </Text>
            <Box w={0.5} h={0.5} borderRadius={"full"} bg={"gray.light"}></Box>
            <Text color={"gray.light"} fontSize={"sm"}>
              {post.likes.length} likes
            </Text>
          </Flex> */}
            </Flex>
          </Flex>
        </Flex>
      </Box>
    </Link>
  );
};

export default Post;
