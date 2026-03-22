
const axios = require('axios');

const loadChatBox = async (req, res) => {
    try {
        res.render("chatBox");
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};

const chatbox = async (req, res) => {
    try {
        const userMessage = req.body.message;

        console.log('User  Message:', userMessage);

        // Send message to Rasa
        const response = await axios.post('http://localhost:5005/webhooks/rest/webhook', {
            sender: 'user',
            message: userMessage,
        });

        const aiReply = response.data[0]?.text || "Sorry, I couldn't process your request.";
        res.json({ reply: aiReply });
    } catch (error) {
        console.error('Chatbox Error:', error);
        res.status(500).json({ reply: "Oops! Something went wrong. Please try again later." });
    }
};

module.exports = {
    loadChatBox,
    chatbox
};