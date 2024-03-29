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
  try {
    const data = req.body.text;

    // Get the user's auth_id from the database
    const snapshot_for_auth_id = db.collection("auth_id").doc(req.body.email);
    const doc_for_auth_id = await snapshot_for_auth_id.get();

    // Get the user's data from the database using the auth_id
    const snapshot = db.collection("users").doc(doc_for_auth_id.data().auth_id);
    const doc = await snapshot.get();

    const prompt = `Write a convincing and substantially long email that fits any use case from the sender's point of view by using the given points.\n\nGiven Points: ${data}\nGenerated Email:`;

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
      const main_response = await openai.createCompletion("text-curie-001", {
        prompt: prompt,
        temperature: 1,
        max_tokens: 250,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        user: req.body.email,
      });
      return main_response;
    };

    const toxic_threshold = -0.355;
    const content_filter_value = (await getTheFilterResponse()).data.choices[0]
      .text;
    const longprob_value = (await getTheFilterResponse()).data.choices[0]
      .logprobs.top_logprobs[0][content_filter_value];

    if (content_filter_value == "0" || content_filter_value == "1") {
      if (
        doc.exists &&
        doc.data().email === req.body.email &&
        doc.data().plan_name === "Free"
      ) {
        if (
          doc.data().free_generations === doc.data().free_available_generations
        ) {
          res.send("limit_reached");
        } else {
          await snapshot
            .set(
              {
                free_generations: doc.data().free_generations + 1,
              },
              { merge: true }
            )
            .catch((error) => {
              console.log(error);
            });
          res.send((await getMainResponse()).data.choices[0].text);
        }
      } else if (
        doc.exists &&
        doc.data().email === req.body.email &&
        doc.data().subscription_plan_id !== null
      ) {
        if (doc.data().generations === doc.data().available_genarations) {
          res.send("limit_reached");
        } else {
          await snapshot
            .set({ generations: doc.data().generations + 1 }, { merge: true })
            .catch((error) => {
              console.log(error);
            });
          res.send((await getMainResponse()).data.choices[0].text);
        }
      }
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
    if (
      error.message ===
      `Value for argument "documentPath" is not a valid resource path. Path must be a non-empty string.`
    )
      res.send("cache_empty");
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

    // Get the user's auth_id from the database
    const snapshot_for_auth_id = db.collection("auth_id").doc(req.body.email);
    const doc_for_auth_id = await snapshot_for_auth_id.get();

    // Get the user's data from the database using the auth_id
    const snapshot = db.collection("users").doc(doc_for_auth_id.data().auth_id);
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
          console.log("subscription_created");
        } else {
          console.log("Email does not match - subscription_created");
        }
      } else {
        console.log("Document does not exist - subscription_created");
      }
    }

    if (req.body.alert_name === "subscription_payment_succeeded") {
      if (doc.exists) {
        if (doc.data().email === req.body.email) {
          let available_genarations;

          const generate_or_not = () => {
            const event_time = new Date(req.body.event_time).toDateString();
            const next_bill_date = new Date(
              doc.data().next_bill_date
            ).toDateString();
            if (event_time === next_bill_date) {
              return 0;
            } else {
              return doc.data().generations;
            }
          };

          switch (req.body.subscription_plan_id) {
            case "762199":
              available_genarations = 200;
              break;
            case "769448":
              available_genarations = 1000;
              break;
          }

          const new_data = {
            available_genarations: available_genarations,
            generations: doc.data().subscription_plan_id
              ? generate_or_not()
              : 0,
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
          console.log("subscription_payment_succeeded");
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
          console.log("subscription_updated");
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
          console.log("Subscription cancelled");
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
          console.log("subscription_payment_failed");
        } else {
          console.log("Emails do not match - subscription_payment_failed");
        }
      }
    }
  } catch (error) {
    console.log(error);
  }
});

router.post("/api/v1/update/user", async (req, res) => {
  try {
    // Get the user's auth_id from the database
    const snapshot_for_auth_id = db.collection("auth_id").doc(req.body.email);
    const doc_for_auth_id = await snapshot_for_auth_id.get();

    // Get the user's data from the database using the auth_id
    const snapshot = db.collection("users").doc(doc_for_auth_id.data().auth_id);
    const doc = await snapshot.get();

    if (doc.exists) {
      if (doc.data().email === req.body.email) {
        const planID = req.body.plan_id;
        const subscriptionID = doc.data().subscription_id;
        const options = {
          method: "POST",
          url: "https://vendors.paddle.com/api/2.0/subscription/users/update",
          data: stringify({
            vendor_id: "141614",
            vendor_auth_code:
              "45bde3ca927c41a8899f3a0c9d037521548c7aa7da6d48af5b",
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

router.post("/api/v1/extension-data", async (req, res) => {
  try {
    // Get the user's auth_id from the database
    const snapshot_for_auth_id = db.collection("auth_id").doc(req.body.email);
    const doc_for_auth_id = await snapshot_for_auth_id.get();

    // Get the user's data from the database using the auth_id
    const snapshot = db.collection("users").doc(doc_for_auth_id.data().auth_id);
    const doc = await snapshot.get();

    if (doc.exists && doc.data().plan_name === "Free") {
      res.send({
        generations: doc.data().free_generations,
        available_genarations: doc.data().free_available_generations,
      });
    } else if (doc.exists && doc.data().subscription_plan_id !== null) {
      res.send({
        generations: doc.data().generations,
        available_genarations: doc.data().available_genarations,
      });
    }
  } catch (error) {
    console.log("" + error);
  }
});

router.get("/", async (req, res) => {
  try {
    res.send("hello saniru");
  } catch (error) {
    console.log("" + error);
  }
});

export default router;
