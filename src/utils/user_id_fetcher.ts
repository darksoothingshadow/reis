export const ID_URL = "https://is.mendelu.cz/auth/student/studium.pl";

async function fetchUserID(): Promise<string | null> {
    try {
        const f = await fetch(ID_URL);
        const html = await f.text();
        //
        const parser: Document = new DOMParser().parseFromString(html, "text/html");
        //
        const tds = parser.getElementsByTagName("td");
        if (tds.length == 0) {
            return null;
        }
        //
        for (let l = 0; l < tds.length; l++) {
            if (tds[l].innerText?.toLowerCase().includes("identif")) {
                if (tds[l + 1] != null) {
                    return tds[l + 1].innerText.replace(" ", "");
                }
            }
        }
        //
        return null;
    } catch (e) {
        console.error("[ERROR] Failed to fetch user ID:", e);
        return null;
    }
}
//
export async function getUserId(): Promise<string | null> {
    const storage = window.localStorage;
    const id = storage.getItem("user_id");
    if (id == null) {
        const fetched_id = await fetchUserID();
        if (fetched_id != null) {
            storage.setItem("user_id", fetched_id);
            return fetched_id;
        } else {
            return null;
        }
    } else {
        return id;
    }
}
