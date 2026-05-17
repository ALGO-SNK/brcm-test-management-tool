#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const catalogPath = path.join(projectRoot, 'src', 'utils', 'actionCatalog.generated.ts');
const outputPath = path.join(projectRoot, 'electron', 'db', 'action-catalog-seed.json');

function parseActionCatalog() {
  const content = fs.readFileSync(catalogPath, 'utf-8');

  // Find all action definitions: "KEY": defineAction(...)
  const actionPattern = /"([A-Z_]+)"\s*:\s*defineAction\(\s*"[A-Z_]+",\s*"([^"]+)",\s*DESCRIPTION_BY_SOURCE\.([A-Z_]+),\s*"([^"]*)"/g;

  const actions = [];
  let match;

  while ((match = actionPattern.exec(content)) !== null) {
    const [, actionKey, category, , description] = match;

    // Extract contract for this action by finding the next contract({...})
    const startIdx = match.index + match[0].length;
    const contractMatch = content.substr(startIdx, 1000).match(/contract\(\{\s*([\s\S]*?)\s*\}\s*\)/);

    if (!contractMatch) {
      console.warn(`Could not parse contract for action: ${actionKey}`);
      continue;
    }

    const contract = {};
    const contractStr = contractMatch[1];
    const lines = contractStr.split('\n');

    for (const line of lines) {
      const m = line.match(/(\w+):\s*(REQUIRED|OPTIONAL|UNUSED)/);
      if (m) {
        const requirement = {
          REQUIRED: 'required',
          OPTIONAL: 'optional',
          UNUSED: 'not-used',
        }[m[2]];
        contract[m[1]] = requirement;
      }
    }

    actions.push({
      action_key: actionKey,
      label: description || actionKey,
      description: description || actionKey,
      category,
      contract_json: JSON.stringify(contract),
      is_user_modified: 0,
      is_deprecated: 0,
      created_by: 'system-import',
      created_at: new Date().toISOString(),
      updated_by: null,
      updated_at: new Date().toISOString(),
    });
  }

  return actions;
}


try {
  console.log('[Extract] Parsing action catalog...');
  const actions = parseActionCatalog();
  console.log(`[Extract] Found ${actions.length} actions`);

  fs.writeFileSync(outputPath, JSON.stringify(actions, null, 2));
  console.log(`[Extract] Catalog seed saved to ${outputPath}`);
  process.exit(0);
} catch (error) {
  console.error('[Extract] Failed:', error.message);
  process.exit(1);
}
