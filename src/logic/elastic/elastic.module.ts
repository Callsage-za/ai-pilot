import { Module } from '@nestjs/common';
import { ElasticService } from './elastic.service';

@Module({
    exports: [ElasticService],
    providers: [ElasticService],
})
export class ElasticModule {}
