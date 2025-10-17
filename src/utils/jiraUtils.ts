import { ConfigService } from '@nestjs/config';
import FormData from "form-data";
import fs from "node:fs";

export interface JiraCredentials {
    jiraUrl: string;
    jiraUser: string;
    jiraApiKey: string;
}

export class JiraUtils {
    private readonly JIRA_USER: string;
    private readonly JIRA_TOKEN: string;
    private readonly JIRA_URL: string;

    constructor(credentials?: JiraCredentials) {
        if (credentials) {
            this.JIRA_USER = credentials.jiraUser;
            this.JIRA_TOKEN = credentials.jiraApiKey;
            this.JIRA_URL = credentials.jiraUrl;
        } else {
            // Fallback to environment variables for backward compatibility
            this.JIRA_USER = process.env.JIRA_USER || '';
            this.JIRA_TOKEN = process.env.JIRA_API_KEY || '';
            this.JIRA_URL = process.env.JIRA_URL || '';
        }
    }

    private authHeader() {

        const b64 = Buffer.from(`${this.JIRA_USER}:${this.JIRA_TOKEN}`).toString("base64");
        return { Authorization: `Basic ${b64}` };
    }

    async jiraGet(path: string, params: Record<string, any> = {}) {
        const usp = new URLSearchParams(params as Record<string, string>).toString();
        const url = `${this.JIRA_URL}${path}${usp ? `?${usp}` : ""}`;
        const r = await fetch(url, {
            headers: { ...this.authHeader(), "Accept": "application/json" }
        });
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${await r.text()}`);
        return r.json();
    }

    async jiraPost(path: string, body: any) {
        const url = `${this.JIRA_URL}${path}`;
        const r = await fetch(url, {
            method: "POST",
            headers: { "Accept": "application/json", "Content-Type": "application/json", ...this.authHeader(), },
            body: JSON.stringify(body)
        });
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${await r.text()}`);
        const text = await r.text();
        if (!text) return true;
        try {
            return JSON.parse(text);
        } catch { 
            return text;
        }
    }
    async jiraPut(path: string, body: any) {
        const url = `${this.JIRA_URL}${path}`;
        const r = await fetch(url, {
            method: "PUT",
            headers: { "Accept": "application/json", "Content-Type": "application/json", ...this.authHeader(), },
            body: JSON.stringify(body)
        });
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${await r.text()}`);
        try {
            return await r.json();
        } catch {
            return true;
        }
    }

    async getProjects() {
        const data = await this.jiraGet("/rest/api/3/project");
        return data;
    }

    async getProjectIssueTypes(projectKey: string) {
        const data = await this.jiraGet(`/rest/api/3/project/${projectKey}`);
        return data.issueTypes;
    }

    async getAllIssues(projectKey: string, fields: string[] = ["summary", "status", "assignee", "updated"]) {
        const data = await this.jiraGet(`/rest/api/3/search/jql`, {
            jql: `project = ${projectKey}`,
            fields,
            maxResults: 100,
            startAt: 0
        });
        return data;
    }

    async addAttachment(issueKey: string, filePath: string) {
        const { default: fetch } = await import("node-fetch");
        const myHeaders = new Headers();
        myHeaders.append("X-Atlassian-Token", "no-check");
        myHeaders.append("Authorization", this.authHeader().Authorization);

        const formdata = new FormData();
        formdata.append("file", fs.createReadStream(filePath), { filename: "call.mp3" });

        const requestOptions = {
            method: "POST",
            headers: myHeaders,
            body: formdata,
            redirect: "follow"
        };

        fetch(`${this.JIRA_URL}/rest/api/3/issue/${issueKey}/attachments`, requestOptions as any)
            .then((response) => response.text())
            .then((result) => console.log(result))
            .catch((error) => console.error(error));
    }
}
