export async function customFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    try {
        const response = await fetch(input, init);

        // If it's an opaque response or non-OK (like CORS or network block)
        if (!response.ok || response.type === "opaque") {
            console.warn("Falling back to proxy due to CORS or failed fetch:", response.status);
            return await proxyFetch(input, init);
        }

        return response;
    } catch (error) {
        console.warn("Fetch failed, falling back to proxy:", error);
        return await proxyFetch(input, init);
    }
}

async function proxyFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    try {
        const res = await fetch(("http://localhost:8000/api/make_call_"+(init == undefined || init.method == undefined ? "get" : init.method.toLowerCase())), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                url: input instanceof Request ? input.url : input,
                headers: init?.headers ?? undefined,
                body: init?.body ?? undefined,
            }),
        });
        return res;
    } catch (error) {
        throw new Error("Proxy fetch failed: " + (error as Error).message);
    }
}
