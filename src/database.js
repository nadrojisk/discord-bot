const fs = require('fs');
const path = require('path');
const logger = require('./logger');
// Triggers and responses live outside the image so a deployment can supply its own.
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'db.example.json');

function loadDb() {
  try {
    if (!fs.existsSync(DB_PATH)) return { triggers: {}, responses: {} };
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    logger.warn(`${DB_PATH} could not be parsed; using empty database`);
    return { triggers: {}, responses: {} };
  }
}

const db = loadDb();

function getTriggers(type) {
  return Array.isArray(db.triggers?.[type]) ? db.triggers[type] : [];
}

function getResponses(type) {
  return Array.isArray(db.responses?.[type]) ? db.responses[type] : [];
}

function getAllTriggerTypes() {
  return Object.keys(db.triggers || {});
}

module.exports = {
  getTriggers,
  getResponses,
  getAllTriggerTypes,
};
