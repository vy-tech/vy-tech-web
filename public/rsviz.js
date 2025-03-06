class RSViz extends RSObject {
    BOX_SCALE = 5.0;
    HISTORY_LENGTH = 100;

    async setup() {
        this.computeLayout();
        this.showVideoWindow();
        this.showBreakdownWindow();
        this.showGraphWindow();
        this.showContextWindow();

        this.rs.scenes.addEventListener("sceneChanged", (e) => this.changeScene(e.detail.scene));
        this.rs.profiles.addEventListener("profileChanged", (e) => this.changeProfile(e.detail.profile));
    }

    start() {
        this.video.play();
        this.action.play();
    }

    async changeScene(scene) {
        await this.loadData(scene);
        document.getElementById('main_video').src = await this.createDownloadUrl(scene.audienceVideo);
        document.getElementById('action_video').src = await this.createDownloadUrl(scene.contextVideo);

        this.applyProfile();
    }

    changeProfile(profile) {
        this.profile = profile;
        this.applyProfile();
    }

    applyProfile() {
        if (this.profile && this.data) {
            console.log("Applying profile");

            for (var row of this.data) {
                for (var emotion of row.emotions) {
                    if (this.profile.emotions[emotion.name]) {
                        emotion.score = emotion.confidence * this.profile.emotions[emotion.name];
                    }
                }
            }
        }
    }

    async loadData(scene) {
        if (scene && scene.results) {
            this.data = await this.fetchData(scene.results);

            this.currentIndex = 0;
            this.paintData = [];
            this.next = this.data[0];
        }
        else {
            console.error("Could not change scene, was empty or missing results");
        }
    }

    computeLayout() {        
        var lo = this.lo || {};

        lo.videoX = lo.buffer;
        lo.videoY = lo.buffer + lo.navBarHeight;
        lo.videoWidth = lo.width * 0.5 - lo.buffer * 2;
        lo.videoHeight = lo.videoWidth / 1.777 + lo.titleHeight;
        
        lo.breakdownX = lo.videoX + lo.videoWidth + lo.buffer;
        lo.breakdownY = lo.videoY;
        lo.breakdownWidth = lo.width * 0.5 - lo.buffer;
        lo.breakdownHeight = lo.videoHeight;

        lo.graphX = lo.buffer;
        lo.graphY = lo.videoY + lo.videoHeight + lo.buffer;
        lo.graphWidth = lo.videoWidth;
        lo.graphHeight = lo.height - lo.videoHeight - lo.buffer;

        lo.contextX = lo.breakdownX;
        lo.contextY = lo.graphY;
        lo.contextWidth = lo.breakdownWidth;
        lo.contextHeight = lo.graphHeight;

        this.lo = lo;
        return lo;
    }

    //
    // VIDEO EVENTS
    //

    requestVideoFrameCallback() {
        this.videoFrameCallbackRunning = true;
        this.video.requestVideoFrameCallback((now, metadata) => {
            // The metadata mediaTime continues passed the duration when the video loops
            // To get the mediaTime relative to the video showing we need to subtract 
            // the duration while it's over.
            var mediaTime = metadata.mediaTime % this.video.duration;

            this.handleMediaTime(mediaTime);
            this.requestVideoFrameCallback();
        });
    }

    findTimeIndex(time) {
        for (var i=0; i<this.data.length-1; i++) {
            if (this.data[i].time >= time)
                return i;
        }

        return -1;
    }

    handleMediaTime(mediaTime) {
        // While the video play time is passed the next frame of data, copy it into our
        // paintData array then increment the index.
        while (this.next && mediaTime > this.next.time) {
            this.currentIndex++;
            this.paintData.push(this.next);
            this.next = this.data[this.currentIndex];
        }

        // If we scrub then we need to reset currentIndex
        if (mediaTime < this.lastMediaTime || mediaTime - this.lastMediaTime > 1) {
            this.currentIndex = this.findTimeIndex(mediaTime);
            this.paintData = [];
            this.next = this.data[this.currentIndex];
        }

        if (this.paintData.length > 0) {
            this.paintData = this.paintData.filter((row) => mediaTime - row.time < 1);
        }

        this.lastMediaTime = mediaTime;

        if (Math.abs(mediaTime-this.action.currentTime) > 1)
            this.action.currentTime = mediaTime;

        this.calculate();
        this.paint();
    }

    // 
    // VISUALIZATION
    //

    calculate() {
        this.groupData();
        this.plotData();
    }

    paint() {
        this.paintHeatmap();
        this.paintBreakdown();
        this.paintGraph();
        this.paintJumbo();
    }

    groupData() {
        var grouped = {};
        var key;
        
        for (var row of this.paintData) {
            key = row.emotions[0].name
            grouped[key] = grouped[key] || { "emotion": key, "count": 0, "score": 0 };
            grouped[key].count++;
            grouped[key].score += row.emotions[0].score * 100;
        }

        var keys = Object.keys(grouped).sort((a,b) => grouped[b].score-grouped[a].score);
        this.groupedData = keys.map((k) => grouped[k]);
        this.totalScore = this.groupedData.reduce((tot,row) => tot + row.score, 0);
        this.totalCount = this.groupedData.reduce((tot,row) => tot + row.count, 0);
        this.total = this.totalScore/this.totalCount * 20;
        if (this.total > 2000) this.total = 2000;
        else if (this.total < -2000) this.total = -2000;
        else if (isNaN(this.total)) this.total = 0;
    }

    plotData() {
        this.history = this.history || [];
        this.history.push({
            "time": this.lastMediaTime,
            "score": this.total
        });

        if (this.history.length > this.HISTORY_LENGTH)
            this.history.shift();

        var min = 99999999;
        var max = -99999999;
        //for (var point of this.history) {
        //    min = Math.min(point.score, min);
        //    max = Math.max(point.score, max);
        //}
        //
        max = 2000;
        min = -2000;

        this.history.forEach((point) => point.plot = (point.score - min) / (max - min));
    }

    paintHeatmap() {
        var ctx = this.overlay.getContext("2d");
        ctx.clearRect(0, 0, 1920, 1050);
        ctx.fillStyle = "rgba(64,64,64,0.333)";
        ctx.fillRect(0,0, 1920, 1050);

        for (var i=0; i<this.paintData.length; i++) {
            var row = this.paintData[i];
            var w = row.box.w * this.BOX_SCALE;
            var h = row.box.h * this.BOX_SCALE;
            var x = row.box.x - (w - row.box.w)/2;
            var y = row.box.y - (h - row.box.h)/2;
            
            var centerX = x + w / 2;
            var centerY = y + h / 2;
            var innerR = 1;
            var outerR = h / 2;
            var hue = 64 + row.emotions[0].score * 64;

            var gradient = ctx.createRadialGradient(centerX, centerY, innerR, centerX, centerY, outerR);
            gradient.addColorStop(0, `hsl(${hue}, 100%, 50%, 50%)`);
            gradient.addColorStop(1, `hsl(${hue}, 100%, 50%, 0%)`)
            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, w, h);
        }
    }

    paintBreakdown() {
        var html = `<div><span class="total">RoarScore ${this.total.toFixed(2)}</span></div>`;

        for (var row of this.groupedData) {
            html += `<div><span class="emotion">${row.emotion}</span>` +
                `<span class="count">x ${row.count}</span>` +
                `<span class="score">${row.score.toFixed(2)}</span></div>`;
        }

        this.breakdown.innerHTML = html;
    }

    paintGraph() {
        var w = this.graph.width;
        var h = this.graph.height;
        var ctx = this.graph.getContext("2d");

        ctx.clearRect(0,0,w,h);
        if (!this.history || !this.history.length)
            return;

        ctx.beginPath();
        ctx.moveTo(0, (1-this.history[0].plot) * h);
        var step = w / this.history.length;

        for (var i=1; i<this.history.length; i++) {
            let val = ((1-(this.history[i-1].plot + this.history[i].plot) / 2)) * h;
            ctx.lineTo(step * i, val);
            //ctx.lineTo(step * i * 2 + step, this.history[i].plot * h);
        }
        ctx.stroke();
    }

    paintJumbo() {
        var w = this.jumbo.width;
        var h = this.jumbo.height;
        var ctx = this.jumbo.getContext("2d");
        var bars = 3;
        var historyStepSize = 10;
        var jitterSize = 5;

        //ctx.fillStyle = "black";
        ctx.clearRect(0,0,w,h);

        if (!this.history || !this.history.length || this.history.length < bars*historyStepSize)
            return;

        var gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, `hsl(0, 50%, 100%)`);
        gradient.addColorStop(0.5, `hsl(0, 100%, 50%)`);
        gradient.addColorStop(1, `hsl(64, 100%, 50%)`);

        for (var i=0; i<bars; i++) {
            var jitter = (Math.random() * jitterSize * 2) - jitterSize;
            var idx = this.history.length - (i * historyStepSize + 1);
            var val = this.history[idx].plot * h + jitter;

            if (this.history[idx].score == 0)
                val = 0.5 * h;

            var barWidth = w / 6;
            var barOffset = barWidth*i;
            var barX = w/2-barWidth/2 - barOffset;
            var barX2 = w/2-barWidth/2 + barOffset;
            ctx.fillStyle = gradient;
            ctx.fillRect(barX, h-val, barWidth, val);
            if (i>0) ctx.fillRect(barX2, h-val, barWidth, val);

            if (i==0) {
                this.jumbo_score.innerText = Math.floor(this.history[idx].score);
            }
        }
    }

    //
    // MAIN UI
    //

    showVideoWindow() {
        let lo = this.lo;
        const { div, span, video, canvas } = van.tags;

        van.add(document.body, FloatingWindow(
            {
                title: "Audience Video",
                x: lo.videoX, y: lo.videoY, width: lo.videoWidth, height: lo.videoHeight,
                childrenContainerStyleOverrides: { padding: 0 } 
            },
            div({ id: "main_video_container", style: `width:${lo.videoWidth}px; height:${lo.videoHeight-35}px` }, 
                video({ 
                    id: "main_video", 
                    controls: "controls",
                    loop: "loop", 
                    muted: "muted", 
                    playsinline: "playsinline",
                    width: 1920, 
                    height: 1080,
                    style: `width:${lo.videoWidth}px; height:${lo.videoHeight-35}px`
                    }),
                canvas({ 
                    id: "main_video_overlay", 
                    width: 1920, 
                    height: 1000,
                    style: `width:${lo.videoWidth}px; height:${lo.videoHeight-75}px`
                })
            )
        ));

        this.video = document.getElementById('main_video');
        this.overlay = document.getElementById('main_video_overlay');

        this.video.addEventListener("play", () => {
            if (!this.videoFrameCallbackRunning)
                this.requestVideoFrameCallback();

            if (this.action.paused)
                this.action.play();
        });

        this.video.addEventListener("pause", () => {
            if (!this.action.paused)
                this.action.pause();
        })

        this.overlay.addEventListener("click", () => {
            if (this.video.paused)
                this.video.play();
            else
                this.video.pause();
        })
    }

    showBreakdownWindow() {
        let lo = this.lo;
        const { div, span, input, p, button, h3, a } = van.tags;

        van.add(document.body, FloatingWindow(
            {
                title: "Score Breakdown",
                x: lo.breakdownX, y: lo.breakdownY, width: lo.breakdownWidth, height: lo.breakdownHeight,
                childrenContainerStyleOverrides: { padding: 0 },
            },
            div({ id: "breakdown" })
        ));

        this.breakdown = document.getElementById('breakdown');
    }

    showGraphWindow() {
        let lo = this.lo;
        const { div, span, canvas } = van.tags;

        van.add(document.body, FloatingWindow(
            {
                x: lo.graphX, y: lo.graphY, width: lo.graphWidth, height: lo.graphHeight,
                childrenContainerStyleOverrides: { padding: 0 },
            },
            div (
                span({
                    class: "vanui-window-cross",
                    style: "position: absolute; top: 8px; right: 8px;cursor: pointer;",
                    onclick: () => closed.val = true,
                }, "×"),
                Tabs({
                    style: "width: 100%; font-size: 16pt",
                    tabButtonActiveColor: "white",
                    tabButtonBorderStyle: "none",
                    tabButtonRowColor: "lightgray",
                    tabButtonRowStyleOverrides: { height: "2.5rem" },
                    tabButtonStyleOverrides: { height: "100%", "font-size":"12pt" }
                },   
                {
                    "Fan View": 
                        div(
                            {id:"jumbo_container", style: `width:${lo.graphWidth}px; height:${lo.graphHeight-35}px`}, 
                            canvas({id: "jumbo", width: lo.graphWidth, height: lo.graphHeight - 35 }),
                            div({id: "jumbo_score", style:`width:${lo.graphWidth}px; height:${lo.graphHeight-35}px;`})
                        ),
                    "Score over Time": 
                        div(
                            canvas({id: "graph", width: lo.graphWidth, height: lo.graphHeight - 35 })
                        )
                }) 
            )
        ));

        this.graph = document.getElementById("graph");
        this.jumbo = document.getElementById("jumbo");
        this.jumbo_score = document.getElementById("jumbo_score")
    }

    showContextWindow() {
        let lo = this.lo;
        const { div, span, video } = van.tags;

        van.add(document.body, FloatingWindow(
            {
                title: "Game context",
                x: lo.contextX, y: lo.contextY, width: lo.contextWidth, height: lo.contextHeight,
                childrenContainerStyleOverrides: { padding: 0 },
            },
            div(
                video({ 
                    id: "action_video", 
                    loop: "loop", 
                    muted: "muted", 
                    playsinline: "playsinline",
                    width: 1920, 
                    height: 1080,
                    style: `width:${lo.contextWidth}px; height:${lo.contextHeight-35}px`
                })
            )
        ));

        this.action = document.getElementById('action_video');
    }
}