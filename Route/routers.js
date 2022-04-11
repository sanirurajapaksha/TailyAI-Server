import express from "express";
import dotenv from "dotenv";
import { Configuration, OpenAIApi } from "openai";
import { db } from "../Firebase/initialize.js";
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
    if (req.body !== null) {
      res.status(200);
    }

    const snapshot = db.collection("users").doc(cache.get(req.body.email));
    const doc = await snapshot.get();

    if (req.body.alert_name === "subscription_created") {
      if (doc.exists) {
        if (doc.data().email === req.body.email) {
          console.log("Both emails matches - payment created");
        } else {
          console.log("Emails do not match - payment created");
        }
      }
    }

    if (req.body.alert_name === "subscription_payment_succeeded") {
      if (doc.exists) {
        if (doc.data().email === req.body.email) {
          console.log("Both emails matches - payment succeeded");
        } else {
          console.log("Emails do not match - payment succeeded");
        }
      }
    }

    if (req.body.alert_name === "subscription_updated") {
      if (doc.exists) {
        if (doc.data().email === req.body.email) {
          console.log("Both emails matches - payment created");
        } else {
          console.log("Emails do not match - payment created");
        }
      }
    }

    if (req.body.alert_name === "subscription_cancelled") {
      if (doc.exists) {
        if (doc.data().email === req.body.email) {
          console.log("Both emails matches - payment created");
        } else {
          console.log("Emails do not match - payment created");
        }
      }
    }

    if (req.body.alert_name === "subscription_payment_failed") {
      if (doc.exists) {
        if (doc.data().email === req.body.email) {
          console.log("Both emails matches - payment created");
        } else {
          console.log("Emails do not match - payment created");
        }
      }
    }
  } catch (error) {
    console.log("" + error);
  }
});

router.post("/api/v1/firebase/auth", async (req, res) => {
  try {
    if (cache.get(req.body.email) !== null) {
      console.log(
        "auth_uid already set in cache: " + cache.get(req.body.email)
      );
    } else {
      cache.put(req.body.email, req.body.uid);
      console.log("auth_uid set: " + cache.get(req.body.email));
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
