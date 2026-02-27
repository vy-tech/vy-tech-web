import { v as van } from './chunks/van-t8DywzvC.js';
import { e as eventBus } from './chunks/eventbus-B9JUr222.js';
import { r as rsv } from './chunks/rsvan-C-KzMu00.js';

class Form {
    constructor(collection, fields) {
        this.collection = collection;
        this.fields = fields;
        this.db = new Database();
        eventBus.addEventListener(`${this.collection}FormSubmitClick`, (e) => {
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
        try {
            const docId = await this.db.set(this.collection, formData);
            console.log("Document written with ID: ", docId);
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
                    class: "block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2",
                },
                fieldDisplayName
            ),
            input({
                id: fieldId,
                name: fieldName,
                type: fieldType,
                placeholder: fieldDisplayName,
                required: isRequired,
                class: "shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 leading-tight focus:outline-none focus:shadow-outline",
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
                        class: "bg-white dark:bg-gray-800 shadow-md rounded px-8 pt-6 pb-8 mb-4 w-1/3",
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
        this.db = new Database();
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
                    class: "block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2",
                },
                fieldDisplayName
            ),
            span({
                id: fieldId,
                class: "w-full py-2 px-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 leading-tight",
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
                        class: "bg-white dark:bg-gray-800 shadow-md rounded px-8 pt-6 pb-8 mb-4 w-1/3",
                    },
                    rows
                )
            )
        );
    }

    async getItems() {
        return await this.db.query(this.collection);
    }
}

class Locations {
    constructor() {
        eventBus.addEventListener("addLocationClick", (e) =>
            this.handleAddLocation(e)
        );
    }

    init() {
        this.addElements();
        this.addListElements(document.getElementById("location-list"));
        this.addFormElements(document.getElementById("location-form"));
    }

    addElements(parentElement) {
        const { a, div, main, h1 } = van.tags;
        parentElement =
            parentElement ||
            document.getElementById("main-content") ||
            document.getElementById("container") ||
            document.body;

        van.add(
            parentElement,
            main(
                { class: "w-[90%] p-4 overflow-auto" },
                h1("Locations"),
                div({ id: "location-list" }),
                div({ id: "location-form" })
            )
        );
    }

    addListElements(parentElement) {
        var list = new List("locations", [
            { name: "name", displayName: "Location", row: 0 },
            {
                name: "city",
                displayName: "City",
                row: 1,
                containerClass: "w-1/2",
            },
            {
                name: "state",
                displayName: "State",
                row: 1,
                containerClass: "w-1/2",
            },
        ]);
        list.addElements(parentElement);
    }

    addFormElements(parentElement) {
        var form = new Form("locations", [
            { name: "name", displayName: "Location name", row: 0 },
            { name: "address", displayName: "Address", row: 1 },
            {
                name: "city",
                displayName: "City",
                row: 2,
                containerClass: "w-1/2",
            },
            {
                name: "state",
                displayName: "State",
                row: 2,
                containerClass: "w-1/2",
            },
            { name: "zip", displayName: "Zip code", row: 3 },
        ]);

        form.addElements(parentElement);
    }
}

const locations = new Locations();

export { Locations, locations };
//# sourceMappingURL=rslocations.js.map
