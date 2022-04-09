import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "module"; // Bring in the ability to create the 'require' method

const require = createRequire(import.meta.url); // construct the require method
const service = require("./service-account.json");

initializeApp({
  credential: cert(service),
});

export const db = getFirestore();
