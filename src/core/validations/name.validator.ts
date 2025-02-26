import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'FullName', async: false })
export class NameValidator implements ValidatorConstraintInterface {
  /**
   * Validate if name has only letters
   *
   * @param fullName Name and lastname
   */
  public validate(fullName: string): boolean {
    return /^(?:[a-zA-ZÀ-ÿñÑ]+\s?)+$/.test(fullName);
  }

  /**
   * Returns default error message
   */
  public defaultMessage(): string {
    return 'name must be only letters';
  }
}
