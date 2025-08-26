import { Module } from '@nestjs/common';
import { AppInfoModule } from './appInfo/appInfo.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RoleGuardModule } from './role-guard-resource/role-guard.module';
import { CompanyModule } from './company/company.module';
import { InventoryGlobalModule } from './inventory/inventory-global.module';
import { SaleModule } from './sales/sale/sale.module';
import { PayrollModule } from './payroll/payroll.module';
import { EmailModule } from './email/email.module';
import { TelegramModule } from './telegram/telegram.module';
import { AttendanceModule } from './payroll/attendance/attendance.module';

@Module({
  imports: [
    AppInfoModule,
    UsersModule,
    AuthModule,
    RoleGuardModule,
    CompanyModule,
    InventoryGlobalModule,
    SaleModule,
    PayrollModule,
    EmailModule,
    TelegramModule,
    AttendanceModule,
  ],
  providers: [],
})
export class Modules {}
