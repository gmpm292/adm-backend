/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { BaseService } from '../../../../core/services/base.service';
import { ConfirmationToken } from '../../entities/confirmation-token.entity';
import { User } from '../../entities/user.entity';

import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { ConfirmationTokenUserError } from '../../../../core/errors/appErrors/ConfirmationTokenUserError.error';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { ConfigService } from '../../../../common/config';

@Injectable()
export class ConfirmationTokenService extends BaseService<ConfirmationToken> {
  public constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ConfirmationToken)
    private confirmationTokenRepository: Repository<ConfirmationToken>,
    private configService: ConfigService,
  ) {
    super(confirmationTokenRepository);
  }

  public async createConfirmationToken(
    userId: number,
  ): Promise<ConfirmationToken> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { confirmationTokens: true },
    });
    if (!user) {
      throw new NotFoundError('User not found');
    }
    const confirmationTokens = user.confirmationTokens;
    if (
      confirmationTokens?.some(
        (ct) => ct.expirationDate > new Date() && !ct.used,
      )
    ) {
      throw new ConfirmationTokenUserError(
        'This user has active confirmation token',
      );
    }

    const expirationDate = new Date(
      new Date().getTime() +
        Number(
          await this.configService.getAsync('CONFIRMATION_TOKEN_EXPIRE_IN'),
        ),
    );

    const newconfirmationToken = {
      user,
      tokenValue: uuid(),
      expirationDate,
      used: false,
    } as ConfirmationToken;

    return super.baseCreate({ data: newconfirmationToken });
  }

  public async markTokenAsUsed(tokenId: number): Promise<void> {
    const token = await super.baseFindOne({ id: tokenId });
    token.used = true;
    await super.baseUpdate({ id: token.id as number, data: token });
  }

  async find(options?: ListOptions): Promise<ListSummary> {
    return await super.baseFind({ options, relationsToLoad: ['user'] });
  }

  async findOne(id: number): Promise<ConfirmationToken> {
    return super.baseFindOne({ id, relationsToLoad: { user: true } });
  }
}
