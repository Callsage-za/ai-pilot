import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { DocsService, SearchResult } from './docs.service';

interface SearchRequest {
    query: string;
    size?: number;
}

@Controller('docs')
export class DocsController {
    constructor(private readonly docsService: DocsService) {}

    @Post('search')
    async searchDocs(@Body() body: SearchRequest) {
        try {
            const query = String(body?.query ?? "");
            const size = Number(body?.size ?? 5);

            if (!query.trim()) {
                throw new HttpException('Query is required', HttpStatus.BAD_REQUEST);
            }

            const result = await this.docsService.searchDocs(query, size,"cmgbf2hc7001git2p3qq0sr00","123456");
            return result;
        } catch (err: any) {
            if (err instanceof HttpException) {
                throw err;
            }
            throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post('ingestDocs')
    async ingestDocs(@Body() body: {path: string}) {
        return this.docsService.injestDocs(body?.path);
    }
    @Post('ingestPolicyDocs')
    async ingestPolicyDocs(@Body() body: {path: string}) {
        return this.docsService.injestPolicyDocs(body?.path);
    }
}
