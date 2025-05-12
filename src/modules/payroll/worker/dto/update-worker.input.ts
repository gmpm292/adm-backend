import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkerInput } from './create-worker.input';
import { IsNumber } from 'class-validator';

export class UpdateWorkerInput extends PartialType(CreateWorkerInput) {
  @IsNumber()
  id: number;
}
