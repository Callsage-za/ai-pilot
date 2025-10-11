
// Define types manually until Prisma client is regenerated
export enum PolicyDocumentType {
    CODE_OF_CONDUCT = 'CODE_OF_CONDUCT',
    DATA_PRIVACY_POLICY = 'DATA_PRIVACY_POLICY',
    IT_SECURITY_POLICY = 'IT_SECURITY_POLICY',
    REMOTE_WORK_POLICY = 'REMOTE_WORK_POLICY',
    ONBOARDING = 'ONBOARDING',
    PERFORMANCE = 'PERFORMANCE',
    LEAVE = 'LEAVE',
    EMPLOYEE_HANDBOOK = 'EMPLOYEE_HANDBOOK',
}
export enum PolicyDocumentParentId {
    POLICY = 'POLICY',
    HR = 'HR',
    SALES = 'SALES',
    MARKETING = 'MARKETING',
    ENGINEERING = 'ENGINEERING',
    PRODUCT = 'PRODUCT',
    OPS = 'OPS',
    FINANCE = 'FINANCE',
    LEGAL = 'LEGAL',
    OTHER = 'OTHER',
}


export interface PolicyDocument {
    id: string;
    title: string;
    description?: string;
    type: PolicyDocumentType;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    uploadedBy?: string;
    headers?: any;
    isProcessed: boolean;
    version?: string;
    effectiveDate?: Date;
    createdAt: Date;
    updatedAt: Date;
    parentId?: PolicyDocumentParentId;
}

export interface PolicyDocumentUploadData {
    title: string;
    description?: string;
    type: PolicyDocumentType;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    uploadedBy?: string;
    headers?: any;
    version?: string;
    effectiveDate?: Date;
    parentId?: PolicyDocumentParentId;
}

export interface SearchHit {
    id: string;
    score: number;
    title: string;
    snippet: string;
    rrf: number;
}

export interface SearchResult {
    hits: SearchHit[];
    answer: string;
    query: string;
    sources: any[];
}

export interface InfoSource {
    id: string;
    type: string;
    title: string;
    snippet: string;
    score?: number;
    confidence?: number;
    key?: string;
}

export interface Call {
    id?: string;
    path: string;
    transcript: string;
    summary: string;
    classification: AudioClassification;
    sentiment: AudioSentiment;
    severity: AudioSeverity;
    resolved?: boolean;
    audioEntity:AudioEntities;
    audioEvidence:AudioEvidence[];
}

export enum AudioClassification {
    complaint = 'complaint',
    compliment = 'compliment',
    other = 'other',
}
export enum AudioSentiment {
    negative = 'negative',
    neutral = 'neutral',
    positive = 'positive',
}
export enum AudioSeverity {
    low = 'low',
    medium = 'medium',
    high = 'high',
}
export interface AudioEntities {
    id?:string,
    accountId:string,
    orderId:string,
    product:string,
    audioId?:string,
}
export interface AudioEvidence {
    id:string,
    text:string,
    startMs:number,
    endMs:number,
    audioId:string,
}

export interface ConvState {
    active_intent: "docs.search" | "jira.lookup_by_assignee" | "unknown";
    topic: string | null;            // e.g., "data privacy policy"
    last_switched_at: number;        // ts when intent last changed
    stickiness: number;              // 0..1, decays over time/turns
  };