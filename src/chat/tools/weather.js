class WeatherTool {
    constructor() {}

    get name() {
        return "get_weather";
    }
    get description() {
        return "Get the hourly historical weather for the location and day of an event.";
    }
    get parameters() {
        return {
            type: "object",
            properties: {
                hierarchy: {
                    type: "string",
                    description:
                        'The hierarchy identifier ("location:date" eg:"raimondi:20250711") for the event to get weather for',
                },
            },
            required: ["hierarchy"],
        };
    }

    get supportsCursors() {
        return false;
    }

    async getAuthHeaders(auth) {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("User not authenticated");
        }

        const idToken = await user.getIdToken(true);
        return {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
        };
    }

    async invoke(args = {}, auth = null) {
        if (!args.hierarchy) {
            throw new Error("Hierarchy argument is required");
        }
        if (!auth) {
            throw new Error(
                "Authentication is required to use the Weather tool"
            );
        }
        const authHeaders = await this.getAuthHeaders(auth);

        // Post the request to our chat backend
        const response = await fetch(`/api/chat/tool/weather`, {
            method: "POST",
            headers: {
                ...authHeaders,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                hierarchy: args.hierarchy,
            }),
        });

        const data = await response.json();
        return data;
    }
}
export default WeatherTool;
export { WeatherTool };
