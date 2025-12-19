import {
  Box,
  Flex,
  Image,
  Text,
  Skeleton,
  useColorModeValue,
  Link,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const LinkPreview = ({ url }) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const bg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const textColor = useColorModeValue("gray.800", "whiteAlpha.900");
  const secondaryTextColor = useColorModeValue("gray.600", "whiteAlpha.700");

  useEffect(() => {
    if (!url) return;

    const fetchPreview = async () => {
      try {
        setLoading(true);
        setError(null);

        // Parse URL to determine type
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split("/").filter(Boolean);

        // Check if it's a post URL: /username/post/:postId
        if (pathParts.length >= 3 && pathParts[1] === "post") {
          const postId = pathParts[2];
          const res = await fetch(`/api/posts/${postId}`, {
            credentials: "include",
          });

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }

          const data = await res.json();

          if (data.error) {
            throw new Error(data.error);
          }

          setPreview({
            type: "post",
            id: data._id,
            text: data.text || "",
            img: data.img || null,
            video: data.video || null,
            username: data.postedBy?.username || pathParts[0],
            profilePic: data.postedBy?.profilePic || "",
            url: url,
          });
        }
        // Check if it's a story URL: /username/story
        else if (pathParts.length >= 2 && pathParts[1] === "story") {
          const username = pathParts[0];
          const res = await fetch(`/api/users/profile/${username}`, {
            credentials: "include",
          });

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }

          const userData = await res.json();

          if (userData.error) {
            throw new Error(userData.error);
          }

          // Fetch user's stories
          const storiesRes = await fetch(`/api/stories/user/${userData._id}`, {
            credentials: "include",
          });

          if (!storiesRes.ok) {
            throw new Error(`HTTP ${storiesRes.status}`);
          }

          const storiesData = await storiesRes.json();

          if (storiesData.error) {
            throw new Error(storiesData.error);
          }

          const latestStory = storiesData.stories?.[0];

          setPreview({
            type: "story",
            username: username,
            profilePic: userData.profilePic || "",
            storyCount: storiesData.stories?.length || 0,
            latestStory: latestStory
              ? {
                  mediaUrl: latestStory.mediaUrl,
                  mediaType: latestStory.mediaType,
                  caption: latestStory.caption,
                }
              : null,
            url: url,
          });
        } else {
          throw new Error("Unsupported URL type");
        }
      } catch (err) {
        console.error("Error fetching preview:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [url]);

  if (loading) {
    return (
      <Box
        mt={2}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="lg"
        overflow="hidden"
        maxW="300px"
      >
        <Skeleton height="200px" />
        <Box p={3}>
          <Skeleton height="20px" mb={2} />
          <Skeleton height="16px" width="60%" />
        </Box>
      </Box>
    );
  }

  if (error || !preview) {
    return null; // Don't show anything if preview fails
  }

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (preview.type === "post") {
      navigate(`/${preview.username}/post/${preview.id}`);
    } else if (preview.type === "story") {
      // Navigate to user profile - they can click the story button there
      // Or we could emit a custom event to open story viewer
      navigate(`/${preview.username}`);
    }
  };

  if (preview.type === "post") {
    return (
      <Box
        mt={2}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="lg"
        overflow="hidden"
        maxW="300px"
        bg={bg}
        cursor="pointer"
        onClick={handleClick}
        _hover={{ opacity: 0.9 }}
      >
        {preview.img && (
          <Image
            src={preview.img}
            alt="Post preview"
            w="full"
            h="200px"
            objectFit="cover"
          />
        )}
        {preview.video && (
          <Box
            as="video"
            src={preview.video}
            w="full"
            h="200px"
            objectFit="cover"
            muted
            playsInline
          />
        )}
        <Box p={3}>
          <Flex alignItems="center" gap={2} mb={2}>
            {preview.profilePic && (
              <Image
                src={preview.profilePic}
                alt={preview.username}
                w={6}
                h={6}
                borderRadius="full"
              />
            )}
            <Text fontSize="sm" fontWeight="semibold" color={textColor}>
              {preview.username}
            </Text>
          </Flex>
          {preview.text && (
            <Text
              fontSize="sm"
              color={textColor}
              noOfLines={2}
              wordBreak="break-word"
            >
              {preview.text}
            </Text>
          )}
          {!preview.text && !preview.img && !preview.video && (
            <Text fontSize="xs" color={secondaryTextColor} fontStyle="italic">
              View post
            </Text>
          )}
        </Box>
      </Box>
    );
  }

  if (preview.type === "story") {
    return (
      <Box
        mt={2}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="lg"
        overflow="hidden"
        maxW="300px"
        bg={bg}
        cursor="pointer"
        onClick={handleClick}
        _hover={{ opacity: 0.9 }}
      >
        {preview.latestStory?.mediaUrl && (
          <Box position="relative" h="200px">
            {preview.latestStory.mediaType === "image" ? (
              <Image
                src={preview.latestStory.mediaUrl}
                alt="Story preview"
                w="full"
                h="full"
                objectFit="cover"
              />
            ) : (
              <Box
                as="video"
                src={preview.latestStory.mediaUrl}
                w="full"
                h="full"
                objectFit="cover"
                muted
                playsInline
              />
            )}
          </Box>
        )}
        <Box p={3}>
          <Flex alignItems="center" gap={2} mb={2}>
            {preview.profilePic && (
              <Image
                src={preview.profilePic}
                alt={preview.username}
                w={6}
                h={6}
                borderRadius="full"
              />
            )}
            <Text fontSize="sm" fontWeight="semibold" color={textColor}>
              {preview.username}
            </Text>
          </Flex>
          <Text fontSize="xs" color={secondaryTextColor}>
            {preview.storyCount > 0
              ? `${preview.storyCount} active ${
                  preview.storyCount === 1 ? "story" : "stories"
                }`
              : "No active stories"}
          </Text>
          {preview.latestStory?.caption && (
            <Text
              fontSize="sm"
              color={textColor}
              noOfLines={1}
              mt={1}
              wordBreak="break-word"
            >
              {preview.latestStory.caption}
            </Text>
          )}
        </Box>
      </Box>
    );
  }

  return null;
};

export default LinkPreview;
