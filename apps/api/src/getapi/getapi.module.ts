import { Module } from '@nestjs/common';
import { GetApiService } from './getapi.service';

@Module({
  providers: [GetApiService],
  exports: [GetApiService],
})
export class GetApiModule {}
