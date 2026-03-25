import { getAuth } from "firebase/auth";

class ApiUtil {
    async getAuthHeaders() {
        const user = getAuth().currentUser;
        if (!user) {
            throw new Error("User not authenticated");
        }

        const idToken = await user.getIdToken(true);
        return {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
        };
    }

    async call(endpoint, body = null, method = null) {
        const headers = await this.getAuthHeaders();
        method = method || (body ? "POST" : "GET");
        const options = {
            method: method,
            headers: headers,
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(endpoint, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `API call failed: ${response.status} ${response.statusText} - ${errorText}`
            );
        }

        return await response.json();
    }
}

const apiUtil = new ApiUtil();
if (typeof window !== "undefined") {
    window._vy_apiUtil = apiUtil;
}

export { ApiUtil, apiUtil };
