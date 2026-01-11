import { Module } from '@nestjs/common';
import { CashCloseController } from './cash-close.controller';
import { CashCloseService } from './cash-close.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CashCloseController],
  providers: [CashCloseService],
})
export class CashCloseModule {}
