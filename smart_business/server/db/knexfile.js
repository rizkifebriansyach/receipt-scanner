require("dotenv").config();

const commonMigrations = {
  directory: `${__dirname}/migrations`,
  tableName: "knex_migrations",
};

module.exports = {
  development: {
    client: "postgresql",
    connection: process.env.DATABASE_URL,
    migrations: commonMigrations,
  },
  test: {
    client: "postgresql",
    connection: process.env.DATABASE_URL,
    migrations: commonMigrations,
  },
  production: {
    client: "postgresql",
    connection: process.env.DATABASE_URL,
    pool: { min: 2, max: 10 },
    migrations: commonMigrations,
  },
};
