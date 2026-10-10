const API_PORT = 8000;

export function getApiUrl(path) {
    const normalizedPath = `/${String(path).replace(/^\/+/, "")}`;
    const configuredBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

    if (configuredBaseUrl) {
        return `${configuredBaseUrl.replace(/\/+$/, "")}${normalizedPath}`;
    }

    if (typeof window === "undefined") {
        return normalizedPath;
    }

    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}${normalizedPath}`;
}
