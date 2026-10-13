import test from 'node:test';
import assert from 'node:assert/strict';
import { openApiDocument } from '../src/docs/openapi.js';

test('documents every public API route and both destructive POST warnings', () => {
  assert.deepEqual(Object.keys(openApiDocument.paths).sort(), [
    '/api/results',
    '/api/results/reset',
    '/api/results/{bibNumber}',
    '/health',
  ]);

  const importOperation = openApiDocument.paths['/api/results'].post;
  const resetOperation = openApiDocument.paths['/api/results/reset'].post;

  assert.match(importOperation.description, /é pública e não exige credencial/i);
  assert.match(importOperation.description, /substitui/i);
  assert.match(resetOperation.description, /pública e não exige credencial/i);
  assert.match(resetOperation.description, /remove todos os resultados/i);
  assert.equal('requestBody' in resetOperation, false);
});

test('all OpenAPI schema references resolve', () => {
  const references = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.$ref === 'string') references.push(value.$ref);
    Object.values(value).forEach(visit);
  };

  visit(openApiDocument.paths);

  for (const reference of references) {
    const schemaName = reference.replace('#/components/schemas/', '');
    assert.ok(
      Object.hasOwn(openApiDocument.components.schemas, schemaName),
      `Unresolved OpenAPI reference: ${reference}`,
    );
  }
});

test('documents query validation and rate-limit response formats', () => {
  const listOperation = openApiDocument.paths['/api/results'].get;
  const invalidQueryExample = listOperation.responses[422].content['application/json'].example;
  const rateLimitContent = listOperation.responses[429].content;

  assert.deepEqual(invalidQueryExample.details[0].path, ['limit']);
  assert.equal(rateLimitContent['text/html'].example, 'Too many requests, please try again later.');
});
