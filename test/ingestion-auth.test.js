import test from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../src/config/env.js';
import { requireIngestionApiKey } from '../src/middlewares/ingestion-auth.js';

test('rejects missing and invalid ingestion API keys', () => {
  const originalKey = env.ingestionApiKey;
  env.ingestionApiKey = 'expected-key';
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  try {
    requireIngestionApiKey({ get: () => 'wrong-key' }, response, () => {
      throw new Error('next should not be called');
    });
    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.body, { error: 'Credenciais de ingestão inválidas' });
  } finally {
    env.ingestionApiKey = originalKey;
  }
});

test('accepts a valid ingestion API key', () => {
  const originalKey = env.ingestionApiKey;
  env.ingestionApiKey = 'expected-key';
  let called = false;

  try {
    requireIngestionApiKey({ get: () => 'expected-key' }, {}, () => {
      called = true;
    });
    assert.equal(called, true);
  } finally {
    env.ingestionApiKey = originalKey;
  }
});
