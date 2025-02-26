import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Notification {
  @Field(() => [String])
  notify: string[];

  @Field()
  message: string;
}
