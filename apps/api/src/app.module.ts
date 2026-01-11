import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './customers/customers.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { GetApiModule } from './getapi/getapi.module';
import { WorkOrdersModule } from './work-orders/work-orders.module';
import { PaymentsModule } from './payments/payments.module';
import { CashCloseModule } from './cash-close/cash-close.module';
import { UsersModule } from './users/users.module';
import { ReportsModule } from './reports/reports.module';
import { CatalogModule } from './catalog/catalog.module';
import { InventoryModule } from './inventory/inventory.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchasesModule } from './purchases/purchases.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    PrismaModule,
    AuthModule,
    GetApiModule,
    VehiclesModule,
    CustomersModule,
    WorkOrdersModule,
    PaymentsModule,
    CashCloseModule,
    UsersModule,
    ReportsModule,
    CatalogModule,
    InventoryModule,
    SuppliersModule,
    PurchasesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
