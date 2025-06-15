const asyncHandler = require("express-async-handler");
const Message = require("../models/messageModel");
const User = require("../models/userModel");
const Chat = require("../models/chatModel");

// @desc    Get all messages for a chat
// @route   GET /api/message/:chatId
// @access  Protected
const allMessages = asyncHandler(async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate("sender", "name pic email")
      .populate({
        path: "chat",
        populate: { path: "users", select: "name pic email" },
      });

    res.json(messages);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc    Send a new message in a chat
// @route   POST /api/message
// @access  Protected
const sendMessage = asyncHandler(async (req, res) => {
  const { content, chatId } = req.body;

  if (!content || !chatId) {
    return res.status(400).json({ message: "Content and chatId are required." });
  }

  try {
    // Create the message
    let message = await Message.create({
      sender: req.user._id,
      content,
      chat: chatId,
    });

    // Refetch the message and populate all needed fields
    message = await Message.findById(message._id)
      .populate("sender", "name pic")
      .populate({
        path: "chat",
        populate: { path: "users", select: "name pic email" },
      });

    // Update the latest message for the chat
    await Chat.findByIdAndUpdate(chatId, { latestMessage: message });

    // Return the populated message
    res.status(201).json(message);
  } catch (error) {
    console.error("Failed to send message:", error.message);
    res.status(500).json({ message: "Failed to send message." });
  }
});

module.exports = { allMessages, sendMessage };
