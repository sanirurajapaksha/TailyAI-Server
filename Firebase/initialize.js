import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC-zn2-KXJnAQE9FgAA_djv7bL0ZA-2uGQ",
  authDomain: "tailyai.firebaseapp.com",
  projectId: "tailyai",
  storageBucket: "tailyai.appspot.com",
  messagingSenderId: "354149931716",
  appId: "1:354149931716:web:6d7ea5852f1d2de1850791",
  measurementId: "G-RSP1WH7FMB",
};

const firebaseApp = initializeApp(firebaseConfig);

export const db = getFirestore(firebaseApp);
