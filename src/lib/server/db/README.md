# Database boundary

Turso hosted libSQL and Drizzle ORM belong here. Add schema tables, migrations, and the server-only data access layer only when the backend contract is accepted.

Do not query the database from React components. Derive ownership from the authenticated session and return minimal DTOs.
