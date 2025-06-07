import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseService } from '../../core/services/base.service';
import { EmailSent } from '../../entities';
import { ListOptions, ListSummary } from '../../core/graphql/remote-operations';
@Injectable()
export class EmailSentService extends BaseService<EmailSent> {
  constructor(
    @InjectRepository(EmailSent)
    private emailSentRepository: Repository<EmailSent>,
  ) {
    super(emailSentRepository);
  }

  async create(createEmailSentInput: EmailSent): Promise<EmailSent> {
    return super.baseCreate(createEmailSentInput);
  }

  async find(options?: ListOptions): Promise<ListSummary> {
    return await super.baseFind(options);
  }

  async findOne(id: number): Promise<EmailSent> {
    return super.baseFindOne(id);
  }

  remove(ids: number[]): Promise<EmailSent[]> {
    return super.baseDeleteMany(ids);
  }
}
