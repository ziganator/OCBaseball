# Owners Club Baseball: Cloudflare + Supabase Starter

This starter is built for:

- Cloudflare Pages for the website
- Cloudflare Pages Functions for API routes
- Supabase Postgres for data

It uses no frontend build step yet. That keeps the first version simple and easy to deploy.

## 1. Create Tables In Supabase

Run:

`supabase/schema.sql`

Then run:

`supabase/public_views.sql`

Optional for team profile pages:

`supabase/team_profiles.sql`

Optional for authenticated admin editing:

`supabase/admin_auth.sql`

Optional for owner logins, rosters, lineups, available player pool, transactions, daily stats, and scoring rules:

`supabase/roster_management.sql`

The schema file creates the normalized tables. The views file creates read-friendly views for the website.

## 2. Configure Cloudflare Environment Variables

In Cloudflare Pages, add these environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Use the anon public key, not the service role key.

The browser login flow reads these through `/api/config` on Cloudflare Pages. For static-only local previews, you can temporarily fill in:

`public/supabase-browser-config.js`

Do not put a service role key in browser files.

If an admin page says `/api/config is returning the website HTML`, the deploy did not activate the `functions` folder. In that case either deploy the full Pages project with `public` as the output directory and `functions` as the Functions directory, or put only the public Supabase URL and publishable key in `public/supabase-browser-config.js`.

## 3. Enable Supabase Auth For Admin

In Supabase Authentication, create an email/password user for each admin.

After the user exists, add the user id to `admin_users`:

```sql
INSERT INTO admin_users (user_id, display_name)
VALUES ('USER_UUID_FROM_AUTH_USERS', 'Admin Name');
```

The admin page is:

`/admin-teams.html`

It can edit teams, track season identity changes, manage shared favorite-team logo references, and save an authenticated draft to `team_admin_drafts`. The local browser backup and `team-data.js` export are legacy tools for the static-file transition.

To let a team owner manage only their own roster/lineup, create the Supabase Auth user, then connect that user to the Owners Club team:

```sql
INSERT INTO team_owner_users (user_id, team_id, season_id, role)
VALUES ('USER_UUID_FROM_AUTH_USERS', TEAM_ID, SEASON_ID, 'owner');
```

Use `season_id` when ownership should apply only to one season, or `NULL` when the same owner should control that team across seasons.

The first lineup/scoring sandbox is:

`/highlanders-lineup.html`

It uses a static Cleveland Highlanders roster, browser-saved test lineup state, manual daily stat inputs, and the current Owners Club scoring rules. This is a prototype for the later Supabase-backed roster and lineup workflow.

## 4. Deploy To Cloudflare Pages

Set the Pages project root to this folder:

`ownersclub-cloudflare-supabase`

Build settings:

- Build command: leave blank
- Build output directory: `public`
- Functions directory: `functions`

## 5. Local Development

Install Wrangler if needed, then run from this folder:

```bash
npx wrangler pages dev public
```

For local development, create `.dev.vars`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

## Current API Routes

- `/api/standings`
- `/api/config`

The first frontend page calls `/api/standings` and renders the current standings.

## Next Steps

1. Write the Season 28 workbook importer.
2. Populate teams, aliases, season assignments, standings, games, players, and player lines.
3. Add pages for Teams, Schedule, Games, Players, Event Cards, and Archives.
