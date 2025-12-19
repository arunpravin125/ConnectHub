import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Input,
  Textarea,
  Text,
  Flex,
  Avatar,
  Box,
  useColorModeValue,
  IconButton,
  VStack,
  Badge,
} from "@chakra-ui/react";
import { useState, useEffect, useRef } from "react";
import { useRecoilValue } from "recoil";
import userAtom from "../atoms/userAtom";
import toast from "react-hot-toast";
import { useRecoilState } from "recoil";
import {
  conversationAtom,
  selectedConversationAtom,
} from "../atoms/conversationAtom";
import { useSocket } from "../context/SocketContext";
import { FaUsers } from "react-icons/fa";
import { IoClose } from "react-icons/io5";

const CreateGroupModal = ({ isOpen, onClose }) => {
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const searchTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);
  const currentUser = useRecoilValue(userAtom);
  const [conversations, setConversations] = useRecoilState(conversationAtom);
  const [selectedConversation, setSelectedConversation] = useRecoilState(
    selectedConversationAtom
  );
  const { socket } = useSocket();

  const bg = useColorModeValue("white", "ink.800");
  const borderColor = useColorModeValue("sand.200", "ink.700");
  const hoverBg = useColorModeValue("sand.100", "ink.700");

  // Search suggestions with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (search.trim() === "") {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(
          `/api/users/search?query=${encodeURIComponent(search.trim())}`
        );
        const data = await res.json();

        if (data.error) {
          throw new Error(data.error);
        }

        // Filter out already selected members and current user
        const filtered = data.filter(
          (user) =>
            !selectedMembers.some((m) => m._id === user._id) &&
            user._id !== currentUser._id
        );

        setSearchSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
      } catch (error) {
        console.error("Error fetching search suggestions:", error);
        setSearchSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search, selectedMembers, currentUser]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target) &&
        !event.target.closest("[data-suggestion-item]")
      ) {
        setShowSuggestions(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setGroupName("");
      setGroupDescription("");
      setSelectedMembers([]);
      setSearch("");
      setSearchSuggestions([]);
      setShowSuggestions(false);
    }
  }, [isOpen]);

  const handleAddMember = (user) => {
    if (selectedMembers.some((m) => m._id === user._id)) {
      return;
    }
    setSelectedMembers([...selectedMembers, user]);
    setSearch("");
    setShowSuggestions(false);
  };

  const handleRemoveMember = (userId) => {
    setSelectedMembers(selectedMembers.filter((m) => m._id !== userId));
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Group name is required");
      return;
    }

    if (selectedMembers.length < 2) {
      toast.error("Please select at least 2 members");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/messages/group", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDescription.trim() || null,
          memberIds: selectedMembers.map((m) => m._id),
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Add to conversations list
      setConversations((prev) => [data, ...prev]);

      // Select the new group
      setSelectedConversation({
        _id: data._id,
        conversationId: data._id,
        isGroup: true,
        type: "group",
        groupName: data.name,
        groupDescription: data.description,
        groupIcon: data.iconUrl,
        members: data.members || [],
        createdBy: data.createdBy,
      });

      toast.success(`Group "${data.name}" created successfully!`);
      onClose();
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error(error.message || "Failed to create group");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay />
      <ModalContent bg={bg}>
        <ModalHeader>Create New Group</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            {/* Group Name Input */}
            <Box>
              <Text fontSize="sm" fontWeight="semibold" mb={2}>
                Group Name *
              </Text>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name"
                maxLength={50}
              />
            </Box>

            {/* Group Description Input */}
            <Box>
              <Text fontSize="sm" fontWeight="semibold" mb={2}>
                Description
              </Text>
              <Textarea
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="Enter group description (optional)"
                maxLength={500}
                rows={3}
                resize="vertical"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                {groupDescription.length}/500 characters
              </Text>
            </Box>

            {/* Selected Members */}
            {selectedMembers.length > 0 && (
              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb={2}>
                  Selected Members ({selectedMembers.length})
                </Text>
                <Flex flexWrap="wrap" gap={2}>
                  {selectedMembers.map((member) => (
                    <Flex
                      key={member._id}
                      alignItems="center"
                      gap={2}
                      bg={hoverBg}
                      px={3}
                      py={1.5}
                      borderRadius="full"
                    >
                      <Avatar
                        size="xs"
                        src={member.profilePic}
                        name={member.name}
                      />
                      <Text fontSize="sm">{member.username}</Text>
                      <IconButton
                        icon={<IoClose />}
                        size="xs"
                        variant="ghost"
                        aria-label="Remove"
                        onClick={() => handleRemoveMember(member._id)}
                      />
                    </Flex>
                  ))}
                </Flex>
              </Box>
            )}

            {/* Search for Members */}
            <Box>
              <Text fontSize="sm" fontWeight="semibold" mb={2}>
                Add Members
              </Text>
              <Box position="relative" ref={searchInputRef}>
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => {
                    if (searchSuggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                  placeholder="Search users to add"
                  autoComplete="off"
                />
                {/* Search Suggestions Dropdown */}
                {showSuggestions && (
                  <Box
                    position="absolute"
                    top="100%"
                    left={0}
                    right={0}
                    mt={1}
                    bg={bg}
                    border="1px solid"
                    borderColor={borderColor}
                    borderRadius="lg"
                    boxShadow="lg"
                    zIndex={1000}
                    maxH="200px"
                    overflowY="auto"
                  >
                    {loadingSuggestions ? (
                      <Flex p={3} align="center" justify="center">
                        <Text fontSize="sm" color="gray.500">
                          Searching...
                        </Text>
                      </Flex>
                    ) : searchSuggestions.length === 0 ? (
                      <Flex p={3} align="center" justify="center">
                        <Text fontSize="sm" color="gray.500">
                          No users found
                        </Text>
                      </Flex>
                    ) : (
                      searchSuggestions.map((user) => (
                        <Flex
                          key={user._id}
                          data-suggestion-item
                          p={3}
                          align="center"
                          gap={3}
                          cursor="pointer"
                          _hover={{ bg: hoverBg }}
                          onClick={() => handleAddMember(user)}
                          borderBottom="1px solid"
                          borderColor={borderColor}
                          _last={{ borderBottom: "none" }}
                        >
                          <Avatar
                            size="sm"
                            src={user.profilePic}
                            name={user.name}
                          />
                          <Box flex={1}>
                            <Text fontSize="sm" fontWeight="semibold">
                              {user.username}
                            </Text>
                            <Text fontSize="xs" color="gray.500">
                              {user.name}
                            </Text>
                          </Box>
                        </Flex>
                      ))
                    )}
                  </Box>
                )}
              </Box>
            </Box>

            {/* Info Text */}
            <Text fontSize="xs" color="gray.500">
              You need at least 2 members to create a group
            </Text>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="brand"
            onClick={handleCreateGroup}
            isLoading={isCreating}
            isDisabled={!groupName.trim() || selectedMembers.length < 2}
          >
            Create Group
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CreateGroupModal;
