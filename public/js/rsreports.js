import van from "https://cdn.jsdelivr.net/gh/vanjs-org/van/public/van-1.5.5.min.js";
import {
  firestore,
  doc,
  collection,
  setDoc,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy
} from "/js/rsdb.js";

class Reports {
  constructor() {}

  async init() {
    this.addElements();

  }

  getIdFromPath() {
    /**
     * Get the ID from the URL path, if present.
     */
    const path = window.location.pathname;
    const parts = path.split("/");
    return parts.length > 2 ? parts[2] : null; // returns the ID if present, otherwise null
  }

  addElements(parentElement) {
    const { a, div, main, h1, video } = van.tags;
    parentElement =
      parentElement || document.getElementById("container") || document.body;

    van.add(
      parentElement,
      main(
        { class: "w-[90%] p-4 overflow-auto" },
        div(
          { class: "flex justify-center items-center" }, 
          h1("Reports"),
          div({}, video({
            id: "report-video",
            class: "w-full h-auto rounded-lg shadow-md video-js video-js-default-skin",
            controls: true,
            loop: true,
            width: 1920,
            height: 1080,
          }))
        )
      )
    );

    this.player = videojs("report-video", {
      sources: [{
        src: `${window.location.origin}/playlist/${this.getIdFromPath()}/GzHHtKPSxvlHvT6kkUzk/play.m3u8`,
        type: "application/x-mpegURL"
      }],
      width: 1920,
      height: 1080,
    });
  }
}

const reports = new Reports();
export { Reports, reports };
