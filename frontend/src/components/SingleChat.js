import { FormControl } from "@chakra-ui/form-control";
import { Input } from "@chakra-ui/input";
import { Box, Text } from "@chakra-ui/layout";
import "./styles.css";
import { IconButton, Spinner, useToast } from "@chakra-ui/react";
import { getSender, getSenderFull } from "../config/ChatLogics";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { ArrowBackIcon } from "@chakra-ui/icons";
import ProfileModal from "./miscellaneous/ProfileModal";
import ScrollableChat from "./ScrollableChat";
import Lottie from "react-lottie";

import animationData from "../animations/typing.json";

import io from "socket.io-client";
import UpdateGroupChatModal from "./miscellaneous/UpdateGroupChatModal";
import { ChatState } from "../Context/ChatProvider";

const ENDPOINT = "http://localhost:5000"; // Backend server URL for Socket.io connection
var socket, selectedChatCompare; // socket instance and chat reference for comparison

const SingleChat = ({ fetchAgain, setFetchAgain }) => {
  // States to hold messages of current chat, loading spinner, new message input, and socket flags
  const [messages, setMessages] = useState([]); // Array of messages in the chat
  const [loading, setLoading] = useState(false); // Loading state when fetching messages
  const [newMessage, setNewMessage] = useState(""); // The current message being typed
  const [socketConnected, setSocketConnected] = useState(false); // Socket connection status
  const [typing, setTyping] = useState(false); // Whether current user is typing
  const [istyping, setIsTyping] = useState(false); // Whether the other user(s) are typing
  const toast = useToast(); // Chakra UI toast hook for notifications

  const typingTimeoutRef = useRef(null); // Ref to track typing timeout for debounce

  // Lottie animation configuration to show typing indicator animation
  const defaultOptions = {
    loop: true,
    autoplay: true,
    animationData: animationData, // JSON animation file imported
    rendererSettings: {
      preserveAspectRatio: "xMidYMid slice",
    },
  };

  // Retrieve global chat context state: current user, selected chat, notifications, etc.
  const { selectedChat, setSelectedChat, user, notification, setNotification } =
    ChatState();

  /**
   * Fetch all messages for the selected chat from the backend.
   * If no chat is selected, do nothing.
   * On success, update messages state and join the socket room for that chat.
   * Show a toast error if the request fails.
   */

  
  const fetchMessages = async () => {
    if (!selectedChat) return; // Exit if no chat is selected

    try {
      // Include Authorization token in request headers
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };

      setLoading(true); // Show spinner while fetching

      // GET request to fetch all messages of the chat by its ID
      const { data } = await axios.get(
        `/api/message/${selectedChat._id}`,
        config
      );

      setMessages(data); // Store fetched messages in state
      setLoading(false); // Hide spinner after messages loaded

      // Join the socket.io chat room for real-time communication
      socket.emit("join chat", selectedChat._id);
    } catch (error) {
      // Show error toast if fetching messages failed
      toast({
        title: "Error Occured!",
        description: "Failed to Load the Messages",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
    }
  };

  /**
   * Send a new message when user presses Enter key.
   * Emits 'stop typing' event to inform others the user stopped typing.
   * Posts the new message to backend API, updates messages list and notifies others via socket.
   * Displays an error toast on failure.
   */
  const sendMessage = async (event) => {
    // Only send if Enter is pressed and input is not empty/whitespace
    if (event.key === "Enter" && newMessage.trim()) {
      socket.emit("stop typing", selectedChat._id); // Notify stop typing to others

      try {
        // Set headers including auth token and content type
        const config = {
          headers: {
            "Content-type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
        };

        // Payload to send with POST request to backend
        const payload = {
          content: newMessage, // Text message content
          chatId: selectedChat._id, // Chat identifier
        };

        // Send message to backend API
        const { data } = await axios.post("/api/message", payload, config);

        setNewMessage(""); // Clear input field after sending
        socket.emit("new message", data); // Notify socket server and other clients of new message
        setMessages((prevMessages) => [...prevMessages, data]); // Add new message locally
      } catch (error) {
        // Show toast notification on send failure
        toast({
          title: "Error Occured!",
          description: "Failed to send the Message",
          status: "error",
          duration: 5000,
          isClosable: true,
          position: "bottom",
        });
      }
    }
  };

  /**
   * Initialize socket connection and set up event listeners on component mount.
   * Sends user info for setup and listens for connection, typing, and stop typing events.
   * Cleans up socket listeners and disconnects on component unmount.
   */
  useEffect(() => {
    socket = io(ENDPOINT); // Connect socket.io client to backend
    socket.emit("setup", user); // Send user info to backend to initialize connection

    socket.on("connected", () => setSocketConnected(true)); // Mark socket as connected
    socket.on("typing", () => setIsTyping(true)); // Someone else is typing, show typing indicator
    socket.on("stop typing", () => setIsTyping(false)); // Typing stopped, hide indicator

    // Cleanup listeners and disconnect socket on unmount
    return () => {
      socket.off("connected");
      socket.off("typing");
      socket.off("stop typing");
      socket.disconnect();
    };
  }, [user]);

  /**
   * Fetch messages when selected chat changes.
   * Also stores the currently selected chat reference for comparison in socket events.
   */
  useEffect(() => {
    fetchMessages(); // Load messages for the selected chat
    selectedChatCompare = selectedChat; // Save selected chat for message comparison
  }, [selectedChat]);

  /**
   * Listen for new messages received via socket.
   * If new message is for a different chat than currently selected,
   * add it to notifications and trigger fetchAgain to refresh chats.
   * If it belongs to current chat, add it directly to messages.
   * Sets up and cleans up the socket event listener properly.
   */
  useEffect(() => {
    const messageHandler = (newMessageRecieved) => {
      // If no chat selected or new message is for a different chat
      if (
        !selectedChatCompare ||
        selectedChatCompare._id !== newMessageRecieved.chat._id
      ) {
        // Add message to notifications if not already included
        if (!notification.includes(newMessageRecieved)) {
          setNotification([newMessageRecieved, ...notification]); // Add new notification
          setFetchAgain(!fetchAgain); // Trigger chat list refresh
        }
      } else {
        // New message belongs to currently selected chat, append locally
        setMessages((prevMessages) => [...prevMessages, newMessageRecieved]);
      }
    };

    // Subscribe to socket event
    socket.on("message recieved", messageHandler);

    // Cleanup on dependency or unmount change
    return () => {
      socket.off("message recieved", messageHandler);
    };
  }, [notification, fetchAgain, setNotification, setFetchAgain]);

  /**
   * Handle user typing input in the message input box.
   * Emits 'typing' event only once when user starts typing.
   * Uses a timeout to debounce and emit 'stop typing' if user stops typing for 3 seconds.
   */
  const typingHandler = (e) => {
    setNewMessage(e.target.value); // Update input field value

    if (!socketConnected) return; // Skip if socket not connected

    if (!typing) {
      setTyping(true); // Mark user as currently typing
      socket.emit("typing", selectedChat._id); // Notify others user started typing
    }

    // Clear existing timeout to avoid multiple stop typing events
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Set timeout to emit 'stop typing' event after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop typing", selectedChat._id); // Notify others typing stopped
      setTyping(false); // Reset typing status
    }, 3000);
  };

  // Clear typing timeout on component unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  return (
    <>
      {selectedChat ? (
        <>
          {/* Header bar showing back button, chat or user name, and relevant modals */}
          <Text
            fontSize={{ base: "28px", md: "30px" }}
            pb={3}
            px={2}
            w="100%"
            fontFamily="Work sans"
            d="flex"
            justifyContent={{ base: "space-between" }}
            alignItems="center"
          >
            {/* Back button shown on smaller screens to go back to chat list */}
            <IconButton
              d={{ base: "flex", md: "none" }}
              icon={<ArrowBackIcon />}
              onClick={() => setSelectedChat("")}
            />

            {/* Display chat info:
                - If not group chat, show sender name and profile modal
                - If group chat, show group name and group update modal */}
            {messages &&
              (!selectedChat.isGroupChat ? (
                <>
                  {getSender(user, selectedChat.users)}
                  <ProfileModal user={getSenderFull(user, selectedChat.users)} />
                </>
              ) : (
                <>
                  {selectedChat.chatName.toUpperCase()}
                  <UpdateGroupChatModal
                    fetchMessages={fetchMessages}
                    fetchAgain={fetchAgain}
                    setFetchAgain={setFetchAgain}
                  />
                </>
              ))}
          </Text>

          {/* Main chat messages container */}
          <Box
            d="flex"
            flexDir="column"
            justifyContent="flex-end"
            p={3}
            bg="#E8E8E8"
            w="100%"
            h="100%"
            borderRadius="lg"
            overflowY="hidden"
          >
            {/* Show spinner while messages are loading */}
            {loading ? (
              <Spinner size="xl" w={20} h={20} alignSelf="center" margin="auto" />
            ) : (
              // Display all chat messages with scroll support
              <div className="messages">
                <ScrollableChat messages={messages} />
              </div>
            )}

            {/* Input area for typing new messages */}
            <FormControl onKeyDown={sendMessage} id="first-name" isRequired mt={3}>
              {/* Show typing animation if other user(s) are typing */}
              {istyping && (
                <div>
                  <Lottie
                    options={defaultOptions}
                    width={70}
                    style={{ marginBottom: 15, marginLeft: 0 }}
                  />
                </div>
              )}
              {/* Input box for message typing */}
              <Input
                variant="filled"
                bg="#E0E0E0"
                placeholder="Enter a message..."
                value={newMessage || ""}
                onChange={typingHandler}
              />
            </FormControl>
          </Box>
        </>
      ) : (
        // When no chat is selected, show this prompt message
        <Box d="flex" alignItems="center" justifyContent="center" h="100%">
          <Text fontSize="3xl" pb={3} fontFamily="Work sans">
            Click on a user to start chatting
          </Text>
        </Box>
      )}
    </>
  );
};

export default SingleChat;
