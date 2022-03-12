import exress from "express";
import dotenv from "dotenv";
import { Configuration, OpenAIApi } from "openai";

const router = exress.Router();
dotenv.config();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

router.post("/api/v1/openai", async (req, res) => {
  const data = req.body.text;
  try {
    console.log("started to generate AI Completion");
    const response = await openai.createCompletion("text-davinci-001", {
      prompt: `Turn the given points into a meaningful email.\n\nGiven points: ${data}\nGenerated Email:`,
      temperature: 1,
      max_tokens: 250,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });
    res.send(response.data.choices[0].text);
  } catch (error) {
    console.log("error while generating AI Completion --> " + error);
  }
});

export default router;
