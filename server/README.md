# MSDining Server

Provides the backend API for the [msdining](https://msdining.frozor.io) website.

On boot (or at 9am PST every weekday), cafeteria menus are populated from the buy-ondemand website
APIs. There is currently no database, so this is all in-memory.

Thumbnails are also generated for menu items in order to improve the user experience in the client app.
- Fun fact: The official buy-ondemand websites load each menu item's image in full resolution (which, for newer cafes, 
can be >1000x1000px across tens or hundreds of images for one cafe), then locally downscale them using a canvas.
- Local thumbnail generation saves user bandwidth and improves performance.

## Upcoming Features (Probably)

- Database to significantly improve startup time
  - Maybe I'll make a separate service for this to avoid the massive perf problems that occur when loading the website 
  as the server is populating cafes
- Ability to view menus for future days
- Ability to order online from the cafes
  - Will have to be careful with error handling here