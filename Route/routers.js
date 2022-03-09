import exress from "express";
import { Configuration, OpenAIApi } from "openai";

const router = exress.Router();

const configuration = new Configuration({
  apiKey: "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",
});

const openai = new OpenAIApi(configuration);

router.post("/api/v1/openai", async (req, res) => {
  const data = req.body;
  try {
    console.log("started to generate AI Completion");
    const response = await openai.createCompletion("text-davinci-001", {
      prompt: `Generate an Email to send according to the given context\n\nGiven context: ${data}\nGenerated Email:`,
      temperature: 1,
      max_tokens: 250,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });
    console.log(response.data.choices[0].text);
    console.log("successfully Generated AI Completion");
  } catch (error) {
    console.log("error while generating AI Completion --> " + error);
  }
});

export default router;
