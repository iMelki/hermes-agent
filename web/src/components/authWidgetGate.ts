/** Loopback has no OAuth session. `/api/auth/me` 401s even with a valid
 *  `X-Hermes-Session-Token`. Skip the probe so every route does not log 401. */
export function shouldFetchAuthMe(authRequired: boolean | undefined): boolean {
  return authRequired === true;
}
