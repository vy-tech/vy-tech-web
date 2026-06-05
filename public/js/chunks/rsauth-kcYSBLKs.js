import { e as eventBus, v as van } from './eventbus-c5hoJhOF.js';
import { d as database, b as getAuth, g as getApp, c as signInWithEmailAndPassword, O as OAuthProvider, G as GoogleAuthProvider, e as signInWithPopup, f as fetchSignInMethodsForEmail, l as linkWithCredential, h as signOut } from './apiUtil-CDq4WBQY.js';
import { o as orgContext } from './orgContext-CvnztG5e.js';

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
        this.signInContainer = null;
        this.pendingCred = null;
        this.pendingEmail = null;
        this.init();
    }

    async init() {
        this.auth = getAuth(await getApp());
        this.auth.onAuthStateChanged(async (user) =>
            this.handleAuthState(user)
        );
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

    async handleAuthState(user) {
        this.hideBusyIndicator();

        if (user) {
            this.user = user;
            eventBus.fire("auth.ready", { user: this.user });

            if (this.returnUrl) {
                // Redirect to the return URL if it exists
                window.location.href = this.returnUrl;
            }

            // Get orgIds and poid from custom claims
            const idTokenResult = await user.getIdTokenResult();
            this.user.orgIds = idTokenResult.claims.orgIds || [];
            this.user.poid = idTokenResult.claims.poid || null;
            await orgContext.init(user);

            const userProfilesData = new UserProfilesData();
            const profile = await userProfilesData.ensureProfile(
                user.uid,
                user.email,
                user.displayName
            );
            eventBus.fire("auth.profileReady", { profile });
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
            this.returnUrl = "/home";
        }
    }

    addSignInElements(parentElement) {
        const {
            button,
            div,
            h3,
            hr,
            input,
            label,
            p,
            rect,
            span,
            svg,
            path,
        } = van.tags;

        const container = div(
            { class: "flex justify-center items-center mt-8" },
            div(
                {
                    class: "bg-white dark:bg-gray-800 shadow-md rounded px-8 pt-6 pb-8 mb-4 w-1/3",
                },
                p(
                    {
                        class: "text-center text-green-700 dark:text-green-400 text-sm font-semibold mb-6",
                    },
                    "Get $10 in credits to try Vy when you sign in for the first time."
                ),
                div(
                    { class: "flex justify-center" },
                    button(
                        {
                            type: "button",
                            class: "flex items-center gap-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:shadow-outline w-full justify-center",
                            onclick: () => this.handleGoogleSignIn(),
                        },
                            svg(
                                {
                                    viewBox: "0 0 24 24",
                                    width: "20",
                                    height: "20",
                                    xmlns: "http://www.w3.org/2000/svg",
                                },
                                path({
                                    d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z",
                                    fill: "#4285F4",
                                }),
                                path({
                                    d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z",
                                    fill: "#34A853",
                                }),
                                path({
                                    d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z",
                                    fill: "#FBBC05",
                                }),
                                path({
                                    d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z",
                                    fill: "#EA4335",
                                })
                            ),
                            "Sign in with Google"
                        )
                    ),
                    div(
                        { class: "flex justify-center mt-3" },
                        button(
                            {
                                type: "button",
                                class: "flex items-center gap-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:shadow-outline w-full justify-center",
                                onclick: () => this.handleMicrosoftSignIn(),
                            },
                            svg(
                                {
                                    viewBox: "0 0 24 24",
                                    width: "20",
                                    height: "20",
                                    xmlns: "http://www.w3.org/2000/svg",
                                },
                                rect({
                                    x: "1",
                                    y: "1",
                                    width: "10",
                                    height: "10",
                                    fill: "#F25022",
                                }),
                                rect({
                                    x: "13",
                                    y: "1",
                                    width: "10",
                                    height: "10",
                                    fill: "#7FBA00",
                                }),
                                rect({
                                    x: "1",
                                    y: "13",
                                    width: "10",
                                    height: "10",
                                    fill: "#00A4EF",
                                }),
                                rect({
                                    x: "13",
                                    y: "13",
                                    width: "10",
                                    height: "10",
                                    fill: "#FFB900",
                                })
                            ),
                            "Sign in with Microsoft"
                        )
                    ),
                    div(
                        { class: "flex items-center my-6" },
                        hr({
                            class: "flex-grow border-gray-300 dark:border-gray-600",
                        }),
                        span(
                            {
                                class: "px-3 text-gray-500 dark:text-gray-400 text-sm",
                            },
                            "or"
                        ),
                        hr({
                            class: "flex-grow border-gray-300 dark:border-gray-600",
                        })
                    ),
                    h3(
                        {
                            class: "text-gray-700 dark:text-gray-300 text-sm font-bold",
                        },
                        "Enterprise sign-in"
                    ),
                    p(
                        {
                            class: "text-gray-500 dark:text-gray-400 text-xs mb-4",
                        },
                        "Sign in with your enterprise email and password."
                    ),
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
            );

        this.signInContainer = container;
        van.add(parentElement, container);
    }


    replaceSignInContainer(newContainer) {
        if (this.signInContainer) {
            this.signInContainer.remove();
        }
        this.signInContainer = newContainer;
        van.add(document.body, newContainer);
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

    handleGoogleSignIn() {
        return this.signInWithFederatedProvider("google.com");
    }

    handleMicrosoftSignIn() {
        return this.signInWithFederatedProvider("microsoft.com");
    }

    getProviderInfo(providerId) {
        switch (providerId) {
            case "google.com":
                return {
                    id: providerId,
                    name: "Google",
                    create: () => new GoogleAuthProvider(),
                    credentialFromError: (err) =>
                        GoogleAuthProvider.credentialFromError(err),
                };
            case "microsoft.com":
                return {
                    id: providerId,
                    name: "Microsoft",
                    create: () => new OAuthProvider("microsoft.com"),
                    credentialFromError: (err) =>
                        OAuthProvider.credentialFromError(err),
                };
            case "password":
                return {
                    id: providerId,
                    name: "email and password",
                    create: null,
                    credentialFromError: null,
                };
            default:
                return {
                    id: providerId,
                    name: providerId,
                    create: null,
                    credentialFromError: null,
                };
        }
    }

    async signInWithFederatedProvider(providerId) {
        const info = this.getProviderInfo(providerId);
        try {
            const result = await signInWithPopup(this.auth, info.create());
            this.user = result.user;
            window.location.href = this.returnUrl;
        } catch (error) {
            if (
                error.code === "auth/account-exists-with-different-credential"
            ) {
                await this.startAccountLinking(providerId, error);
                return;
            }
            console.error(
                `Error signing in with ${info.name}:`,
                error.code,
                error.message
            );
        }
    }

    async startAccountLinking(attemptedProviderId, error) {
        const attemptedInfo = this.getProviderInfo(attemptedProviderId);
        const pendingCred = attemptedInfo.credentialFromError
            ? attemptedInfo.credentialFromError(error)
            : null;
        const email = error.customData?.email;

        if (!pendingCred || !email) {
            console.error(
                "Could not extract pending credential or email for account linking.",
                error.code
            );
            return;
        }

        this.pendingCred = pendingCred;
        this.pendingEmail = email;

        // Try to discover the existing provider. With Firebase's email-
        // enumeration protection enabled (default on newer projects) this
        // returns an empty array, so we fall back to offering the other
        // federated provider we support.
        let existingProviderId;
        try {
            const methods = await fetchSignInMethodsForEmail(this.auth, email);
            existingProviderId = methods.find(
                (m) => this.getProviderInfo(m).create !== null
            );
        } catch (e) {
            console.error("Could not look up existing sign-in methods:", e);
        }

        if (!existingProviderId) {
            existingProviderId =
                attemptedProviderId === "google.com"
                    ? "microsoft.com"
                    : "google.com";
        }

        this.showLinkingPrompt(email, existingProviderId, attemptedInfo.name);
    }

    showLinkingPrompt(email, existingProviderId, attemptedName) {
        const { button, div, h3, p } = van.tags;
        const existingInfo = this.getProviderInfo(existingProviderId);
        const canAutoLink = existingInfo.create !== null;

        const primaryButton = canAutoLink
            ? button(
                  {
                      type: "button",
                      class: "bg-blue-500 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline",
                      onclick: () => this.finishLinking(existingProviderId),
                  },
                  `Sign in with ${existingInfo.name} to link`
              )
            : button(
                  {
                      type: "button",
                      class: "bg-blue-500 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline",
                      onclick: () => this.cancelLinking(),
                  },
                  "Back to sign in"
              );

        const body = canAutoLink
            ? `An account already exists for ${email} using ${existingInfo.name}. Sign in with ${existingInfo.name} to link your ${attemptedName} account — after that you can use either one.`
            : `An account already exists for ${email} using ${existingInfo.name}. Please sign in using that method.`;

        const container = div(
            { class: "flex justify-center items-center mt-8" },
            div(
                {
                    class: "bg-white dark:bg-gray-800 shadow-md rounded px-8 pt-6 pb-8 mb-4 w-1/3",
                },
                h3(
                    {
                        class: "text-gray-700 dark:text-gray-300 text-lg font-bold mb-3",
                    },
                    "Link your accounts"
                ),
                p(
                    {
                        class: "text-gray-600 dark:text-gray-400 text-sm mb-5",
                    },
                    body
                ),
                div(
                    { class: "flex items-center justify-between" },
                    primaryButton,
                    button(
                        {
                            type: "button",
                            class: "text-gray-500 dark:text-gray-400 text-sm hover:underline",
                            onclick: () => this.cancelLinking(),
                        },
                        "Cancel"
                    )
                )
            )
        );

        this.replaceSignInContainer(container);
    }

    async finishLinking(existingProviderId) {
        const info = this.getProviderInfo(existingProviderId);
        if (!info.create || !this.pendingCred) {
            this.cancelLinking();
            return;
        }
        try {
            const result = await signInWithPopup(this.auth, info.create());
            await linkWithCredential(result.user, this.pendingCred);
            this.pendingCred = null;
            this.pendingEmail = null;
            this.user = result.user;
            window.location.href = this.returnUrl;
        } catch (error) {
            console.error(
                "Error linking accounts:",
                error.code,
                error.message
            );
        }
    }

    cancelLinking() {
        this.pendingCred = null;
        this.pendingEmail = null;
        if (this.signInContainer) {
            this.signInContainer.remove();
            this.signInContainer = null;
        }
        this.addSignInElements(document.body);
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
//# sourceMappingURL=rsauth-kcYSBLKs.js.map
