import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class AppInfoInput {
  @Field()
  version: string;

  @Field()
  name: string;

  @Field()
  description: string;
}
