import { v as van } from './van-t8DywzvC.js';
import { d as database, g as getApp } from './db-CrlDs9Rt.js';
import { e as eventBus } from './eventbus-BMI3jhi1.js';
import { g as getAuth, s as signInWithEmailAndPassword, a as signOut } from './index-35c79a8a-DBAtCsce.js';
import './index.esm2017-D8q59gHf.js';
import { o as orgContext } from './orgContext-CaFI2n5U.js';

/**
 * UserProfilesData class manages user profile-related data operations.
 *
 * User profiles are represented in a single collection as follows:
 * - id: Record identifier, matches user id
 * - email: User's email address
 * - displayName: User's display name
 * - created: Timestamp of creation (auto-generated)
 * - updated: Timestamp of last update (auto-generated)
 */

const COLLECTION = "userProfiles";

class UserProfilesData {
    constructor() {}

    // =========================================================================
    // Query Methods
    // =========================================================================

    async getById(id) {
        return await database.get(COLLECTION, id);
    }

    async getByIds(ids) {
        return await database.query(COLLECTION, {
            id: { op: "in", value: ids },
        });
    }

    async ensureProfile(id, email, displayName) {
        let profile = await this.getById(id);

        if (!profile) {
            displayName = displayName || email;
            const newProfile = {
                id,
                email,
                displayName,
            };
            await database.set(COLLECTION, newProfile);
            profile = await this.getById(id);
        }

        return profile;
    }

    // =========================================================================
    // CRUD Methods
    // =========================================================================

    async update(id, updates) {
        const allowedFields = ["displayName"];
        const filteredUpdates = {};
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = updates[key];
            }
        }
        if (Object.keys(filteredUpdates).length > 0) {
            await database.update(COLLECTION, id, filteredUpdates);
        }
    }
}

class Auth {
    constructor() {
        this.auth = null;
        this.user = null;
        this.isSignInEnabled = false;
        this.returnUrl = null;
        this.init();
    }

    async init() {
        this.auth = getAuth(await getApp());
        this.auth.onAuthStateChanged((user) => this.handleAuthState(user));
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

            eventBus.fire("auth.ready", { user: this.user });

            if (this.returnUrl) {
                // Redirect to the return URL if it exists
                window.location.href = this.returnUrl;
            }

            const userProfilesData = new UserProfilesData();
            userProfilesData
                .ensureProfile(user.uid, user.email, user.displayName)
                .then(async (profile) => {
                    await orgContext.init(user.uid);
                    eventBus.fire("auth.profileReady", { profile });
                });
        } else {
            // No user is signed in.
            this.user = null;
            if (this.isSignInEnabled) {
                this.addSignInElements(document.body);
            }

            eventBus.fire("auth.unauthenticated", {});
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

if (typeof window !== "undefined") {
    window._vy_auth = auth;
}

export { Auth as A, UserProfilesData as U, auth as a };
//# sourceMappingURL=rsauth-BZGLHwGc.js.map
