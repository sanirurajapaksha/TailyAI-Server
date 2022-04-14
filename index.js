import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "./Route/routers.js";

const app = express();
dotenv.config()

app.use(express.json({ extend: true }));
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use("/", router);

const PORT = process.env.PORT || 8080;

try {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
} catch (error) {
  console.log(error);
  process.exit(1);
}
