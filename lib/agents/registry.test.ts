/**
 * Characterization tests: pin G2G's agent registry as it behaves today, so the
 * shared-core migration cannot silently drop a module or tool.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  AGENT_MODULES,
  AGENT_TOOLS,
  ROLLS_UP_TO,
  findModule,
  findTool,
  isKnownModule,
  toolsForModule,
  validateToolsForModule,
} from './registry';

const TOP_LEVEL = [
  'organizational_management',
  'hrit_management',
  'talent_management',
  'lms',
  'capability_intelligence',
  'task_management',
];

describe('G2G agent registry', () => {
  it('keeps every module that exists today', () => {
    const keys = AGENT_MODULES.map((m) => m.key);
    for (const key of [
      ...TOP_LEVEL,
      'lms_course_builder',
      'lms_assessments',
      'lms_my_learning',
      'lms_learning_catalog',
      'capability_library',
      'capability_explorer',
      'talent_recruitment',
      'talent_administration',
      'task_my_tasks',
    ]) {
      assert.ok(keys.includes(key), `module ${key} must still be registered`);
    }
  });

  it('keeps every tool that exists today', () => {
    const keys = AGENT_TOOLS.map((t) => t.key);
    for (const key of [
      'organization.employees',
      'organization.departments',
      'hrms.leave_requests',
      'hrms.attendance',
      'lms.course_builder',
      'lms.assessment_cycles',
      'lms.my_enrolments',
      'lms.catalog',
      'capability.jobroles',
      'capability.competencies',
      'capability.entity_mappings',
      'talent.pipeline',
      'talent.job_postings',
      'talent.workflows',
      'tasks.my_tasks',
    ]) {
      assert.ok(keys.includes(key), `tool ${key} must still be registered`);
    }
  });

  it('has unique module keys and unique tool keys', () => {
    const m = AGENT_MODULES.map((x) => x.key);
    const t = AGENT_TOOLS.map((x) => x.key);
    assert.equal(new Set(m).size, m.length);
    assert.equal(new Set(t).size, t.length);
  });

  it('rolls each child screen up to a registered top-level module', () => {
    for (const [child, parent] of Object.entries(ROLLS_UP_TO)) {
      assert.ok(isKnownModule(child), `${child} must be a known module`);
      assert.ok(TOP_LEVEL.includes(parent), `${child} must roll up to a top-level module, got ${parent}`);
    }
  });

  it('every tool belongs to a known module or the shared scope', () => {
    for (const tool of AGENT_TOOLS) {
      assert.ok(tool.key.length > 0);
      assert.ok(findTool(tool.key), `findTool must resolve ${tool.key}`);
    }
    for (const mod of AGENT_MODULES) assert.ok(findModule(mod.key));
  });

  it('validates a tool allow-list the way the server does', () => {
    assert.equal(validateToolsForModule('hrit_management', []), 'Choose at least one tool.');
    assert.equal(validateToolsForModule('hrit_management', ['__nope__']), 'Unknown tool "__nope__".');
    // A real tool offered by a different module is refused for this one.
    const foreign = AGENT_TOOLS.find((t) => !toolsForModule('hrit_management').some((o) => o.key === t.key));
    assert.ok(foreign);
    assert.match(validateToolsForModule('hrit_management', [foreign.key]) ?? '', /belongs to/);
    // A tool the module itself offers and that is available passes.
    const own = toolsForModule('hrit_management').find((t) => t.available);
    assert.ok(own);
    assert.equal(validateToolsForModule('hrit_management', [own.key]), null);
  });

  it('a module with tools exposes only registered tools', () => {
    for (const key of TOP_LEVEL) {
      for (const tool of toolsForModule(key)) assert.ok(findTool(tool.key));
    }
  });
});
