import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class EmailAttachmentInput {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  path: string;

  @IsString()
  @IsOptional()
  cid?: string;
}
