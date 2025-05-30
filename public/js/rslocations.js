import { van, rsv } from "/js/rsvan.js";
import { events } from "/js/rsevents.js";
import {
  firestore,
  doc,
  collection,
  setDoc,
  addDoc,
  getDocs,
  deleteDoc,
  Form,
} from "/js/rsdb.js";

class Locations {
  constructor() {
    events.addEventListener("addLocationClick", (e) =>
      this.handleAddLocation(e)
    );
  }

  init() {
    this.addElements();
    this.addFormElements(document.getElementById("location-form"));
  }

  addElements(parentElement) {
    const { a, div, main, h1 } = van.tags;
    parentElement =
      parentElement || document.getElementById("container") || document.body;

    van.add(
      parentElement,
      main(
        { class: "w-[90%] p-4 overflow-auto" },
        h1("Locations"),
        div({ id: "location-form" })
      )
    );
  }

  addFormElements(parentElement) {
    var form = new Form("locations", [
      { name: "name", displayName: "Location name", row: 0 },
      { name: "address", displayName: "Address", row: 1 },
      { name: "city", displayName: "City", row: 2, containerClass: "w-1/2" },
      { name: "state", displayName: "State", row: 2, containerClass: "w-1/2" },
      { name: "zip", displayName: "Zip code", row: 3 },
    ]);

    form.addElements(parentElement);
  }
}

const locations = new Locations();
export { Locations, locations };
