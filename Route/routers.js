import express from "express";
import dotenv from "dotenv";
import { Configuration, OpenAIApi } from "openai";
import { db } from "../Firebase/initialize.js";
import { createRequire } from "module";
import axios from "axios";
import { stringify } from "querystring";

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
      const main_response = await openai.createCompletion("text-davinci-002", {
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
      res.json({
        http_code: 200,
        redirect_url: null,
        content_type: null,
        total_time: null,
      });
    }

    const snapshot = db.collection("users").doc(cache.get(req.body.email));
    const doc = await snapshot.get();

    if (req.body.alert_name === "subscription_created") {
      if (doc.exists) {
        if (doc.data().email === req.body.email) {
          const new_data = {
            checkout_id: req.body.checkout_id,
            update_url: req.body.update_url,
            user_id: req.body.user_id,
          };
          await snapshot.set(new_data, { merge: true });
          console.log("Data updated for subscription_created");
        } else {
          console.log("Email does not match for subscription_created");
        }
      } else {
        console.log("Document does not exist for subscription_created");
      }
    }

    if (req.body.alert_name === "subscription_payment_succeeded") {
      if (doc.exists) {
        if (doc.data().email === req.body.email) {
          let available_genarations;
          switch (req.body.subscription_plan_id) {
            case "26040":
              available_genarations = 100;
              break;
            case "26840":
              available_genarations = 300;
              break;
            case "27546": // These should be change in production
              available_genarations = 500;
          }

          const new_data = {
            available_genarations: available_genarations,
            generations: 0,
            customer_name: req.body.customer_name,
            status: req.body.status,
            plan_name: req.body.plan_name,
            event_time: req.body.event_time,
            next_bill_date: req.body.next_bill_date,
            instalments: req.body.instalments,
            marketing_consent: req.body.marketing_consent,
            order_id: req.body.order_id,
            subscription_id: req.body.subscription_id,
            subscription_plan_id: req.body.subscription_plan_id,
            p_signature: req.body.p_signature,
          };
          await snapshot.set(new_data, { merge: true });
          console.log("Data updated for subscription_payment_succeeded");
        } else {
          console.log("Emails do not match - subscription_payment_succeeded");
        }
      } else {
        console.log("document does not exist - subscription_payment_succeeded");
      }
    }

    if (req.body.alert_name === "subscription_updated") {
      if (doc.exists) {
        if (doc.data().email === req.body.email) {
          const new_data = {
            checkout_id: req.body.checkout_id,
            update_url: req.body.update_url,
            user_id: req.body.user_id,
            status: req.body.status,
            event_time: req.body.event_time,
            next_bill_date: req.body.next_bill_date,
            marketing_consent: req.body.marketing_consent,
            subscription_id: req.body.subscription_id,
            subscription_plan_id: req.body.subscription_plan_id,
            p_signature: req.body.p_signature,
            paused_at: req.body.paused_at,
            paused_from: req.body.paused_from,
            paused_reason: req.body.paused_reason,
          };
          await snapshot.set(new_data, { merge: true });
          console.log("Data updated");
        } else {
          console.log("Emails do not match - subscription_updated");
        }
      }
    }

    if (req.body.alert_name === "subscription_cancelled") {
      if (doc.exists) {
        if (doc.data().email === req.body.email) {
          const new_data = {
            email: doc.data().email,
            plan_name: "Free",
            free_generations: doc.data().free_generations,
            free_available_generations: doc.data().free_available_generations,
          };
          await snapshot.set(new_data);
          console.log("Subscription cancelled and updated");
        } else {
          console.log("Emails do not match - subscription_cancelled");
        }
      }
    }

    if (req.body.alert_name === "subscription_payment_failed") {
      if (doc.exists) {
        if (doc.data().email === req.body.email) {
          const new_data = {
            event_time: req.body.event_time,
            next_retry_date: req.body.next_retry_date,
            attempt_number: req.body.attempt_number,
          };
          await snapshot.set(new_data, { merge: true });
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

router.post("/api/v1/update/user", async (req, res) => {
  try {
    const snapshot = db.collection("users").doc(cache.get(req.body.email));
    const doc = await snapshot.get();

    if (doc.exists) {
      if (doc.data().email === req.body.email) {
        const planID = req.body.plan_id;
        const subscriptionID = doc.data().subscription_id;
        const options = {
          method: "POST",
          url: "https://sandbox-vendors.paddle.com/api/2.0/subscription/users/update",
          data: stringify({
            vendor_id: "5376", // Need to update for production
            vendor_auth_code:
              "7780038ca410ebba02d20e3d6c71010d772eb34abb4f4cb4c8", // Need to update for production
            subscription_id: subscriptionID,
            plan_id: planID,
            prorate: "true",
            bill_immediately: "true",
          }),
        };
        axios
          .request(options)
          .then((response) => {
            console.log(response.data);
            if (response.data.success === true) {
              res.json({ msg: "success", status: 200 });
            } else {
              res.json({ msg: "failed", status: 400 });
            }
          })
          .catch((error) => {
            console.error("Server " + error);
          });
      } else {
        console.log("Emails do not match");
      }
    }
  } catch (error) {
    console.log("" + error);
  }
});

router.post("/api/v1/firebase/auth", async (req, res) => {
  try {
    res.status(200);
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
