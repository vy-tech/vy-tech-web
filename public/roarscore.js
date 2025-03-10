class RoarScore extends EventTarget {
    static firebase = null;

    static connectFirebase(firebase) {
        RoarScore.firebase = firebase;
    }

    constructor() {
        super();

        this.lo = {};

        this.authState = van.state(false);
        
        this.ui = new RSUI(this);
        this.viz = new RSViz(this);
        this.profiles = new RSProfiles(this);
        this.scenes = new RSScenes(this);
        this.jobs = new RSJobs(this);
    }

    get fb() {
        return RoarScore.firebase;
    }

    async setup() {
        this.setupAuth();

        await this.ui.setup();
        await this.viz.setup();
        await this.profiles.setup();
        await this.scenes.setup();
        await this.jobs.setup();
    }

    async start() {
        await this.setup();

        //this.video.play();
        //this.action.play();
    }

    setupAuth() {
        console.log(this.fb);
        
        this.fb.auth.instance.onAuthStateChanged((user) => {
            if (user) {
                this.authState.val = true;
                console.log("User signed in");
            }
            else {
                this.authState.val = false;
                console.log("No user")
            }
        });
    }
}

