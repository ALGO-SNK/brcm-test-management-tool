async function getConfig(db) {
  const rows = await db.all('SELECT key, value FROM app_config WHERE is_user_modified = 1 OR is_user_modified = 0;');
  const config = {};
  for (const row of rows) {
    try {
      config[row.key] = JSON.parse(row.value);
    } catch {
      config[row.key] = row.value;
    }
  }
  return config;
}

async function setConfig(db, key, value) {
  if (!key || typeof key !== 'string') {
    throw new Error('Config key must be a non-empty string');
  }

  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO app_config (key, value, is_user_modified, updated_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       is_user_modified = 1,
       updated_at = excluded.updated_at`,
    [key, stringValue, now]
  );

  return value;
}

async function getMeta(db, key) {
  const row = await db.get(
    'SELECT value FROM app_meta WHERE key = ?;',
    [key]
  );
  return row ? row.value : null;
}

async function setMeta(db, key, value) {
  if (!key || typeof key !== 'string') {
    throw new Error('Meta key must be a non-empty string');
  }

  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

  await db.run(
    `INSERT INTO app_meta (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value`,
    [key, stringValue]
  );

  return value;
}

module.exports = {
  getConfig,
  setConfig,
  getMeta,
  setMeta,
};
