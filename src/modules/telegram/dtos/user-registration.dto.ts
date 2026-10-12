import {
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MinLength,
} from 'class-validator';

export class UserRegistrationDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  lastName?: string;

  @IsEmail()
  email: string;

  @IsPhoneNumber()
  mobile: string;
}

export type RegistrationStep =
  | 'name'
  | 'lastName'
  | 'email'
  | 'mobile' // Para entrada manual
  | 'mobile_contact' // Para contacto automático
  | 'confirmation';

export interface UserState extends Partial<UserRegistrationDto> {
  lastMessageId?: number;
  currentStep?: RegistrationStep;
}
