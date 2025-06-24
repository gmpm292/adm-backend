import { IsString, IsNotEmpty, IsUrl, IsOptional } from 'class-validator';

export class TelegramAttachmentInput {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsUrl()
  url: string;

  @IsOptional()
  @IsString()
  caption?: string;
}
