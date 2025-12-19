import React, { useEffect } from "react";
import {
  Avatar,
  Box,
  Button,
  Divider,
  Flex,
  Image,
  Spinner,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { AiOutlineDelete } from "react-icons/ai";
import Actions from "../components/Actions";
import toast from "react-hot-toast";
import useGetUserProfilepic from "../hooks/useGetUserProfilepic";
import { useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useRecoilState, useRecoilValue } from "recoil";
import userAtom from "../atoms/userAtom";
import Comments from "../components/Comments";
import postsAtom from "../atoms/postsAtom";

const PostPage = () => {
  const [posts, setPosts] = useRecoilState(postsAtom);
  const { user, loading } = useGetUserProfilepic();
  const currentUser = useRecoilValue(userAtom);
  const { pid } = useParams();

  const navigate = useNavigate();
  // console.log("posts:",posts)
  const currentPost = posts[0];
  const surfaceBg = useColorModeValue("whiteAlpha.900", "blackAlpha.400");
  const surfaceBorder = useColorModeValue("sand.200", "ink.700");

  // console.log("currentPost[0]:",posts[0])

  useEffect(() => {
    const getPost = async () => {
      setPosts([]);
      try {
        const res = await fetch(`/api/posts/${pid}`);
        const data = await res.json();

        if (data.error) {
          throw new Error(data.error);
        }
        console.log("getPost - Full data:", data);
        console.log(
          "getPost - Has video:",
          !!data.video,
          "Video URL:",
          data.video
        );
        console.log("getPost - Has img:", !!data.img, "Img URL:", data.img);
        console.log("getPost - All keys:", Object.keys(data));
        setPosts([data]);
      } catch (error) {
        console.log("error in getPost", error.message);
        toast.error(error.message);
      }
    };
    getPost();
  }, [pid, setPosts]);

  const handleDeletePost = async () => {
    try {
      if (!window.confirm("Are you sure you want to delete this post?")) return;

      const res = await fetch(`/api/posts/${currentPost._id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }
      console.log(data);
      toast.success("Post deleted");
      navigate(`/${user.username}`);
    } catch (error) {
      console.log("error in deletePosy", error.message);
      toast.error(error.message);
    }
  };

  if (!user && loading) {
    return (
      <Flex justifyContent={"center"}>
        <Spinner size={"xl"} />
      </Flex>
    );
  }
  if (!currentPost) {
    return null;
  }

  return (
    <Box
      bg={surfaceBg}
      border="1px solid"
      borderColor={surfaceBorder}
      borderRadius="2xl"
      p={{ base: 4, md: 5 }}
      backdropFilter="blur(10px)"
      boxShadow="0 20px 40px -30px rgba(0, 0, 0, 0.35)"
    >
      <Flex>
        <Flex w={"full"} alignItems={"center"} gap={3}>
          <Avatar
            src={user?.profilePic}
            size={"md"}
            name="Mark Zucerberg"
          ></Avatar>
          <Flex>
            <Text fontSize={"sm"} fontWeight={"bold"}>
              {user?.username}
            </Text>
            <Image src="/verified.png" w="4" h={4} ml={4}></Image>
          </Flex>
        </Flex>
        <Flex gap={4} alignItems={"center"}>
          <Text
            fontSize={"xs"}
            width={36}
            textAlign={"right"}
            color={useColorModeValue("ink.500", "whiteAlpha.700")}
          >
            {formatDistanceToNow(new Date(currentPost.createdAt))} ago
          </Text>
          {currentUser?._id == user._id && (
            <AiOutlineDelete onClick={handleDeletePost} size={20} />
          )}
        </Flex>
      </Flex>
      <Text my={3}>{currentPost.text}</Text>
      {currentPost.img &&
        currentPost.img !== null &&
        currentPost.img.trim() !== "" && (
          <Box
            borderRadius="xl"
            borderColor={surfaceBorder}
            overflow={"hidden"}
            border={"1px solid"}
            my={3}
          >
            <Image src={currentPost.img} w={"full"} alt="Post image"></Image>
          </Box>
        )}
      {currentPost.video &&
        currentPost.video !== null &&
        currentPost.video !== "null" &&
        currentPost.video !== undefined &&
        typeof currentPost.video === "string" &&
        currentPost.video.trim() !== "" &&
        // Only render if it's a Cloudinary URL
        currentPost.video.includes("res.cloudinary.com") &&
        currentPost.video.includes("/video/upload/") && (
          <Box
            borderRadius="xl"
            borderColor={surfaceBorder}
            overflow={"hidden"}
            border={"1px solid"}
            my={3}
          >
            <video
              src={currentPost.video}
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
                console.error("Video URL:", currentPost.video);
                // Don't show error for non-Cloudinary URLs (they're filtered out)
              }}
              onLoadStart={() => {
                console.log("Video loading:", currentPost.video);
              }}
            >
              Your browser does not support the video tag.
            </video>
          </Box>
      )}
      <Flex gap={3} my={3}>
        <Actions
          post={currentPost}
          counts={currentPost.counts}
          viewerState={currentPost.viewerState}
        />
      </Flex>

      <Divider my={4} />
      <Flex justifyContent={"space-between"} alignItems="center">
        <Flex gap={2} alignItems={"center"}>
          <Text fontSize={"2x1"}>👋</Text>
          <Text color={useColorModeValue("ink.500", "whiteAlpha.600")}>
            Get the app to like and post
          </Text>
        </Flex>
        <Button size="sm">Get</Button>
      </Flex>
      <Divider my={4} />
      {currentPost &&
        currentPost.replies.map((reply) => {
          return (
            <Comments
              lastReply={
                reply._id ==
                currentPost.replies[currentPost.replies.length - 1]._id
              }
              key={reply._id}
              reply={reply}
            />
          );
        })}
      {/* <Comments
        createdAt="2d"
        likes={100}
        username="johndoe"
        userAvatar="https://bit.ly/tioluwani-kolawole"
        comment="Looks really good!"
      /> */}
    </Box>
  );
};

export default PostPage;
