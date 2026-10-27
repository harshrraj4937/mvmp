# 🏬 relivator • next.js ecommerce starter

[demo](https://relivator.com) — [sponsor](https://github.com/sponsors/blefnk) — [discord](https://discord.gg/Pb8uKbwpsJ) — [github](https://github.com/blefnk/relivator) — [docs](https://deepwiki.com/blefnk/relivator-nextjs-template)

> **relivator** is a robust ecommerce template built with next.js and other modern technologies. it's designed for developers who want a fast, modern, and scalable foundation without reinventing the backend.

## stack

1. 🧱 **core**: [nextjs 15.3](https://nextjs.org) + [react 19.1](https://react.dev) + [ts 5.8](https://typescriptlang.org)
2. 🎨 **ui**: [tailwind 4.1](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
3. 🔒 **auth**: [better-auth](https://better-auth.com)
4. 🎬 **anims**: [animejs](https://animejs.com)
5. 📦 **storage**: [uploadthing](https://uploadthing.com)
6. 📊 **analytics**: [vercel](https://vercel.com/docs/analytics)
7. 🧬 **db**: [drizzle-orm](https://orm.drizzle.team) ([pg](https://neon.tech/postgresql/tutorial)) + [neon](https://neon.tech)/(🤔🔜)[supabase](https://supabase.com)
8. 🏗️ **dx**: [eslint](https://eslint.org) + [biome](https://biomejs.dev) + [knip](https://knip.dev)
9. 📝 **forms**: [react-form](https://tanstack.com/form) _(🔜 w.i.p)_ + [arktype](https://arktype.io)
10. 📅 **tables**: [react-table](https://tanstack.com/table)
11. 🌐 **i18n**: [next-intl](https://next-intl.dev) _(🔜 w.i.p)_
12. 💌 **email**: [resend](https://resend.com) _(🔜 w.i.p)_
13. 🔑 **api**: [orpc](https://orpc.unnoq.com) _(🔜 w.i.p)_

> these features define the main reliverse stack. for an alternative setup—featuring clerk, stripe, trpc, and more—check out [versator](https://github.com/blefnk/versator).

## quick start

1. install [git](https://git-scm.com), [node.js](https://nodejs.org), [bun](https://bun.sh).
2. run:

   ```bash
   git clone https://github.com/blefnk/relivator.git
   cd relivator
   bun install
   copy .env.example .env
   ```

3. fill in the required environment variables in the `.env` file.
4. optionally, edit the `src/app.ts` file to make the app yours.
5. run:

   ```bash
   bun db:push # populate db with schema
   bun dev # start development server
   bun run build # build production version
   ```

6. edit something in the code manually or ask ai to help you.
7. done. seriously. you're building now.

<!-- 
2. run:
   ```bash
   bun i -g @reliverse/cli
   reliverse cli
   ```
3. select **"create a new project"**.
4. follow prompts to configure your store.
-->

### Docker Compose

Requires Docker Engine and the Docker Compose v2 plugin. Node.js and Bun do not
need to be installed on the host.

```bash
cp .env.docker.example .env
openssl rand -hex 32 # copy the result into POSTGRES_PASSWORD in .env
openssl rand -hex 32 # copy a second result into AUTH_SECRET in .env
docker compose up --build -d
```

Open <http://localhost:3000>. Compose starts PostgreSQL, waits for it to be
healthy, applies the Drizzle schema with `db:push`, then starts the production
Next.js server. The database stays in the `postgres_data` named volume. Database
setup exits successfully after applying the schema; that container is not a
long-running service.

The Dockerfile installs from `bun.lock` and builds a standalone Next.js image
that runs as a non-root user. `.env` files are excluded from the image. Compose
overrides `DATABASE_URL` to use its `db` service; do not use `localhost` for the
database hostname inside a container.

```bash
docker compose logs -f app       # application logs
docker compose logs db-setup     # schema setup logs
docker compose ps -a             # service status, including schema setup
docker compose down              # stop containers; retain database data
docker compose up --build -d     # rebuild after source changes
```

For another port, set `APP_PORT`, `NEXT_PUBLIC_APP_URL`, and
`NEXT_SERVER_APP_URL` together in `.env` (for example, `3001` and
`http://localhost:3001`). For a hosted deployment, use the public HTTPS URL for
both URL variables and put the app behind your HTTPS reverse proxy.
`NEXT_PUBLIC_APP_URL` is embedded during the build, so rebuild when it changes.

Supply real OAuth and UploadThing credentials in `.env` to use those
integrations.

The automatic schema step is convenient for a fresh local database. Back up
existing data and review schema changes before upgrading; `db:push` may require
interactive confirmation for destructive changes. This setup does not force
those changes. Never use `docker compose down -v` unless you intend to delete
the database. Changing `POSTGRES_PASSWORD` after initial setup does not update
the password stored in an existing PostgreSQL volume.

The image follows the [Next.js standalone deployment documentation](https://nextjs.org/docs/15/app/api-reference/config/next-config-js/output),
and service startup follows [Compose dependency conditions](https://docs.docker.com/compose/how-tos/startup-order/).

### commands

| command         | description                    |
|-----------------|--------------------------------|
| `bun dev`       | start local development        |
| `bun build`     | create a production build      |
| `bun latest`    | install latest deps            |
| `bun ui`        | add shadcn components          |
| `bun db:push`   | apply db schema changes        |
| `bun db:auth`   | update auth-related tables     |
| `bun db:studio` | open visual db editor          |

## notes

- relivator 1.4.0+ is ai-ready — optimized for ai-powered ides like cursor, making onboarding effortless even for beginners.
- version 1.3.0 evolved into versator, featuring [clerk](https://clerk.com) authentication and [stripe](https://stripe.com) payments. explore [versator demo](https://versator.relivator.com/en), [repo](https://github.com/blefnk/versator), or [docs](https://docs.reliverse.org/versator).

## stand with ukraine

- 💙 help fund drones, medkits, and victory.
- 💛 every dollar helps stop [russia's war crimes](https://war.ukraine.ua/russia-war-crimes) and saves lives.
- ‼️ please, [donate now](https://u24.gov.ua), it matters.

## stand with reliverse

- ⭐ [star the repo](https://github.com/blefnk/relivator) to help the reliverse community grow.
- 😉 follow this project's author, [nazar kornienko](https://github.com/blefnk) and his [reliverse](https://github.com/reliverse) ecosystem, to get updates about new projects faster.
- 🦄 [become a sponsor](https://github.com/sponsors/blefnk) and power the next wave of tools that _just feel right_.

> every bit of support helps keep the dream alive: dev tools that don't suck.

## license

mit © 2025 [nazar kornienko (blefnk)](https://github.com/blefnk), [reliverse](https://github.com/reliverse)
