import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC-zn2-KXJnAQE9FgAA_djv7bL0ZA-2uGQ",
  authDomain: "tailyai.firebaseapp.com",
  projectId: "tailyai",
  storageBucket: "tailyai.appspot.com",
  messagingSenderId: "354149931716",
  appId: "1:354149931716:web:296678b9f2389c77850791",
  measurementId: "G-0885S73VYN",
};

const firebaseApp = initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
