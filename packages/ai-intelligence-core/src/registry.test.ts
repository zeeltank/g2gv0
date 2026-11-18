/**
 * Characterization tests for G2G's copy of the AI & Intelligence capability
 * registry. The capability set is meant to be identical across applications;
 * only per-product status and solution entries differ.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  AI_CAPABILITIES,
  SOLUTIONS,
  capabilitiesForSolution,
  capabilityStatusCounts,
  getCapability,
  getSolution,
} from './index';

const CAPABILITY_IDS = [
  'ai.providers',
  'ai.models',
  'ai.prompts',
  'ai.policies',
  'ai.agents',
  'ai.conversational',
  'ai.knowledge-rag',
  'ai.recommendations',
  'ai.knowledge-graph',
  'ai.evaluation',
  'ai.usage-cost',
  'ai.audit',
];

describe('G2G ai-intelligence-core registry', () => {
  it('still has the 12 capabilities', () => {
    assert.deepEqual(
      AI_CAPABILITIES.map((c) => c.id),
      CAPABILITY_IDS,
    );
  });

  it('serves all 12 capabilities to G2G', () => {
    assert.equal(capabilitiesForSolution('g2g').length, 12);
  });

  it('G2G is a host solution, enterprise brain is external', () => {
    assert.equal(getSolution('g2g')?.kind, 'host');
    assert.equal(getSolution('enterprise_brain')?.kind, 'external');
    assert.deepEqual(
      SOLUTIONS.map((s) => s.id),
      ['g2g', 'lms_k12', 'enterprise_brain'],
    );
  });

  it('status counts add up to the capability total', () => {
    const c = capabilityStatusCounts();
    assert.equal(c.live + c['in-progress'] + c['coming-soon'], AI_CAPABILITIES.length);
  });

  it('every capability resolves by id', () => {
    for (const id of CAPABILITY_IDS) assert.ok(getCapability(id), id);
  });
});
