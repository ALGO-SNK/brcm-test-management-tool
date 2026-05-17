#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const seedDir = path.join(projectRoot, 'electron', 'db', 'seed');
const seedDbPath = path.join(seedDir, 'app-seed.sqlite');
const dbManager = require(path.join(projectRoot, 'electron', 'db', 'manager.cjs'));

async function buildSeedDb() {
  console.log('[Build] Generating seed database...');

  try {
    fs.mkdirSync(seedDir, { recursive: true });

    // If seed DB already exists, remove it to rebuild
    if (fs.existsSync(seedDbPath)) {
      console.log('[Build] Removing existing seed DB');
      fs.unlinkSync(seedDbPath);
    }

    // Generate the seed DB
    console.log(`[Build] Creating seed DB at ${seedDbPath}`);
    await dbManager.createSeedDb(seedDbPath);

    console.log('[Build] Seed database generated successfully');
    process.exit(0);
  } catch (error) {
    console.error('[Build] Failed to generate seed database:', error);
    process.exit(1);
  }
}

buildSeedDb();
