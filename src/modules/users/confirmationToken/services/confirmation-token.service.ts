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

/**
 * Enlaces de un solo uso para fijar o recuperar la contraseña: un UUID con
 * caducidad, marcado como usado al consumirlo.
 */
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

  /**
   * Crea un token de confirmación que caduca a los
   * `CONFIRMATION_TOKEN_EXPIRE_IN` segundos. Si el usuario ya tiene uno
   * activo, lanza `ConfirmationTokenUserError`; con `replaceActive` lo anula
   * y crea otro (quien perdió el correo puede pedir uno nuevo).
   */
  public async createConfirmationToken(
    userId: number,
    replaceActive = false,
  ): Promise<ConfirmationToken> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { confirmationTokens: true },
    });
    if (!user) {
      throw new NotFoundError('User not found');
    }
    const activeTokens =
      user.confirmationTokens?.filter(
        (ct) => ct.expirationDate > new Date() && !ct.used,
      ) ?? [];
    if (activeTokens.length > 0) {
      if (!replaceActive) {
        throw new ConfirmationTokenUserError(
          'This user has active confirmation token',
        );
      }
      for (const activeToken of activeTokens) {
        await this.markTokenAsUsed(activeToken.id as number);
      }
    }

    // CONFIRMATION_TOKEN_EXPIRE_IN va en segundos, como las de los JWT
    const expireIn =
      Number(
        await this.configService.getAsync('CONFIRMATION_TOKEN_EXPIRE_IN'),
      ) * 1000;
    const expirationDate = new Date(new Date().getTime() + expireIn);

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
