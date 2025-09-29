import van from "vanjs-core";
import { createGrid } from "ag-grid-community";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);
import { events } from "../data/events.js";

class EventGrid {
    constructor() {
        this.container = null;
        this.grid = null;
        this.gridApi = null;

        // Define column definitions as a class member
        this.columnDefs = [
            {
                field: "name",
                headerName: "Event Name",
                sortable: true,
                filter: true,
                flex: 3, // Make this column bigger (3x the default)
                minWidth: 200, // Ensure minimum width
            },
            {
                field: "begin",
                headerName: "Date/Time",
                sortable: true,
                filter: "agDateColumnFilter",
                flex: 2,
                valueFormatter: (params) => {
                    if (!params.value) return "";
                    return params.value.toLocaleString();
                },
            },
            { field: "duration", headerName: "Duration", sortable: true },
            {
                field: "cameras",
                headerName: "Cameras",
                sortable: true,
                filter: "agNumberColumnFilter",
            },
            {
                field: "totalScore",
                headerName: "Total Score",
                sortable: true,
                filter: "agNumberColumnFilter",
            },
            {
                field: "avgScore",
                headerName: "Avg Score",
                sortable: true,
                filter: "agNumberColumnFilter",
            },
            {
                field: "highScore",
                headerName: "High Score",
                sortable: true,
                filter: "agNumberColumnFilter",
            },
            {
                field: "lowScore",
                headerName: "Low Score",
                sortable: true,
                filter: "agNumberColumnFilter",
            },
        ];

        // Define grid options as a class member
        this.gridOptions = {
            columnDefs: this.columnDefs,
            defaultColDef: {
                resizable: true,
                sortable: true,
                filter: true,
                flex: 1,
                minWidth: 100,
            },
            pagination: true,
            paginationPageSize: 50,
            rowData: [], // Initialize with empty data
            domLayout: "normal",
            suppressHorizontalScroll: false,
            suppressVerticalScroll: false,
            animateRows: true,
            rowSelection: "single", // Allow single row selection
            onGridReady: (params) => {
                this.gridApi = params.api;
                this.columnApi = params.columnApi;
                // Don't use sizeColumnsToFit as it overrides flex settings
                // params.api.sizeColumnsToFit();
                // Ensure grid is properly sized after DOM is ready
                setTimeout(() => {
                    // Force a resize to apply flex settings
                    params.api.resetRowHeights();
                }, 100);
            },
        };
    }

    createElement(options) {
        const { div } = van.tags;

        let merged = {
            ...options,
            class: `ag-theme-alpine-dark ${options.class || ""}`.trim(),
        };

        this.container = div(merged);
        this.grid = createGrid(this.container, this.gridOptions);

        return this.container;
    }

    async update() {
        const eventList = await events.getAvailable();

        // Transform the event data to match our column structure
        const rowData = eventList.map((event) => {
            const beginDate = event.begin?.toDate
                ? event.begin.toDate()
                : new Date(event.begin);
            const endDate = event.end?.toDate
                ? event.end.toDate()
                : new Date(event.end);
            const duration =
                endDate && beginDate
                    ? Math.round((endDate - beginDate) / (1000 * 60)) + " min"
                    : "Unknown";
            const name = (event.name || event.description || "Unnamed Event")
                .replace(/\(Baseball\) /g, "")
                .trim();

            const summary = event.summary || {};
            return {
                name: name,
                begin: beginDate,
                duration: duration,
                cameras: summary.cameras || 0,
                totalScore: summary.totalScore || 0,
                avgScore: summary.averageScore || 0,
                highScore: summary.maxScore || 0,
                lowScore: summary.minScore || 0,
                // Store the full event data for potential future use
                _eventData: event,
            };
        });

        console.log(rowData);
        // Update the grid with the new data
        if (this.gridApi) {
            this.gridApi.setGridOption("rowData", rowData);
            // Don't call sizeColumnsToFit() as it overrides flex settings
        }
    }

    // Helper method to get selected event data
    getSelectedEvent() {
        if (!this.gridApi) return null;

        const selectedRows = this.gridApi.getSelectedRows();
        return selectedRows.length > 0 ? selectedRows[0]._eventData : null;
    }

    // Helper method to refresh the grid data
    async refresh() {
        await this.update();
    }
}

const eventgrid = new EventGrid();
export default eventgrid;
export { eventgrid, EventGrid };
