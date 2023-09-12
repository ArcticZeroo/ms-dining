import { diningHalls } from './constants/dining-halls.js';
import { DiningHallDiscoverySession } from './api/dining/dining-hall.js';

const testHall = diningHalls[0];

console.log(`Performing discovery with hall ${testHall.friendlyName} at url ${testHall.url}`);

const session = new DiningHallDiscoverySession(testHall);
await session.performDiscoveryAsync();

console.log(`Discovered ${session.concepts.length} concepts.`);

for (const concept of session.concepts) {
    console.log('');
    console.log('Concept:', concept.name);
    console.log('   Menu Items:');
    for (const menuItem of concept.menuItemsById.values()) {
        console.log('      ', menuItem.displayName, ' - ', `$${menuItem.price}`);
    }
}