import { test, describe, mock } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import config from "../src/config/config.js";
import sessionModel from "../src/model/session.model.js";
import { protect } from "../src/middleware/auth.middleware.js";
import { Logout, tokenRotate } from "../src/controllers/auth.controller.js";

describe("Backend Auth Security & Session Revocation Tests", () => {
  const isProduction = process.env.NODE_ENV === "production";
  const expectedCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
  };

  test("1. protect middleware: Rejects request if accessToken cookie is missing (401)", async () => {
    const req = { cookies: {} };
    let jsonCalled = false;
    const res = {
      status: (code) => {
        assert.equal(code, 401);
        return {
          json: (data) => {
            jsonCalled = true;
            assert.equal(data.success, false);
            assert.equal(data.message, "Authentication token missing. Please sign in.");
          },
        };
      },
    };
    const next = mock.fn();

    await protect(req, res, next);
    assert.equal(jsonCalled, true);
    assert.equal(next.mock.callCount(), 0);
  });

  test("2. protect middleware: Rejects request if access token signature is invalid (401)", async () => {
    const req = { cookies: { accessToken: "invalid.jwt.token" } };
    let jsonCalled = false;
    const res = {
      status: (code) => {
        assert.equal(code, 401);
        return {
          json: (data) => {
            jsonCalled = true;
            assert.equal(data.success, false);
          },
        };
      },
    };
    const next = mock.fn();

    await protect(req, res, next);
    assert.equal(jsonCalled, true);
    assert.equal(next.mock.callCount(), 0);
  });

  test("3. protect middleware: Rejects request if access token lacks sessionId (401)", async () => {
    const tokenWithoutSession = jwt.sign({ id: "user123" }, config.JWT_SECRET, { expiresIn: "15m" });
    const req = { cookies: { accessToken: tokenWithoutSession } };
    let jsonCalled = false;
    const res = {
      status: (code) => {
        assert.equal(code, 401);
        return {
          json: (data) => {
            jsonCalled = true;
            assert.equal(data.success, false);
            assert.equal(data.message, "Invalid session token. Please sign in again.");
          },
        };
      },
    };
    const next = mock.fn();

    await protect(req, res, next);
    assert.equal(jsonCalled, true);
    assert.equal(next.mock.callCount(), 0);
  });

  test("4. protect middleware: Rejects request if session is REVOKED in database (401)", async () => {
    const originalFindById = sessionModel.findById;
    const validToken = jwt.sign({ id: "user123", sessionId: "sess456" }, config.JWT_SECRET, { expiresIn: "15m" });
    const req = { cookies: { accessToken: validToken } };

    // Mock session found but revoked
    sessionModel.findById = mock.fn(async (id) => {
      assert.equal(id, "sess456");
      return {
        _id: "sess456",
        user: "user123",
        revoked: true, // Session revoked!
      };
    });

    let jsonCalled = false;
    const res = {
      status: (code) => {
        assert.equal(code, 401);
        return {
          json: (data) => {
            jsonCalled = true;
            assert.equal(data.success, false);
            assert.equal(data.message, "Session has been revoked or expired. Please sign in again.");
          },
        };
      },
    };
    const next = mock.fn();

    try {
      await protect(req, res, next);
      assert.equal(jsonCalled, true);
      assert.equal(next.mock.callCount(), 0);
    } finally {
      sessionModel.findById = originalFindById;
    }
  });

  test("5. protect middleware: Rejects request if session belongs to another user (401)", async () => {
    const originalFindById = sessionModel.findById;
    const token = jwt.sign({ id: "attacker_user", sessionId: "sess456" }, config.JWT_SECRET, { expiresIn: "15m" });
    const req = { cookies: { accessToken: token } };

    sessionModel.findById = mock.fn(async () => {
      return {
        _id: "sess456",
        user: "victim_user", // Mismatch
        revoked: false,
      };
    });

    let jsonCalled = false;
    const res = {
      status: (code) => {
        assert.equal(code, 401);
        return {
          json: (data) => {
            jsonCalled = true;
            assert.equal(data.success, false);
          },
        };
      },
    };
    const next = mock.fn();

    try {
      await protect(req, res, next);
      assert.equal(jsonCalled, true);
      assert.equal(next.mock.callCount(), 0);
    } finally {
      sessionModel.findById = originalFindById;
    }
  });

  test("6. protect middleware: Allows request if session is active and belongs to user (calls next())", async () => {
    const originalFindById = sessionModel.findById;
    const token = jwt.sign({ id: "user123", sessionId: "sess456" }, config.JWT_SECRET, { expiresIn: "15m" });
    const req = { cookies: { accessToken: token } };

    sessionModel.findById = mock.fn(async () => {
      return {
        _id: "sess456",
        user: "user123",
        revoked: false,
      };
    });

    const res = {
      status: () => ({ json: () => {} }),
    };
    const next = mock.fn();

    try {
      await protect(req, res, next);
      assert.equal(next.mock.callCount(), 1);
      assert.equal(req.user.id, "user123");
      assert.equal(req.user.sessionId, "sess456");
      assert.equal(req.session.revoked, false);
    } finally {
      sessionModel.findById = originalFindById;
    }
  });

  test("7. Logout controller: Revokes database session and clears BOTH accessToken and refreshToken cookies", async () => {
    const originalFindOne = sessionModel.findOne;
    const clearedCookies = {};

    let sessionRevoked = false;
    const mockSession = {
      _id: "sess456",
      user: "user123",
      revoked: false,
      save: async () => {
        sessionRevoked = mockSession.revoked;
      },
    };

    sessionModel.findOne = mock.fn(async () => mockSession);

    const refreshTokenRaw = "some-refresh-token";
    const req = {
      cookies: {
        refreshToken: refreshTokenRaw,
        accessToken: "access-token",
      },
    };

    let statusCode = null;
    let jsonResponse = null;
    const res = {
      clearCookie: (name, options) => {
        clearedCookies[name] = options;
      },
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            jsonResponse = data;
          },
        };
      },
    };

    try {
      await Logout(req, res);

      // Session must be revoked in DB
      assert.equal(sessionRevoked, true, "Database session must be set to revoked: true");

      // BOTH cookies must be cleared
      assert.ok(clearedCookies.accessToken, "accessToken cookie must be cleared");
      assert.ok(clearedCookies.refreshToken, "refreshToken cookie must be cleared");

      // Verify cookie-clearing configuration matches setting configuration
      assert.deepEqual(clearedCookies.accessToken, expectedCookieOptions);
      assert.deepEqual(clearedCookies.refreshToken, expectedCookieOptions);

      // Status 200 response
      assert.equal(statusCode, 200);
      assert.equal(jsonResponse.Message, "Logout SuccessFull");
    } finally {
      sessionModel.findOne = originalFindOne;
    }
  });

  test("8. Logout controller: Handles missing/expired refreshToken gracefully and still clears both cookies", async () => {
    const clearedCookies = {};
    const req = {
      cookies: {}, // No cookies present
    };

    let statusCode = null;
    let jsonResponse = null;
    const res = {
      clearCookie: (name, options) => {
        clearedCookies[name] = options;
      },
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            jsonResponse = data;
          },
        };
      },
    };

    await Logout(req, res);

    // Both cookies must still be cleared
    assert.ok(clearedCookies.accessToken, "accessToken cookie must be cleared even when tokens missing");
    assert.ok(clearedCookies.refreshToken, "refreshToken cookie must be cleared even when tokens missing");
    assert.deepEqual(clearedCookies.accessToken, expectedCookieOptions);
    assert.deepEqual(clearedCookies.refreshToken, expectedCookieOptions);

    // Must return 200 without throwing 400 error
    assert.equal(statusCode, 200);
    assert.equal(jsonResponse.Message, "Logout SuccessFull");
  });

  test("9. tokenRotate controller: Generates accessToken with sessionId and user ID, sets both cookies with matching options", async () => {
    const originalFindOne = sessionModel.findOne;
    const setCookies = {};

    const mockSession = {
      _id: "sess456",
      user: "user123",
      refreshTokenHashed: "old-hash",
      revoked: false,
      save: async () => {},
    };

    sessionModel.findOne = mock.fn(async () => mockSession);

    const rawRefreshToken = jwt.sign({ id: "user123" }, config.JWT_SECRET, { expiresIn: "7d" });
    const req = {
      cookies: {
        refreshToken: rawRefreshToken,
      },
    };

    let statusCode = null;
    let jsonResponse = null;
    const res = {
      cookie: (name, val, options) => {
        setCookies[name] = { val, options };
      },
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            jsonResponse = data;
          },
        };
      },
    };

    try {
      await tokenRotate(req, res);

      assert.equal(statusCode, 200);
      assert.ok(setCookies.accessToken, "accessToken cookie must be set");
      assert.ok(setCookies.refreshToken, "refreshToken cookie must be set");

      // Verify accessToken contains sessionId and user id
      const decodedAccess = jwt.verify(setCookies.accessToken.val, config.JWT_SECRET);
      assert.equal(decodedAccess.id, "user123");
      assert.equal(decodedAccess.sessionId, "sess456");

      // Verify cookie options match expected security settings
      assert.equal(setCookies.accessToken.options.httpOnly, true);
      assert.equal(setCookies.accessToken.options.sameSite, "strict");
      assert.equal(setCookies.accessToken.options.path, "/");
      assert.equal(setCookies.accessToken.options.secure, isProduction);

      assert.equal(setCookies.refreshToken.options.httpOnly, true);
      assert.equal(setCookies.refreshToken.options.sameSite, "strict");
      assert.equal(setCookies.refreshToken.options.path, "/");
      assert.equal(setCookies.refreshToken.options.secure, isProduction);
    } finally {
      sessionModel.findOne = originalFindOne;
    }
  });
});
