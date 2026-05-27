# Dining @ Microsoft (Unofficial)

[View the website live!](https://dining.frozor.io)

Dining @ Microsoft is an UNOFFICIAL frontend for the buy-ondemand websites that Microsoft cafes use.

## Features

The Dining @ Microsoft site is built with user experience in mind. Compared to Microsoft's official solutions: you'll find that Dining @ Microsoft loads faster, has way more features, and is a more pleasant experience in general.

Some highlighted features:
- Bandwidth usage is significantly lower. In some cases, menu item images can reach 9MB on the buy-ondemand site, but Dining @ Microsoft downscales these into thumbnails automatically.
- Cafes in the same building are grouped together so you don't have to visit separate pages for each building
- Search across the entire campus at once!
- On any menu item, see its recent visit history across campus and get an estimate for when it'll return next
- Map view which lets you easily see nearby cafes (search will also eventually show up in this page directly)
- Mark your favorite menu items and see when they're anywhere on campus for the day
- You can review menu items or entire stations to help others (or yourself in the future) make meal decisions.
- Recommendations, which are based on factors like your saved homepage cafes, your reviews (if any), others' reviews, etc.
- Ability to highlight items that are gluten free, vegan, vegetarian for easier management of dietary restrictions. Note that you can't filter just to these items because the official website doesn't always tag items that are obviously free of allergens.
- Ability to filter just to items within a certain price range. Great for finding cheaper snacks.
  - There's also a page entirely dedicated to a leaderboard for best calories per dollar!
- Smart detection of items that are rotating for the day at stations (or entire stations that are rotating), and AI-generated summaries of the rotating items. This allows you to more easily scan overviews for what's different today if you visit the same cafeteria daily and know all the usuals.
  - By default, stations are also sorted based on interesting-ness using this detection

## Online Ordering

Right now, online ordering is _not available_ on the Dining @ Microsoft website. Cafes have an easy link to the buy-ondemand site for you to order once you've decided what you want to eat.

However, Online Ordering is _implemented_ and working, it is just disabled. If you decide to turn on Online Ordering yourself, there are some very important caveats:
- Every other feature on Dining @ Microsoft aside from Online Ordering has not caused you to interact directly with buy-ondemand / agilysys services in any way. By interacting with online ordering, you are interacting with a 3rd-party service that I have no control over. They have a different privacy policy.
- Dining @ Microsoft never directly sees your payment information (aside from phone number and alias). The payment itself occurs within an iframe hosted by a PCI compliant 3rd-party. This iframe reports back a payment token and the last few digits of your card, which gets sent to the buy-ondemand website to complete your order.
- It is likely that there will be bugs that could result in your order arriving incorrectly at the kitchen and/or you being charged without your order arriving at all.

## Questions

If you have any questions, feedback, feature ideas, bugs, concerns, etc. please reach out to me:
- spnovick@microsoft.com
- novick.spencer@gmail.com