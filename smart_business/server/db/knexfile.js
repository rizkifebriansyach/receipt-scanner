require("dotenv").config();

module.exports = {
  development: {
    client: "postgresql",
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: `${__dirname}/migrations`,
      tableName: "knex_migrations",
    },
  },
  production: {
    client: "postgresql",
    connection: process.env.DATABASE_URL,
    pool: { min: 2, max: 10 },
    migrations: {
      directory: `${__dirname}/migrations`,
      tableName: "knex_migrations",
    },
  },
};
