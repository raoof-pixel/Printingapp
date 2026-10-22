'use strict';
// Tiny JSON document store with atomic writes. Good for a single-instance store;
// swap for Postgres/SQLite by re-implementing these five functions.
const fs = require('fs');
const path = require('path');
const config = require('./config');

const cache = new Map();

function fileFor(name) {
  if (!/^[a-z]+$/.test(name)) throw new Error('bad collection name');
  return path.join(config.dirs.data, `${name}.json`);
}

function load(name) {
  if (cache.has(name)) return cache.get(name);
  const file = fileFor(name);
  let rows = [];
  try {
    rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(rows)) rows = [];
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  cache.set(name, rows);
  return rows;
}

function persist(name) {
  const file = fileFor(name);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(cache.get(name), null, 1));
  fs.renameSync(tmp, file); // atomic on POSIX
}

module.exports = {
  all: (name) => load(name).slice(),
  find: (name, pred) => load(name).find(pred),
  filter: (name, pred) => load(name).filter(pred),
  insert(name, row) {
    load(name).push(row);
    persist(name);
    return row;
  },
  update(name, pred, patch) {
    const rows = load(name);
    const row = rows.find(pred);
    if (!row) return null;
    Object.assign(row, typeof patch === 'function' ? patch(row) : patch);
    persist(name);
    return row;
  },
};
