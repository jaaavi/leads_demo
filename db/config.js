function demoDbError() {
  throw new Error(
    'Demo repository: MySQL is intentionally disabled. Runtime data comes from db/demoData.js through routes/demo.js.'
  );
}

module.exports = {
  execute: demoDbError,
  query: demoDbError,
  getConnection: demoDbError,
  end: async () => undefined,
};
