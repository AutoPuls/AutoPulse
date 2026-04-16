import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrate: {
    adapter: () => {
      const pool = new Pool({ 
        connectionString: env('DATABASE_URL'), 
        ssl: { rejectUnauthorized: false } 
      });
      return new PrismaPg(pool);
    },
  },
});
