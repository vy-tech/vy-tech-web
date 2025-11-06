import { van, rsv } from "../rsvan.js";
import { eventBus } from "../eventbus.js";

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
export { List };
