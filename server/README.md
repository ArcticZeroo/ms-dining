# MSDining Server

Provides the backend API for the [msdining](https://msdining.frozor.io) website.

On boot (or at 9am PST every weekday), cafeteria menus are populated from the buy-ondemand website
APIs. There is currently no database, so this is all in-memory.

Thumbnails are also generated for menu items in order to improve the user experience in the client app.
- Fun fact: The official buy-ondemand websites load each menu item's image in full resolution (which, for newer cafes, 
can be >1000x1000px across tens or hundreds of images for one cafe), then locally downscale them using a canvas.
- Local thumbnail generation saves user bandwidth and improves performance.

## Upcoming Features (Probably)

- Reviews
  - Will this require user accounts? Do anonymous reviews make any sense?
- Database to significantly improve startup time
  - Maybe I'll make a separate service for this to avoid the massive perf problems that occur when loading the website 
  as the server is populating cafes
- Ability to order online from the cafes
  - Will have to be careful with error handling here

## Development

The server is built on koa and uses prisma for database operations. The database is just a local SQLite file due to
the small scale of the project.

The only requirement for this project is a recent version of node.

To get started for development:

1. `npm install
1. `npx prisma migrate dev`
1. (optional) create a .env file with the following contents:
   ```
   OPENAI_API_KEY="your-openai-api-key"
   ```
   - This is only necessary if you want to use ChatGPT for generating search tags.
1. `npm run dev`

Some settings differ between development and production. See `util/env.ts` for some of these settings. 
logDebug statements will also only print in dev mode.

### High-level Architecture

- `api/cafe` has most of the interesting bits - it's where the menus are populated, thumbnails are generated, etc.
- `api/storage` has storage clients for models in the prisma schema, and do some caching. At some point I want to decouple the caching from the actual db reads.
- `api/worker` implements a simple asynchronous worker queue (still in the same process) for generating search tags, or anything really
- `routes` contains all of the user-facing routes

## Deployment

Deployment is currently manual. Assuming this is a fresh repo separate from your development environment:

1. Install packages in all three directories (client, common, server)
2. In client, run `npm run build`
3. In server, run `npm run deploy`
  - Alternatively, you can use `pm2 start pm2.json`, which will start the server under the name MSDining.

