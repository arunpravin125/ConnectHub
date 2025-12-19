import { Box, Flex, Spinner, Button, Text, useColorModeValue } from "@chakra-ui/react";
import React, { useEffect, useState } from "react";

import Post from "../components/Post";
import { useRecoilState, useRecoilValue } from "recoil";
import postsAtom from "../atoms/postsAtom";
import SuggestUsers from "../components/SuggestUsers";
import StoriesRow from "../components/StoriesRow";
import toast from "react-hot-toast";
import { useSocket } from "../context/SocketContext";
import userAtom from "../atoms/userAtom";

const HomePage = () => {
  const [posts, setPosts] = useRecoilState(postsAtom);
  console.log("posts", posts);

  const user = useRecoilValue(userAtom);
  // const {socket,onlineUsers} =useSocket()

  const {
    socket,
    onlineUsers,
    notifications,
    setNotifications,
    notificationLength,
    setNotificationLength,
  } = useSocket();
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hideSuggestedUsers, setHideSuggestedUsers] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("suggestedUsersHidden") === "true";
  });
  useEffect(() => {
    const getFeedPosts = async () => {
      setLoading(true);
      setCurrentPage(1);

      try {
        const res = await fetch("/api/posts/feed?page=1&limit=20");
        const data = await res.json();

        console.log("getPostData:", data);

        // Check for errors first
        if (data.error || data.message) {
          throw new Error(data.error || data.message);
        }

        // Handle both old format (array) and new format (object with posts and pagination)
        const postsData = data.posts || data;
        const paginationData = data.pagination;

        // Ensure postsData is an array
        if (!Array.isArray(postsData)) {
          console.error("Invalid posts data format:", postsData);
          setPosts([]);
          setHasMore(false);
          return;
        }

        // Debug: Check if posts have video field
        if (postsData.length > 0) {
          console.log("Sample post from feed:", {
            id: postsData[0]._id,
            hasImg: !!postsData[0].img,
            hasVideo: !!postsData[0].video,
            img: postsData[0].img,
            video: postsData[0].video,
            allKeys: Object.keys(postsData[0]),
          });
        }
        
        setPosts(postsData);
        setHasMore(paginationData?.hasMore || false);
      } catch (error) {
        console.log("error in feedPage:", error.message);
        toast.error(error.message);
        // Ensure posts is always an array even on error
        setPosts([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    };
    getFeedPosts();
  }, []); // Only run once on mount, setPosts is stable

  // Load more posts
  const loadMorePosts = async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const nextPage = currentPage + 1;
      const res = await fetch(`/api/posts/feed?page=${nextPage}&limit=20`);
      const data = await res.json();

      // Check for errors first
      if (data.error || data.message) {
        throw new Error(data.error || data.message);
      }

      const newPosts = data.posts || data;
      
      // Ensure newPosts is an array
      if (!Array.isArray(newPosts)) {
        console.error("Invalid posts data format in loadMore:", newPosts);
        return;
      }

      setPosts((prev) => {
        // Ensure prev is an array
        if (!Array.isArray(prev)) {
          return newPosts;
        }
        return [...prev, ...newPosts];
      });
      setCurrentPage(nextPage);
      setHasMore(data.pagination?.hasMore || false);
    } catch (error) {
      console.log("error in loadMorePosts:", error.message);
      toast.error(error.message);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const getNotification = async () => {
      try {
        const res = await fetch("/api/notification/getNotification", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const data = await res.json();
        console.log("notification", data);
        if (data.error) {
          throw new Error(data.error);
        }
        setNotifications(data);
      } catch (error) {
        console.error("Error fetching notifications:", error);
        toast.error(error.message);
      }
    };
    getNotification();
  }, []); // Only run once on mount, setNotifications is stable

  useEffect(() => {
    const notificationLen = notifications.filter(
      (notifi) => notifi.read == false
    );
    setNotificationLength(notificationLen);
  }, [notifications]); // Only depend on notifications, not the setters or the state being set

  useEffect(() => {
    if (!socket) return;

    socket.on("livePost", ({ newPost }) => {
      console.log("livePost received:", newPost);
      console.log(
        "livePost - Has video:",
        !!newPost.video,
        "Video URL:",
        newPost.video
      );
      console.log(
        "livePost - Has img:",
        !!newPost.img,
        "Img URL:",
        newPost.img
      );
      if (newPost.postedBy !== user?._id) {
        setPosts((prev) => {
          // Ensure prev is an array
          if (!Array.isArray(prev)) {
            return [newPost];
          }
          return [newPost, ...prev];
        });
      }
    });
    return () => socket.off("livePost");
  }, [socket, user?._id]); // Remove setPosts, it's stable

  useEffect(() => {
    if (!socket) return;

    socket.on("live", ({ notification }) => {
      console.log("liveNotification", notification);
      setNotifications((prevNo) => [...prevNo, notification]);
    });
    return () => socket.off("live");
  }, [socket]); // Remove setters from dependencies, they're stable

  return (
    <Flex
      gap={{ base: 6, lg: 10 }}
      alignItems="flex-start"
      direction={{ base: "column", lg: "row" }}
    >
      <Box flex="1" w="full">
        {/* Stories Row */}
        <StoriesRow />

        {loading && (
          <Flex justify={"center"}>
            <Spinner size="xl"></Spinner>
          </Flex>
        )}
        {!loading && Array.isArray(posts) && posts.length == 0 && (
          <Text color={useColorModeValue("ink.500", "whiteAlpha.600")} fontSize="sm">
            Follow some users to start building your feed.
          </Text>
        )}

        {Array.isArray(posts) && posts.map((item, index) => {
          // Handle both old format (direct post) and new format (with itemType)
          const postId = item._id || (item.post && item.post._id);
          // Use a composite key to avoid duplicates when the same post appears with different item types
          const compositeKey = `${postId}-${item.itemType || "base"}-${index}`;
          return (
            <Post
              key={compositeKey}
              post={item.post || item}
              postedBy={item.post ? item.post.postedBy : item.postedBy}
              itemType={item.itemType}
              actor={item.actor}
              quoteText={item.quoteText}
              counts={item.counts}
              viewerState={item.viewerState}
              index={index}
            />
          );
        })}

        {/* Load More Button */}
        {!loading && hasMore && (
          <Flex justifyContent="center" py={4}>
            <Button
              size="md"
              colorScheme="blue"
              variant="outline"
              onClick={loadMorePosts}
              isLoading={loadingMore}
              loadingText="Loading..."
            >
              Load More Posts
            </Button>
          </Flex>
        )}
      </Box>
      <Box
        w={{ base: "full", lg: "320px" }}
        flexShrink={0}
        display={{ base: "block", lg: "block" }}
        order={{ base: 2, lg: 0 }}
      >
        {!hideSuggestedUsers && (
          <Box
            bg={useColorModeValue("whiteAlpha.900", "blackAlpha.400")}
            border="1px solid"
            borderColor={useColorModeValue("sand.200", "ink.700")}
            borderRadius="2xl"
            p={{ base: 4, md: 5 }}
            backdropFilter="blur(10px)"
            boxShadow="0 20px 40px -30px rgba(0, 0, 0, 0.35)"
          >
            {/* SUGGESTED USER COMPONENT */}
            <SuggestUsers onHide={() => setHideSuggestedUsers(true)} />
          </Box>
        )}
      </Box>
    </Flex>
  );
};

export default HomePage;
