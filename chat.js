
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      provider = "openai",
      messages = []
    } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Messages are required"
      });
    }

    if (messages.length > 50) {
      return res.status(400).json({
        error: "Too many messages"
      });
    }

    let answer = "";

    if (provider === "openai") {
      const key = process.env.OPENAI_API_KEY;

      if (!key) {
        throw new Error("OpenAI key is not configured");
      }

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`
          },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            messages
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error: data.error?.message || "OpenAI error"
        });
      }

      answer = data.choices?.[0]?.message?.content || "";
    }

    else if (provider === "gemini") {
      const key = process.env.GEMINI_API_KEY;

      if (!key) {
        throw new Error("Gemini key is not configured");
      }

      const systemMessage = messages.find(
        m => m.role === "system"
      );

      const contents = messages
        .filter(m => m.role !== "system")
        .map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: String(m.content || "") }]
        }));

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key
          },
          body: JSON.stringify({
            ...(systemMessage ? {
              systemInstruction: {
                parts: [{ text: String(systemMessage.content) }]
              }
            } : {}),
            contents
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error: data.error?.message || "Gemini error"
        });
      }

      answer =
        data.candidates?.[0]?.content?.parts
          ?.map(p => p.text || "")
          .join("") || "";
    }

    else {
      return res.status(400).json({
        error: "Unsupported provider"
      });
    }

    return res.status(200).json({
      answer
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
};
