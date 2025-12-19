import React, { useEffect, useState } from "react";
import UserHeader from "../components/UserHeader";
// import UserPost from '../components/UserPost'
import toast from "react-hot-toast";
import { useParams } from "react-router-dom";
import { Flex, Button } from "@chakra-ui/react";
import { Spinner } from "@chakra-ui/react";
import Post from "../components/Post";
import StoryViewer from "../components/StoryViewer";
import useGetUserProfilepic from "../hooks/useGetUserProfilepic";
import { useRecoilState, useSetRecoilState } from "recoil";
import postsAtom from "../atoms/postsAtom";

const UserPages = () => {
  const { user, loading } = useGetUserProfilepic();
  const { username } = useParams();

  const [posts, setPosts] = useRecoilState(postsAtom);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [fetchingPost, setFechingPost] = useState(true);
  const [activeTab, setActiveTab] = useState("threads"); // "threads" | "replies" | "saved" | "reposts"
  const [isStoryViewerOpen, setIsStoryViewerOpen] = useState(false);

  useEffect(() => {
    const getPosts = async () => {
      if (!user) return;
      setFechingPost(true);
      setCurrentPage(1);
      try {
        let url = `/api/posts/user/${username}?page=1&limit=20`;
        if (activeTab === "saved") {
          url = "/api/posts/saved/me";
        } else if (activeTab === "reposts") {
          url = `/api/posts/user/${username}/reposts`;
        }

        const res = await fetch(url, {
          credentials: "include",
        });

        const data = await res.json();

        console.log("getPosts (profile):", activeTab, data);

        // Handle both old format (array) and new format (object with posts and pagination)
        const postsData = data.posts || data;
        const paginationData = data.pagination;

        if (Array.isArray(postsData) && postsData.length > 0) {
          console.log("Sample post from profile tab:", {
            tab: activeTab,
            id: postsData[0]._id,
            hasImg: !!postsData[0].img,
            hasVideo: !!postsData[0].video,
            img: postsData[0].img,
            video: postsData[0].video,
            allKeys: Object.keys(postsData[0]),
          });
        }
        if (data.error) {
          throw new Error(data.error);
        }
        setPosts(postsData);
        // For saved/replies/reposts we don't paginate yet
        setHasMore(
          activeTab === "threads" ? paginationData?.hasMore || false : false
        );
      } catch (error) {
        console.log("error in getPosts:", error.message);
        toast.error(error.message || error);
      } finally {
        setFechingPost(false);
      }
    };
    getPosts();
  }, [username, setPosts, user, activeTab]);

  // Load more posts
  const loadMorePosts = async () => {
    if (activeTab !== "threads") return;
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const nextPage = currentPage + 1;
      const res = await fetch(
        `/api/posts/user/${username}?page=${nextPage}&limit=20`
      );
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const newPosts = data.posts || data;
      setPosts((prev) => [...prev, ...newPosts]);
      setCurrentPage(nextPage);
      setHasMore(data.pagination?.hasMore || false);
    } catch (error) {
      console.log("error in loadMorePosts:", error.message);
      toast.error(error.message);
    } finally {
      setLoadingMore(false);
    }
  };

  console.log("posts recoil state - ", posts);

  if (!user && loading) {
    return (
      <Flex justifyContent={"center"}>
        <Spinner size="xl" />
      </Flex>
    );
  }
  if (!user && !loading) {
    return <h1>User not found</h1>;
  }

  return (
    <>
      <UserHeader
        user={user}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenStory={() => setIsStoryViewerOpen(true)}
      />

      {isStoryViewerOpen && user && (
        <StoryViewer
          userId={user._id}
          isOpen={isStoryViewerOpen}
          onClose={() => setIsStoryViewerOpen(false)}
        />
      )}

      {!fetchingPost && posts.length === 0 && (
        <h1>
          {activeTab === "saved"
            ? "No saved posts yet."
            : activeTab === "reposts"
            ? "No reposts yet."
            : "User have No posts."}
        </h1>
      )}
      {fetchingPost && (
        <Flex justifyContent={"center"} my={12}>
          <Spinner size={"xl"}></Spinner>
        </Flex>
      )}
      {posts.map((item, index) => {
        if (activeTab === "reposts") {
          const postId = item.post?._id || item._id;
          return (
            <Post
              key={postId}
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
        }

        return (
          <Post
            key={item._id}
            post={item}
            postedBy={item.postedBy}
            counts={item.counts}
            viewerState={item.viewerState}
            index={index}
          />
        );
      })}

      {/* Load More Button */}
      {!fetchingPost && hasMore && (
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
    </>
  );
};

export default UserPages;
