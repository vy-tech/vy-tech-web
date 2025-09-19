import van from "vanjs-core";
import { app } from "./data/firebase.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut,
} from "firebase/auth";

class Auth {
    constructor() {
        this.auth = getAuth(app);
        this.auth.onAuthStateChanged((user) => this.handleAuthState(user));
        this.user = null;
        this.isSignInEnabled = false;
        this.returnUrl = null;
    }

    enableSignIn() {
        this.setReturnUrl();
        this.isSignInEnabled = true;
    }

    hideBusyIndicator() {
        const busy = document.getElementById("busy");
        if (busy) {
            busy.classList.add("hidden");
        }
    }

    handleAuthState(user) {
        this.hideBusyIndicator();
        if (user) {
            this.user = user;
            if (this.returnUrl) {
                // Redirect to the return URL if it exists
                window.location.href = this.returnUrl;
            }
        } else {
            // No user is signed in.
            this.user = null;
            if (this.isSignInEnabled) {
                this.addSignInElements(document.body);
            }
        }
    }

    setReturnUrl() {
        this.returnUrl = "";
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has("return_url")) {
            this.returnUrl = urlParams.get("return_url");
        } else {
            this.returnUrl = "/dashboard";
        }
    }

    addSignInElements(parentElement) {
        const { button, div, input, label } = van.tags;

        van.add(
            parentElement,
            div(
                { class: "flex justify-center items-center mt-8" },
                div(
                    {
                        class: "bg-white dark:bg-gray-800 shadow-md rounded px-8 pt-6 pb-8 mb-4 w-1/3",
                    },
                    div(
                        { class: "mb-4" },
                        label(
                            {
                                for: "email",
                                class: "block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2",
                            },
                            "Email"
                        ),
                        input({
                            type: "email",
                            id: "email",
                            name: "email",
                            placeholder: "Enter your email",
                            class: "shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 leading-tight focus:outline-none focus:shadow-outline",
                        })
                    ),
                    div(
                        { class: "mb-6" },
                        label(
                            {
                                for: "password",
                                class: "block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2",
                            },
                            "Password"
                        ),
                        input({
                            type: "password",
                            id: "password",
                            name: "password",
                            placeholder: "Enter your password",
                            class: "shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 leading-tight focus:outline-none focus:shadow-outline",
                        })
                    ),
                    div(
                        { class: "flex items-center justify-between" },
                        button(
                            {
                                type: "button",
                                class: "bg-blue-500 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline",
                                onclick: () => {
                                    this.handleSignIn(
                                        document.getElementById("email").value,
                                        document.getElementById("password")
                                            .value
                                    );
                                },
                            },
                            "Sign In"
                        )
                    )
                )
            )
        );
    }

    handleSignIn(email, password) {
        signInWithEmailAndPassword(this.auth, email, password)
            .then((userCredential) => {
                // Signed in
                this.user = userCredential.user;
                // Redirect to the return URL
                window.location.href = this.returnUrl;
            })
            .catch((error) => {
                const errorCode = error.code;
                const errorMessage = error.message;
                console.error("Error signing in:", errorCode, errorMessage);
            });
    }

    signOut() {
        signOut(this.auth)
            .then(() => {
                console.log("User signed out.");
                this.user = null;
                window.location.href = "/users/login";
            })
            .catch((error) => {
                console.error("Error signing out:", error);
            });
    }
}

const auth = new Auth();
export { Auth, auth };
