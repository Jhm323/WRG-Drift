import { PrismaClient } from '../../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.DATABASE_URL;

// Render's external Postgres hostname always ends in .render.com (e.g.
// dpg-xxxx-a.oregon-postgres.render.com); the internal hostname — used when
// this API itself runs on Render, in the same region as the DB — has no
// render.com suffix at all (just the bare dpg-xxxx-a host, resolved over
// Render's private network). See
// https://render.com/docs/postgresql-creating-connecting. Only the external
// path needs SSL; local/Homebrew Postgres URLs never match this and keep
// ssl unset.
const isRenderExternal = new URL(databaseUrl).hostname.endsWith('.render.com');

const adapter = new PrismaPg({
  connectionString: databaseUrl,
  ...(isRenderExternal ? { ssl: { rejectUnauthorized: false } } : {}),
});

export const prisma = new PrismaClient({ adapter });
