async function listActions(db, options = {}) {
  const { category, includeDeprecated = false } = options;

  let sql = 'SELECT * FROM action_catalog';
  const params = [];

  if (category) {
    sql += ' WHERE category = ?';
    params.push(category);
  }

  if (!includeDeprecated) {
    sql += category ? ' AND' : ' WHERE';
    sql += ' is_deprecated = 0';
  }

  sql += ' ORDER BY action_key ASC';

  const rows = await db.all(sql, params);
  return rows.map(parseActionRow);
}

async function getAction(db, actionKey) {
  const row = await db.get(
    'SELECT * FROM action_catalog WHERE action_key = ?',
    [actionKey]
  );
  return row ? parseActionRow(row) : null;
}

async function createAction(db, payload, createdBy = 'system') {
  const { actionKey, label, description, category, contract } = payload;

  if (!actionKey || !label || !category || !contract) {
    throw new Error('Missing required fields: actionKey, label, category, contract');
  }

  const now = new Date().toISOString();
  const contractJson = typeof contract === 'string' ? contract : JSON.stringify(contract);

  try {
    await db.run(
      `INSERT INTO action_catalog
       (action_key, label, description, category, contract_json, is_user_modified, created_by, created_at, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      [actionKey, label, description || null, category, contractJson, createdBy, now, createdBy, now]
    );
    return getAction(db, actionKey);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      throw new Error(`Action with key "${actionKey}" already exists`);
    }
    throw error;
  }
}

async function updateAction(db, actionKey, payload, updatedBy = 'system') {
  const existing = await getAction(db, actionKey);
  if (!existing) {
    throw new Error(`Action "${actionKey}" not found`);
  }

  const {
    label = existing.label,
    description = existing.description,
    category = existing.category,
    contract = existing.contract,
  } = payload;

  const now = new Date().toISOString();
  const contractJson = typeof contract === 'string' ? contract : JSON.stringify(contract);

  await db.run(
    `UPDATE action_catalog
     SET label = ?, description = ?, category = ?, contract_json = ?,
         updated_by = ?, updated_at = ?, is_user_modified = 1
     WHERE action_key = ?`,
    [label, description, category, contractJson, updatedBy, now, actionKey]
  );

  return getAction(db, actionKey);
}

async function deprecateAction(db, actionKey, deprecate = true, updatedBy = 'system') {
  const existing = await getAction(db, actionKey);
  if (!existing) {
    throw new Error(`Action "${actionKey}" not found`);
  }

  const now = new Date().toISOString();
  await db.run(
    `UPDATE action_catalog
     SET is_deprecated = ?, updated_by = ?, updated_at = ?, is_user_modified = 1
     WHERE action_key = ?`,
    [deprecate ? 1 : 0, updatedBy, now, actionKey]
  );

  return getAction(db, actionKey);
}

async function deleteAction(db, actionKey) {
  const usage = await getActionUsageCount(db, actionKey);
  if (usage > 0) {
    throw new Error(
      `Cannot delete action "${actionKey}": it is used in ${usage} test case(s). ` +
      'Deprecate instead.'
    );
  }

  await db.run('DELETE FROM action_catalog WHERE action_key = ?', [actionKey]);
}

async function getActionUsageCount(db, actionKey) {
  const row = await db.get(
    'SELECT test_case_count FROM action_usage_index WHERE action_key = ?',
    [actionKey]
  );
  return row?.test_case_count || 0;
}

async function updateActionUsageCount(db, actionKey, count) {
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO action_usage_index (action_key, test_case_count, last_used_at)
     VALUES (?, ?, ?)
     ON CONFLICT(action_key) DO UPDATE SET
       test_case_count = excluded.test_case_count,
       last_used_at = excluded.last_used_at`,
    [actionKey, count, now]
  );
}

function parseActionRow(row) {
  return {
    ...row,
    contract: typeof row.contract_json === 'string'
      ? JSON.parse(row.contract_json)
      : row.contract_json,
  };
}

async function getActionsByCategory(db, category) {
  return listActions(db, { category, includeDeprecated: false });
}

async function getCategories(db) {
  const rows = await db.all(
    'SELECT DISTINCT category FROM action_catalog WHERE is_deprecated = 0 ORDER BY category ASC'
  );
  return rows.map(r => r.category);
}

module.exports = {
  listActions,
  getAction,
  createAction,
  updateAction,
  deprecateAction,
  deleteAction,
  getActionUsageCount,
  updateActionUsageCount,
  getActionsByCategory,
  getCategories,
};
