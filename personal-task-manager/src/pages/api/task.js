// API proxy for task-related endpoints
export default async function handler(req, res) {
    const { method, query } = req;
    const { path } = query;

    // Backend API URL
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

    try {
        // Forward the request to the backend with proper path
        const response = await fetch(`${backendUrl}/${path}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                // Forward auth headers if present
                ...(req.headers.authorization && {
                    Authorization: req.headers.authorization,
                }),
            },
            ...(req.body && { body: JSON.stringify(req.body) }),
        });

        // Get the response data
        const data = await response.json();

        // Return the response with the same status
        res.status(response.status).json(data);
    } catch (error) {
        console.error("API proxy error:", error);
        res.status(500).json({ error: "Error connecting to backend service" });
    }
}
