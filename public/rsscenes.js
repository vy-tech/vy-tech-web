
class RSScenes extends RSObject {
    constructor(rs) {
        super(rs);

        this.scene = van.state(null);
        this.scenes = van.state({});
    }

    async setup() {
        this.computeLayout();
        await this.load();
    }

    computeLayout() {        
        var lo = this.lo || {};

        lo.sceneWidth = 630;
        lo.sceneHeight = 245;
        lo.sceneX = lo.width/2 - lo.sceneWidth/2;
        lo.sceneY = lo.height/2 - lo.sceneHeight/2;

        this.lo = lo;
        return lo;
    }

    changeScene(sceneId) {
        this.scene.val = this.scenes.val[sceneId];
        this.dispatchEvent(new CustomEvent("sceneChanged", { detail: { scene: this.scene.val }}));
    }

    async load() {
        console.log("Fetching scenes..");
        var scenes = {};
        const snapshot = await this.fb.getDocs(this.fb.collection(this.fb.db, "scenes"));

        snapshot.forEach((doc) => {
            scenes[doc.id] = doc.data();
        });

        console.log("Setting scenes..");
        this.scenes.val = scenes;

        if (Object.keys(scenes).length > 0) {
            this.changeScene(Object.keys(scenes)[0]);
        }
    }

    createSelector() {
        const { div, span, h1, a, i, label, select, option } = van.tags;

        return span(
            // Select element
            span(() => {
                var options = Object.keys(this.scenes.val).map((key) => 
                    option({ value: key }, this.scenes.val[key].name)
                );

                return select({ 
                    id: "scene-selector",
                    style: "width: 300px",
                    onchange: () => this.changeScene(document.getElementById("scene-selector").value)
                }, options)
            }
            ),

            // Action buttons if logged in
            () => {
                if (this.rs.authState.val) {
                    return span(
                        a({ 
                            href: "#", style: "text-decoration: none; margin-left: 10px; color:black", 
                            onclick: () => { this.showList() }
                        }, 
                        i({ class: "fa-solid fa-gear" }))
                    );
                }
                else {
                    return span();
                }
            }
        )
    }

    showList() {
        let lo = this.lo;
        const { div, span, table, thead, tbody, tr, th, td, a, button } = van.tags;
        const closed = van.state(false);

        var height = Math.max(lo.listHeight, 110 + (Object.keys(this.scenes.val).length +1) * 30);
        var y = lo.height/2 - height/2;

        this.scenesList = FloatingWindow(
            {
                title: "Scenes",
                x: lo.listX, y: y, width: lo.listWidth, height: height,
                childrenContainerStyleOverrides: { padding: 0 },
                closed, closeCross: null
            },
            span({
                class: "vanui-window-cross",
                style: "position: absolute; top: 8px; right: 8px;cursor: pointer;",
                onclick: () => closed.val = true
            }, "×"),
            div(
                table({ class: "list" },
                    thead(
                        tr(
                            th("Name"),
                            th("Description")
                        )
                    ),
                    tbody(
                        Object.values(this.scenes.val).map((scene) => tr(
                            td(
                                a({ onclick: () => { 
                                    this.showEditor(scene);
                                    this.scenesList.close();
                                 }}, 
                                 scene.name)
                            ),
                            td(scene.description),
                        ))
                    )
                ),
                button({ class: "list-new-button", onclick: () => {
                    this.showEditor();
                    this.scenesList.close();
                }}, 
                "New Scene") 
            )
        );
        
        this.scenesList.close = () => { closed.val = true; }

        van.add(document.body, this.scenesList);
    }

