import express from "express";
import dotenv from "dotenv";
import { Configuration, OpenAIApi } from "openai";
import { db } from "../Firebase/initialize.js";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const cache = require("memory-cache");

const router = express.Router();
dotenv.config();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

router.post("/api/v1/openai", async (req, res) => {
  const data = req.body.text;
  const prompt = `Turn the given points into a meaningful and polite email.\n\nGiven points: ${data}\nGenerated Email:`;
  try {
    const getTheFilterResponse = async () => {
      const filter_response = await openai.createCompletion(
        "content-filter-alpha",
        {
          prompt: `<|endoftext|>${prompt}\n--\nLabel:`,
          temperature: 0,
          max_tokens: 1,
          top_p: 0,
          logprobs: 10,
        }
      );
      return filter_response;
    };

    const getMainResponse = async () => {
      const main_response = await openai.createCompletion("text-davinci-001", {
        prompt: prompt,
        temperature: 1,
        max_tokens: 250,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      });
      return main_response;
    };

    const toxic_threshold = -0.355;
    const content_filter_value = (await getTheFilterResponse()).data.choices[0]
      .text;
    const longprob_value = (await getTheFilterResponse()).data.choices[0]
      .logprobs.top_logprobs[0][content_filter_value];

    if (content_filter_value == "0" || content_filter_value == "1") {
      res.send((await getMainResponse()).data.choices[0].text);
    } else if (
      content_filter_value == "2" &&
      longprob_value < toxic_threshold
    ) {
      res.send("regenerate");
    } else if (
      content_filter_value == "2" &&
      longprob_value > toxic_threshold
    ) {
      res.send("toxic");
    }
  } catch (error) {
    console.log("" + error);
  }
});

router.post("/api/v1/paddle/webhooks", async (req, res) => {
  try {
    if (req.body.alert_name === "subscription_created")
      getDoc(doc(db, "users", cache_base.get("auth_uid")))
        .then((docSnap) => {
          if (docSnap.exists()) {
            if (docSnap.data().email === req.body.email) {
              console.log("Both matches");
            }
          }
        })
        .catch((error) => {
          console.log("Error getting document:", error);
        });
  } catch (error) {
    console.log("" + error);
  }
});

router.post("/api/v1/firebase/auth", async (req, res) => {
  try {
    if (cache.get("auth_uid") !== null) {
      console.log("auth_uid already set in cache: " + cache.get("auth_uid"));
    } else {
      cache.put("auth_uid", req.body.uid);
      console.log("auth_uid set: " + cache.get("auth_uid"));
    }
  } catch (error) {
    console.log("" + error);
  }
});

router.get("/", async (req, res) => {
  try {
    res.send(auth);
  } catch (error) {
    console.log("" + error);
  }
});

export default router;
