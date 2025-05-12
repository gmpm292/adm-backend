import { Module } from '@nestjs/common';
import { DepartmentModule } from './department/department.module';
import { OfficeModule } from './office/office.module';
import { TeamModule } from './team/team.module';
import { BusinessModule } from './business/business.module';

@Module({
  imports: [DepartmentModule, OfficeModule, TeamModule, BusinessModule],
})
export class CompanyModule {}
