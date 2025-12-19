import { Avatar, Box, Button, Flex, Text, useColorModeValue } from '@chakra-ui/react'
import React from 'react'
import { Link } from 'react-router-dom'
import usehandlefollowUnfollow from '../hooks/usehandlefollowUnfollow'

const SuggestedUser = ({user}) => {
   const {handleFollowAndUnfollow,updating,following}=usehandlefollowUnfollow(user)
  return (
    <Flex gap={3} justifyContent={"space-between"} alignItems={"center"}>
    <Flex gap={3} as={Link} to={`${user.username}`} alignItems="center">
        <Avatar src={user.profilePic} size="sm" />
        <Box>
            <Text fontSize={"sm"} fontWeight={"bold"}>
            {user.name}
            </Text>
            <Text color={useColorModeValue("ink.500", "whiteAlpha.600")} fontSize={"xs"}>
              {user.username}
            </Text>
        </Box>
    </Flex>
    <Button
        size={"sm"}
        variant={following ? "outline" : "solid"}
        colorScheme={following ? "gray" : "brand"}
        onClick={handleFollowAndUnfollow}
        isLoading={updating}
        _hover={{
            opacity: ".9",
        }}
    >
        {following ? "Unfollow" : "Follow"}
    </Button>
</Flex>
  )
}

export default SuggestedUser
