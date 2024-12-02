const fetch = require('node-fetch');

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
    console.log('User Message:', userMessage);

    const response = await fetch(`https://gemini.googleapis.com/v1/text:generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`, 
      },
      body: JSON.stringify({
        prompt: userMessage,
        temperature: 0.7,
        maxOutputTokens: 100,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API Error:', data);
      return res.status(response.status).json({ reply: 'Sorry, the AI service is currently unavailable. Please try again later.' });
    }

    const aiReply = data?.output || "Sorry, I couldn't process your request.";
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
