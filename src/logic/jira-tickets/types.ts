export type JiraPlan = {
    intent: "working" | "missed" | "completed" | "generic";
    assignee_text?: string;
    project?: string;
    dateField?: "created" | "updated" | "resolutiondate" | "duedate";
    startISO?: string;
    endISO?: string;
    keywords?: string;
  };