import { initializeApp } from "firebase/app";
import { config } from "./firebase-config.js";

const app = initializeApp(config);

export { app };
