class LocationsTool {
    constructor() {}

    get name() {
        return "locations_list";
    }

    get description() {
        return "Get a list of available locations and associated camera information";
    }

    get parameters() {
        return null;
    }

    get supportsCursors() {
        return true;
    }

    async invoke(args = {}) {
        return [
            {
                id: "TrzuVvQbPapdTO34Jj0t",
                token: "raimondi",
                name: "Raimondi Park",
                address: "1800 Wood St, Oakland, CA 94607",
                location: [37.815921, -122.293861],
                cameras: [
                    {
                        number: 1,
                        view: "General Admission Seating, First Base Line",
                    },
                    {
                        number: 2,
                        view: "General Admission Seating, Third Base Line",
                    },
                    { number: 3, view: "Reserved Seating, First Base Line" },
                    { number: 4, view: "Reserved Seating, Third Base Line" },
                    { number: 5, view: "Concession Area" },
                ],
            },
        ];
    }
}

export default LocationsTool;
export { LocationsTool };
