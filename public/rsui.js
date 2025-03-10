class RSUI extends RSObject {
    async setup() {
        this.computeLayout();
        this.showNavBar();
    }

    computeLayout() {        
        var lo = this.lo || {};

        lo.navBarHeight = 50;
        lo.titleHeight = 39;
        lo.buffer = 5;
        lo.width = window.innerWidth - lo.buffer;
        lo.height = window.innerHeight - lo.buffer - lo.navBarHeight;

        lo.signinWidth = 350;
        lo.signinHeight = 225;
        lo.signinX = lo.width/2 - lo.signinWidth/2;
        lo.signinY = lo.height/2 - lo.signinHeight/2;

        this.lo = lo;
        return lo;
    }

    createProfileSelector() {
        return this.rs.profiles.createSelector();
    }

    createSceneSelector() {
        return this.rs.scenes.createSelector();
    }

    showNavBar() {
        const { div, span, h1, a, i, label, select, option } = van.tags;

        van.add(document.body, 
            div({ id: "navbar", style: "height: 50px; display: flex; align-items: center; margin-top: 2px" },
            h1({ style: "flex:1; margin: 0; font-size: 20pt" }, "RoarScore"),

            span({ style: "flex: 2" }, 
                label({ style: "margin-right: 10px" }, "Scene"),
                this.createSceneSelector(),
            ),

            span({ style: "flex: 2" }, 
                label({ style: "margin-right: 10px" }, "Profile"),
                this.createProfileSelector()
            ),

            span({ style: "flex: 2" }), () => {
                if (this.rs.authState.val) {

                    return span(

                        a({ 
                            href: "#", style: "text-decoration: none; margin-right: 10px; color:black", 
                            onclick: () => { this.fb.auth.signOut(this.fb.auth.instance) } 
                        }, 
                        i({ class: "fa-solid fa-sign-out" }))
                    );
                }
                else {
                    return a({ 
                            href: "#", style: "text-decoration: none; margin-right: 10px", 
                            onclick: () => { this.showSigninWindow() } 
                        }, 
                        i({ class: "fa-solid fa-user-large" })
                    );
                }
            }
        ));
    }

    //
    // AUTH
    //

    showSigninWindow() {
        let lo = this.lo;
        const { div, form, label, input, button, h3, span, a } = van.tags;
        const closed = van.state(false);

        var email;
        var password;

        this.signinWindow = FloatingWindow(
            {
                title: "Sign In",
                x: lo.signinX, y: lo.signinY, width: lo.signinWidth, height: lo.signinHeight,
                childrenContainerStyleOverrides: { padding: 0 },
                closed, closeCross: null
            },
            span({
                class: "vanui-window-cross",
                style: "position: absolute; top: 8px; right: 8px;cursor: pointer;",
                onclick: () => closed.val = true,
            }, "\u00D7"),
            div(
                form({ id: "signin", style: "padding: 20px" },
                    h3("Please sign in for access to this feature"),
                
                    div(
                        label({ for: "email" }, "Email"),
                        email=input({ type: "email", required: true }),
                    ),
                    div(
                        label({ for: "password" }, "Password"),
                        password=input({ type: "password", required: true }),
                    ),
                    div(
                        button({ type: "button", onclick: (e) => { this.handleSignIn(email.value, password.value); return false; } }, "Sign In"),
                        button({ type: "button", style: "margin-left: 8px", onclick: (e) => { this.handleReset(email.value); return false; } }, "Reset"),
                    )
                )
            )
        );
        
        this.signinWindow.close = () => { closed.val = true; }

        van.add(document.body, this.signinWindow);
    }

    async handleSignIn(email, password) {
        try {
            var user = await this.auth.signInWithEmailAndPassword(this.auth.instance, email, password)
            console.log(user);
            if (user) {
                this.signinWindow.close();
            }
        }
        catch (e) {
            console.error(e);
        }
    }

    async handleReset(email) {
        if (!email)
            return alert('Please enter an email address');

        if (!confirm(`Send password reset email to ${email}?`))
            return

        try {
            await this.auth.sendPasswordResetEmail(this.auth.instance, email);
            this.signinWindow.close();
            console.log("Password reset email sent");
        }
        catch (e) {
            console.error(e);
        }
    }
}