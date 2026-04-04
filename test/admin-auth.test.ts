import { describe, expect, test } from "bun:test"

import {
  DISCOFORK_ADMIN_TOKEN_ENV_VAR,
  DISCOFORK_ADMIN_TOKEN_HEADER,
  authorizeAdminRequest,
  buildAdminAuthorizationHeaders,
} from "../web/src/lib/server/admin-auth.ts"

function envWithToken(token: string): NodeJS.ProcessEnv {
  return {
    [DISCOFORK_ADMIN_TOKEN_ENV_VAR]: token,
  }
}

describe("authorizeAdminRequest", () => {
  test("fails closed when the admin token is not configured", () => {
    expect(authorizeAdminRequest(new Headers(), {})).toEqual({
      ok: false,
      status: 503,
      error: `${DISCOFORK_ADMIN_TOKEN_ENV_VAR} is not configured.`,
    })
  })

  test("returns 401 when credentials are missing", () => {
    expect(authorizeAdminRequest(new Headers(), envWithToken("secret"))).toEqual({
      ok: false,
      status: 401,
      error: "Missing admin credentials.",
    })
  })

  test("returns 403 when the bearer token is wrong", () => {
    expect(
      authorizeAdminRequest(new Headers({ authorization: "Bearer nope" }), envWithToken("secret")),
    ).toEqual({
      ok: false,
      status: 403,
      error: "Invalid admin credentials.",
    })
  })

  test("accepts bearer tokens and the explicit admin header", () => {
    expect(
      authorizeAdminRequest(new Headers({ authorization: "Bearer secret" }), envWithToken("secret")),
    ).toEqual({ ok: true })

    expect(
      authorizeAdminRequest(new Headers({ [DISCOFORK_ADMIN_TOKEN_HEADER]: "secret" }), envWithToken("secret")),
    ).toEqual({ ok: true })
  })
})

describe("buildAdminAuthorizationHeaders", () => {
  test("builds a bearer token header from the configured admin token", () => {
    expect(buildAdminAuthorizationHeaders(envWithToken("secret"))).toEqual({
      Authorization: "Bearer secret",
    })
  })
})
