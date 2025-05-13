import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import { config } from "/js/firebase-config.js";

const app = initializeApp(config);

export { app };
