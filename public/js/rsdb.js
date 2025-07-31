import { van, rsv } from "/js/rsvan.js";
import { app } from "/js/rsfirebase.js";
import { events } from "/js/rsevents.js";

import {
  getFirestore,
  doc,
  collection,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

const firestore = getFirestore(app);

class Form {
  constructor(collection, fields) {
    this.collection = collection;
    this.fields = fields;
    events.addEventListener(`${this.collection}FormSubmitClick`, (e) => {
      this.handleSubmit();
    });
  }

  async handleSubmit() {
    const formData = Object.fromEntries(
      Array.from(this.fields).map((field) => {
        const fieldName = field.name;
        const fieldId = field.id || `${fieldName}Input`;
        const fieldValue = document.getElementById(fieldId).value;
        return [fieldName, fieldValue];
      })
    );

    console.log("Form data:", formData);
    const collectionRef = collection(firestore, this.collection);
    try {
      var docRef = await addDoc(collectionRef, formData);
      console.log("Document written with ID: ", docRef.id);
    } catch (error) {
      console.error("Error adding document: ", error);
    }
  }

  getElementsForField(field) {
    const { label, input, div } = van.tags;

    const fieldName = field.name;
    const fieldId = field.id || `${fieldName}Input`;
    const fieldDisplayName = field.displayName || fieldName;
    const isRequired = field.required || false;
    const fieldType = field.type || "text";
    const containerClass = field.containerClass || "w-full";

    return div(
      { class: containerClass },
      label(
        {
          for: fieldId,
          class:
            "block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2",
        },
        fieldDisplayName
      ),
      input({
        id: fieldId,
        name: fieldName,
        type: fieldType,
        placeholder: fieldDisplayName,
        required: isRequired,
        class:
          "shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 leading-tight focus:outline-none focus:shadow-outline",
      })
    );
  }

  addElements(parentElement) {
    const { div } = van.tags;
    const { button } = rsv.tags;

    parentElement =
      parentElement ||
      document.getElementById("form-container") ||
      document.body;

    var rows = [];

    for (var i = 0; i < this.fields.length; i++) {
      const field = this.fields[i];
      const fieldRow = field.row || i;
      const fieldElements = this.getElementsForField(field);

      if (!rows[fieldRow])
        rows[fieldRow] = div({ class: "mb-4 flex space-x-4" });

      van.add(rows[fieldRow], fieldElements);
    }

    rows.push(
      div(
        { class: "flex justify-center items-center mt-8" },
        button({ name: `${this.collection}FormSubmit` }, "Submit")
      )
    );

    van.add(
      parentElement,
      div(
        { class: "flex justify-center items-center mt-8" },
        div(
          {
            class:
              "bg-white dark:bg-gray-800 shadow-md rounded px-8 pt-6 pb-8 mb-4 w-1/3",
          },
          rows
        )
      )
    );
  }
}

class List {
  constructor(collection, fields) {
    this.collection = collection;
    this.fields = fields;
  }

  getElementsForField(field) {
    const { label, span, div } = van.tags;

    const fieldName = field.name;
    const fieldId = field.id || `${fieldName}Text`;
    const fieldDisplayName = field.displayName || fieldName;
    const containerClass = field.containerClass || "w-full";

    return div(
      { class: containerClass },
      label(
        {
          for: fieldId,
          class:
            "block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2",
        },
        fieldDisplayName
      ),
      span({
        id: fieldId,
        class:
          "w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 leading-tight",
      })
    );
  }
  
  addElements(parentElement) {
    const { div } = van.tags;
    const { button } = rsv.tags;

    parentElement =
      parentElement ||
      document.getElementById("list-container") ||
      document.body;

    var rows = [];

    for (var i = 0; i < this.fields.length; i++) {
      const field = this.fields[i];
      const fieldRow = field.row || i;
      const fieldElements = this.getElementsForField(field);

      if (!rows[fieldRow])
        rows[fieldRow] = div({ class: "mb-4 flex space-x-4" });

      van.add(rows[fieldRow], fieldElements);
    }

    rows.push(
      div(
        { class: "flex justify-center items-center mt-8" },
        button({ name: `${this.collection}Add` }, "Add")
      )
    );

    van.add(
      parentElement,
      div(
        { class: "flex justify-center items-center mt-8" },
        div(
          {
            class:
              "bg-white dark:bg-gray-800 shadow-md rounded px-8 pt-6 pb-8 mb-4 w-1/3",
          },
          rows
        )
      )
    );
  }


  async getItems() {
    const collectionRef = collection(firestore, this.collection);
    const snapshot = await getDocs(collectionRef);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }
}

export {
  firestore,
  doc,
  collection,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Form,
  List,
};
