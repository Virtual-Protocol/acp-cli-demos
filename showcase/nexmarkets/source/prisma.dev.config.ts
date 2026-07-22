import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.dev.prisma",
  datasource: {
    url: process.env.DEV_DATABASE_URL ?? "file:./prisma/dev.db"
  }
});
