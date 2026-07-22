import "dotenv/config";
import { defineConfig } from "prisma/config";

const localSchemaUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/nexmarkets?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts"
  },
  datasource: {
    // Client generation and schema validation do not require a live database.
    url: localSchemaUrl
  }
});
