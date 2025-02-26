import { User } from '../../users/entities/user.entity';

export interface LoginOutput {
  accessToken: string;
  profile: User;
  refreshToken: string;
}
