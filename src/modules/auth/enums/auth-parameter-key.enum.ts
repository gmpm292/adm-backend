/**
 * Enum with the name of parameters related with authentication or authorization
 *
 * In a request these parameters came in cookies, headers or body.
 * Change this value may be affect the authentication process in some apps,
 * like mobile (apk, ipa) or website
 */
export enum AuthParameterKey {
  AccessToken = 'Authorization',
  RefreshToken = 'Refresh',
}
