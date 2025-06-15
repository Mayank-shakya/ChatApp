import { Button } from "@chakra-ui/button";
import { FormControl, FormLabel } from "@chakra-ui/form-control";
import { Input, InputGroup, InputRightElement } from "@chakra-ui/input";
import { VStack } from "@chakra-ui/layout";
import { useState } from "react";
import axios from "axios";
import { useToast } from "@chakra-ui/react";
import { useHistory } from "react-router-dom";
import { ChatState } from "../../Context/ChatProvider";

const Login = () => {
  // State to toggle password visibility (show/hide password)
  const [show, setShow] = useState(false);

  // Function to toggle password visibility
  const handleClick = () => setShow(!show);

  // Chakra UI toast for notifications (success, error, warning)
  const toast = useToast();

  // State to store email input value (initialized as empty string to avoid uncontrolled input warning)
  const [email, setEmail] = useState("");

  // State to store password input value (initialized as empty string)
  const [password, setPassword] = useState("");

  // State to track loading status when submitting login form
  const [loading, setLoading] = useState(false);

  // React Router history object to programmatically navigate between pages
  const history = useHistory();

  // Destructure setUser function from global chat context to store logged-in user info
  const { setUser } = ChatState();

  /**
   * Handles login form submission
   * - Validates that email and password fields are filled
   * - Sends POST request to backend API to authenticate user
   * - On success, updates user context, stores user info in localStorage, shows success toast, and redirects to chat page
   * - On failure, shows error toast with backend error message
   */
  const submitHandler = async () => {
    setLoading(true); // Show loading spinner on button

    // Check if email or password is empty
    if (!email || !password) {
      toast({
        title: "Please Fill all the Fields",
        status: "warning",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      setLoading(false); // Stop loading spinner
      return; // Exit early, do not proceed
    }

    try {
      // Set headers for axios POST request, content type is JSON
      const config = {
        headers: {
          "Content-type": "application/json",
        },
      };

      // Send login request with email and password to backend endpoint
      const { data } = await axios.post(
        "/api/user/login",
        { email, password },
        config
      );

      // Show success toast on successful login
      toast({
        title: "Login Successful",
        status: "success",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });

      setUser(data); // Update global user context with logged-in user data

      // Store user info in localStorage for persistent login state
      localStorage.setItem("userInfo", JSON.stringify(data));

      setLoading(false); // Stop loading spinner

      history.push("/chats"); // Redirect user to chats page
    } catch (error) {
      // Show error toast with specific error message from backend
      toast({
        title: "Error Occurred!",
        description: error.response?.data?.message || "An error occurred",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      setLoading(false); // Stop loading spinner even on failure
    }
  };

  return (
    <VStack spacing="10px">
      {/* Email input field */}
      <FormControl id="email" isRequired>
        <FormLabel>Email Address</FormLabel>
        <Input
          value={email} // Controlled input value bound to email state
          type="email"
          placeholder="Enter Your Email Address"
          onChange={(e) => setEmail(e.target.value)} // Update email state on input change
        />
      </FormControl>

      {/* Password input field with show/hide toggle */}
      <FormControl id="password" isRequired>
        <FormLabel>Password</FormLabel>
        <InputGroup size="md">
          <Input
            value={password} // Controlled input value bound to password state
            onChange={(e) => setPassword(e.target.value)} // Update password state on input change
            type={show ? "text" : "password"} // Show password as text if toggled on
            placeholder="Enter password"
          />
          <InputRightElement width="4.5rem">
            {/* Button to toggle password visibility */}
            <Button h="1.75rem" size="sm" onClick={handleClick}>
              {show ? "Hide" : "Show"}
            </Button>
          </InputRightElement>
        </InputGroup>
      </FormControl>

      {/* Login button */}
      <Button
        colorScheme="blue"
        width="100%"
        style={{ marginTop: 15 }}
        onClick={submitHandler} // Calls submitHandler on click
        isLoading={loading} // Shows loading spinner while request is in progress
      >
        Login
      </Button>

      {/* Button to autofill guest user credentials for quick login */}
      <Button
        variant="solid"
        colorScheme="red"
        width="100%"
        onClick={() => {
          setEmail("guest@example.com"); // Set guest email
          setPassword("123456"); // Set guest password
        }}
      >
        Get Guest User Credentials
      </Button>
    </VStack>
  );
};

export default Login;
