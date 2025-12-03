import { fetchWithAuth, BASE_URL } from "./client";

const ID_URL = `${BASE_URL}/auth/student/studium.pl`;

export async function fetchUserId(): Promise<string | null> {
    try {
        const response = await fetchWithAuth(ID_URL);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const tds = doc.getElementsByTagName("td");
        if (tds.length === 0) return null;

        for (let i = 0; i < tds.length; i++) {
            if (tds[i].innerText?.toLowerCase().includes("identif")) {
                if (tds[i + 1]) {
                    return tds[i + 1].innerText.replace(" ", "");
                }
            }
        }
        return null;
    } catch (error) {
        console.error("Failed to fetch user ID:", error);
        return null;
    }
}

export async function getUserId(): Promise<string | null> {
    const storage = window.localStorage;
    const id = storage.getItem("user_id");

    if (id) return id;

    const fetchedId = await fetchUserId();
    if (fetchedId) {
        storage.setItem("user_id", fetchedId);
        return fetchedId;
    }

    return null;
}
