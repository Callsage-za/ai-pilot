import { GoogleAuth } from "google-auth-library";

const SCOPES = ["https://www.googleapis.com/auth/cloud-platform"];
const auth = new GoogleAuth({
    keyFilename: "/Users/jackson/Documents/gemini/ops-copilot-api/config/service.json",
    scopes: SCOPES
});

export async function getAccessToken(): Promise<string> {
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    if (!token || !token.token) throw new Error("Failed to obtain GCP access token");
    return token.token;
}
