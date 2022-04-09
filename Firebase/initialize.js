import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const service = require("./service-account.json");

initializeApp({
  credential: cert(service),
});

export const db = getFirestore();