    // Displays a scene editor form inside a FloatingWindow
    showEditor(scene) {
        let lo = this.lo;
        const { div, form, label, input, button, h3, span, progress } = van.tags;
        const closed = van.state(false);
        scene = scene || { name: "", description: "", audienceVideo: null, contextVideo: null };

        this.sceneEditor = FloatingWindow(
            {
                title: "Create Scene",
                x: lo.sceneX, y: lo.sceneY, width: lo.sceneWidth, height: lo.sceneHeight,
                childrenContainerStyleOverrides: { padding: 0 },
                closed, closeCross: null
            },
            span({
                class: "vanui-window-cross",
                style: "position: absolute; top: 8px; right: 8px;cursor: pointer;",
                onclick: () => closed.val = true
            }, "×"),
            div(
                form({ id: "scene_editor", class: "editor", style: "padding: 20px" },
                    input({ type:"hidden", name: "id", value: (scene.id || null) }),

                    div(
                        label({ for: "Name" }, "Name"),
                        input({ type: "text", name: "Name", required: true, value: scene.name })
                    ),

                    div(
                        label({ for: "Description" }, "Description"),
                        input({ type: "text", name: "Description", required: true, value: scene.description })
                    ),

                    div(
                        label({ for: "Audience Video" }, "Audience Video"),
                        input({ id: "audience_file", type: "file", name: "Audience Video", required: true }),
                        span({ id: "audience_message", style: "display: none" }),
                        progress({ id: "audience_progress", max: "100", value: "0", style: "visibility: hidden" })
                    ),

                    div(
                        label({ for: "Context Video" }, "Context Video"),
                        input({ type: "file", name: "Context Video", required: true }),
                        progress({ id: "context_progress", max: "100", value: "0", style: "visibility: hidden" })
                    ),

                    div({ class: "footer" }, 
                        button({ type: "button", onclick: (e) => { 
                            e.target.disabled = true;
                            var scene = this.getFromEditor(document.getElementById("scene_editor"));
                            this.handleSave(scene).then((createdJob) => { 
                                this.sceneEditor.close()
                            });
                            return false;
                        } }, "Save"), 
                        span(() => scene.id ? 
                            button({ type: "button", onclick: () => { 
                                this.handleDelete(scene).then(() => this.sceneEditor.close());
                                return false; 
                            } }, "Delete") : null,
                        )
                    )
                )
            )
        );
        
        this.sceneEditor.close = () => { closed.val = true; }

        van.add(document.body, this.sceneEditor);
    }    

    getById(id) {
        return this.scenes.val[id];
    }
    
    // Get a scene from the editor form
    getFromEditor(form) {        
        var scene = {
            id: form.id.value,
            name: form.Name.value,
            description: form.Description.value,
            audienceVideo: form["Audience Video"].files[0],
            contextVideo: form["Context Video"].files[0]
        };

        return scene;
    }

    // Save a scene to the firestore collection "scenes"
    async handleSave(scene) {
        try {
            var docRef = scene.id ?
                this.fb.doc(this.fb.db, "scenes", scene.id) :
                this.fb.doc(this.fb.collection(this.fb.db, "scenes"));
            scene.id = docRef.id;

            var audienceVideoRef = this.fb.ref(this.fb.storage, `scenes/${scene.id}/audience.mp4`);
            var contextVideoRef = this.fb.ref(this.fb.storage, `scenes/${scene.id}/context.mp4`);

            var createJob = false;
            
            if (scene.audienceVideo) {
                var audienceProgress = document.getElementById("audience_progress");
                var audienceTask = this.fb.uploadBytesResumable(audienceVideoRef, scene.audienceVideo);
                audienceTask.on("state_changed", (snapshot) => {
                    var progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    audienceProgress.style.visibility = "visible";
                    audienceProgress.value = progress;
                });
                await audienceTask;
                createJob = true;
            }

            if (scene.contextVideo) {
                var contextProgress = document.getElementById("context_progress");
                var contextTask = this.fb.uploadBytesResumable(contextVideoRef, scene.contextVideo);
                contextTask.on("state_changed", (snapshot) => {
                    var progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    contextProgress.style.visibility = "visible";
                    contextProgress.value = progress;
                });
                await contextTask
            }

            scene.audienceVideo = audienceVideoRef.fullPath;
            scene.contextVideo = contextVideoRef.fullPath;

            await this.fb.setDoc(docRef, scene);

            // Update the local scenes cache
            var scenes = { ...this.scenes.val };
            scenes[scene.id] = scene;
            this.scenes.val = scenes;

            if (createJob) {
                var job = await this.rs.jobs.create("DetectFacialExpressions", "scene", scene.id);
                var progress = document.getElementById("audience_progress");
                var span = document.getElementById("audience_message");
                var file = document.getElementById("audience_file");

                file.style.display = "none";
                span.style.display = "inline-block";
                span.innerText = "Processing..";
                progress.removeAttribute('value');
                progress.removeAttribute('max');

                await this.rs.jobs.waitOnJob(job.id, (job, message) => {
                    span.innerText = message;
                });
            }

            return createJob;
        }
        catch (err) {
            console.error(err);
            throw(err);
        }
    }

    async handleDelete(scene) {
        if (!confirm(`Are you sure you want to delete the scene "${scene.name}"?`))
            return;

        try {
            var docRef = this.fb.doc(this.fb.db, "scenes", scene.id);
            await this.fb.deleteDoc(docRef);

            // Update the local scenes cache
            var scenes = { ...this.scenes.val };
            delete scenes[scene.id];
            this.scenes.val = scenes;
        }
        catch (e) {
            console.error(e);
        }
    }
}