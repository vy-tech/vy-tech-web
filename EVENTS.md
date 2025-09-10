# Event Bus Documentation

This document lists all the events fired and listened to in the application's event bus system.

## Scoring Events

### `scoring.timeUpdate`
**Fired by:** `Score.handleTimeUpdate()`  
**Purpose:** Notifies components when the video time updates during playback  
**Data:** `{ lastTime, currentTime, elapsed, elapsedMillis }`  
**Listeners:** `ActiveBoxManager` (for expiring boxes)

### `scoring.timeSeek`
**Fired by:** `Score.handleTimeSeek()`  
**Purpose:** Notifies components when the user seeks to a new time position  
**Data:** `{ currentTime }`  
**Listeners:** `ActiveBoxManager` (for resetting boxes)

## Visualization Events

### `viz.paint`
**Fired by:** `Reports.addPlayer()` during video timeupdate  
**Purpose:** Triggers all visualization components to update/repaint  
**Data:** `{ currentTime }`  
**Listeners:** `Heatmap`, `CameraMap`, `Ekg`, `Spider`, `People`

### `viz.play`
**Fired by:** `Reports.addPlayer()` when video starts playing  
**Purpose:** Notifies components that video playback has started  
**Data:** None  
**Listeners:** `Ekg` (starts smoothie chart), `LinkedPlayer` (plays YouTube embed)

### `viz.pause`
**Fired by:** `Reports.addPlayer()` when video is paused  
**Purpose:** Notifies components that video playback has paused  
**Data:** None  
**Listeners:** `Ekg` (stops smoothie chart), `LinkedPlayer` (pauses YouTube embed)

### `viz.timeSeek`
**Fired by:** `Reports.addPlayer()` when user seeks to new position  
**Purpose:** Notifies components that user has seeked to a new time  
**Data:** `{ currentTime }`  
**Listeners:** `Ekg` (clears time series data)

### `viz.cameraChanged`
**Fired by:** `Reports.changeCamera()`  
**Purpose:** Notifies components when user switches to a different camera view  
**Data:** `{ camera }`  
**Listeners:** `MomentFinder`, `People` (marks as stale for repainting)

## UI Interaction Events

### `ui.requestTimeSeek`
**Fired by:** `People.init()` (chart click), `MomentList.seekTo()`  
**Purpose:** Requests the video player to seek to a specific time  
**Data:** `{ time }` or `{ seconds }`  
**Listeners:** `Reports.initListeners()`

### `ui.requestCamera`
**Fired by:** `CameraMap.init()` when user clicks on camera region  
**Purpose:** Requests switching to a different camera view  
**Data:** `{ camera }`  
**Listeners:** `Reports.addCameraMapListeners()`

### `ui.requestEvent`
**Fired by:** `Events.createSelectorElement()` when user selects different event  
**Purpose:** Requests loading a different event/game  
**Data:** Event hierarchy string  
**Listeners:** `Reports.initListeners()`

### `ui.requestSummaryRebuild`
**Fired by:** `Reports.addElements()` when user clicks rebuild button  
**Purpose:** Requests rebuilding the summary data for current event  
**Data:** `{ hierarchy }`  
**Listeners:** `Summarizer`

## Data Processing Events

### `summarizer.ready`
**Fired by:** `Summarizer.ensure()` when summaries are loaded/created  
**Purpose:** Notifies components that summary data is available  
**Data:** None  
**Listeners:** `MomentFinder`

### `momentFinder.changed`
**Fired by:** `MomentFinder.find()` when top moments are recalculated  
**Purpose:** Notifies components that the list of key moments has been updated  
**Data:** None  
**Listeners:** `MomentList`

## Heatmap Interaction Events

### `heatmap.click`
**Fired by:** `Heatmap.createElement()` when user clicks on heatmap  
**Purpose:** Toggles video play/pause state  
**Data:** `{}`  
**Listeners:** `Reports.addHeatmapListeners()`

### `heatmap.mousemove`
**Fired by:** `Heatmap.createElement()` when user moves mouse over heatmap  
**Purpose:** Shows debug information for face detection boxes under cursor  
**Data:** `{ x, y }` (scaled coordinates)  
**Listeners:** `Reports.addHeatmapListeners()`

## Event Flow Summary

1. **Video Playback:** `viz.play` → `viz.paint` (continuous) → `scoring.timeUpdate` (continuous)
2. **User Seeks:** `viz.timeSeek` → `scoring.timeSeek`
3. **Camera Switch:** `ui.requestCamera` → `viz.cameraChanged` → `momentFinder.changed`
4. **Data Loading:** `summarizer.ready` → `momentFinder.changed` → UI updates
5. **User Interactions:** Various `ui.request*` events → corresponding actions
