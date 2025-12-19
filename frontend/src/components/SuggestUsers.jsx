import { Box, Flex, Skeleton, SkeletonCircle, Text, useColorModeValue, IconButton } from '@chakra-ui/react'
import React, { useEffect, useState } from 'react'
import SuggestedUser from './SuggestedUser'
import {toast} from "react-hot-toast"
import { AiOutlineClose } from 'react-icons/ai'

const SuggestUsers = ({ onHide }) => {
    const [loading,setLoading]=useState(true)
    const [suggestedUsers,setSuggestedUsers]=useState([])
    const [isHidden, setIsHidden] = useState(() => {
        // Check localStorage on initial render
        const hidden = localStorage.getItem('suggestedUsersHidden')
        return hidden === 'true'
    })

    const handleHide = () => {
        setIsHidden(true)
        localStorage.setItem('suggestedUsersHidden', 'true')
        if (onHide) {
            onHide()
        }
    }

    useEffect(()=>{
      const getSuggestedUsers = async()=>{
        try {
          const res = await fetch("/api/users/suggested")
          const data = await res.json()
          if(data.error){
            throw new Error(data.error)
          }
          setSuggestedUsers(data)
          console.log("suggestedUsers:",data) ;
        } catch (error) {
          toast.error(error.message)
        }finally{
          setLoading(false)
        }
      }
      getSuggestedUsers()

    },[])

    // Don't render if hidden
    if (isHidden) {
        return null
    }

  return (
    <>
    <Flex mb={4} justifyContent="space-between" alignItems="center">
      <Text fontWeight={'bold'} fontSize="sm" color={useColorModeValue("ink.700", "whiteAlpha.800")}>
        Suggested Users
      </Text>
      <IconButton
        aria-label="Hide suggested users"
        icon={<AiOutlineClose />}
        size="xs"
        variant="ghost"
        onClick={handleHide}
        colorScheme="gray"
      />
    </Flex>
      <Flex direction="column" gap={4}>
        {!loading && suggestedUsers.map(user=><SuggestedUser key={user._id} user={user} />)}
        {loading && [...Array(5)].map((_,idx)=>(
            <Flex  key={idx} gap={2} alignItems={"center"} p={"1"} borderRadius={"md"}  >
                <Box>
                    <SkeletonCircle size={"10"}/>
                </Box>

                <Flex w={"full"} flexDirection={"column"} gap={2}  >
                    <Skeleton h={"8px"}w={"80px"} ></Skeleton>
                    <Skeleton h={"8px"}w={"90px"} ></Skeleton>

                </Flex>

                <Flex>
                    <Skeleton h={"20px"} w={"60px"} />
                </Flex>

            </Flex>
        ))}

      </Flex>
    </>
  )
}

export default SuggestUsers
