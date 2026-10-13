import test from 'node:test';
import assert from 'node:assert/strict';
import { importResultsSchema, resultsQuerySchema, toPublicResult } from '../src/schemas/results.js';

const validPayload = {
  event_title: 'TREINÃO NOTURNO',
  event_slug: 'treinao-noturno',
  total_results: 1,
  results: [{
    bib_number: '1817',
    athlete_name: 'JOSÉ CARLOS DE JESUS',
    category: 'M40-49',
    status: 'Finished',
    gender: 'M',
    rank_general: 1,
    rank_category: null,
    time_gross: '00:15:45.480',
    time_net: '00:15:43.020',
    team_name: 'Corre Vilhena',
  }],
};

test('accepts the documented result payload and strips unknown personal fields', () => {
  const parsed = importResultsSchema.parse({
    ...validPayload,
    results: [{ ...validPayload.results[0], athlete_cpf: '12345678900' }],
  });

  assert.equal(parsed.results.length, 1);
  assert.equal('athlete_cpf' in parsed.results[0], false);
});

test('rejects inconsistent totals, duplicate bib numbers, and malformed race times', () => {
  assert.equal(importResultsSchema.safeParse({ ...validPayload, total_results: 2 }).success, false);
  assert.equal(importResultsSchema.safeParse({
    ...validPayload,
    total_results: 2,
    results: [...validPayload.results, validPayload.results[0]],
  }).success, false);
  assert.equal(importResultsSchema.safeParse({
    ...validPayload,
    results: [{ ...validPayload.results[0], time_gross: '15:45' }],
  }).success, false);
});

test('defaults pagination and constrains page size', () => {
  assert.deepEqual(resultsQuerySchema.parse({}), { page: 1, limit: 50 });
  assert.equal(resultsQuerySchema.safeParse({ limit: '101' }).success, false);
});

test('public result mapping exposes no CPF field', () => {
  const result = toPublicResult({
    id: '00000000-0000-4000-8000-000000000000',
    bibNumber: '1817',
    athleteName: 'Atleta',
    category: 'M40-49',
    status: 'Finished',
    gender: 'M',
    rankGeneral: 1,
    rankCategory: 1,
    timeGross: null,
    timeNet: null,
    teamName: null,
    athleteCpf: '12345678900',
  });

  assert.equal('athlete_cpf' in result, false);
  assert.equal('athleteCpf' in result, false);
});