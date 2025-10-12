import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ElasticService {
    private readonly headers: Record<string, string>;
    private readonly esUrl: string;
    constructor(private readonly configService: ConfigService) {
        this.esUrl = this.configService.get('ELASTIC_URL') || '';
        const esPass = this.configService.get('ELASTIC_API_KEY') || '';
        this.headers = {
            'Content-Type': 'application/json',
            'Authorization': `APIKey ${esPass}`
        }

    }


    async elasticPost<T = any>(path: string, body: unknown): Promise<T> {
        const resp = await fetch(`${this.esUrl}${path}`, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify(body)
        });
        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`Elasticsearch error ${resp.status}: ${text}`);
        }
        return resp.json() as Promise<T>;
    }

    async elasticBulkSave(body: any[]) {
        const ndjson = body.map(line => JSON.stringify(line)).join("\n") + "\n";
        const resp = await fetch(`${this.esUrl}/_bulk`, {
          method: "POST",
          headers: this.headers,
          body: ndjson
        });
        const json = await resp.json();
        if (json.errors) {
          console.error("Elasticsearch bulk errors:", JSON.stringify(json, null, 2));
          throw new Error("Bulk insert failed");
        }
        return json;
      }

    async elasticDelete<T = any>(path: string): Promise<T> {
        const resp = await fetch(`${this.esUrl}${path}`, {
            method: "DELETE",
            headers: this.headers
        });
        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`Elasticsearch delete error ${resp.status}: ${text}`);
        }
        return resp.json() as Promise<T>;
    }


}
