import { BuyOnDemandClient, JSON_HEADERS } from '../api/cafe/buy-ondemand/buy-ondemand-client.js';
import { retrieveStationListAsync } from '../api/cafe/buy-ondemand/stations.js';
import { retrieveMenuItemsAsync } from '../api/cafe/buy-ondemand/menu-items.js';
import { ICafe } from '../models/cafe.js';
import fs from 'fs';
import path from 'path';

const FOODHALL4: ICafe = {
    name: 'Food Hall 4',
    id:   'foodhall4',
};

const run = async () => {
    console.log('Creating BuyOnDemand client for FH4...');
    const client = await BuyOnDemandClient.createAsync(FOODHALL4);
    console.log('Client created.');

    console.log('\nFetching station list...');
    const { stations } = await retrieveStationListAsync(client, 0);
    console.log(`Found ${stations.length} stations.`);

    // Pick the first station with items
    const station = stations[0];
    if (!station) {
        console.error('No stations found!');
        return;
    }
    console.log(`\nUsing station: ${station.name} (id: ${station.id})`);

    // Fetch menu items for this station
    const menuItems = await retrieveMenuItemsAsync(client, station, []);
    console.log(`Found ${menuItems.length} menu items.`);

    if (menuItems.length === 0) {
        console.error('No menu items found!');
        return;
    }

    // Look at raw item detail to find kitchenVideo fields
    const sampleItem = menuItems[0];
    if (!sampleItem) {
        console.error('No menu items found!');
        return;
    }
    console.log(`\nSample item: ${sampleItem.displayText}`);

    // Log all keys on the raw item to find kitchen-related fields
    const kitchenFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(sampleItem as unknown as Record<string, unknown>)) {
        if (key.toLowerCase().includes('kitchen') || key.toLowerCase().includes('cook')) {
            kitchenFields[key] = value;
        }
    }
    console.log('\nKitchen-related fields on raw item:', JSON.stringify(kitchenFields, null, 2));

    // Fetch the detailed item via kiosk-items/get-items (with itemIds) to get full detail
    console.log(`\nFetching detailed item for ${sampleItem.displayText} (id: ${sampleItem.id})...`);
    const detailedItems = await retrieveMenuItemsAsync(client, station, [sampleItem.id]);
    const detailedItem = detailedItems[0];
    if (detailedItem) {
        const detailedKitchenFields: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(detailedItem as unknown as Record<string, unknown>)) {
            if (key.toLowerCase().includes('kitchen') || key.toLowerCase().includes('cook') || key.toLowerCase().includes('video')) {
                detailedKitchenFields[key] = value;
            }
        }
        console.log('\nKitchen-related fields on detailed item:', JSON.stringify(detailedKitchenFields, null, 2));
    }

    // Now compare wait time approaches:
    // Approach 1: Current (dummy kitchenVideoId + total quantity)
    const totalQuantity = 2;
    console.log(`\n=== Wait Time Comparison (quantity=${totalQuantity}) ===\n`);

    console.log('Approach 1: Dummy kitchenVideoId...');
    const dummyResponse = await client.requestAsync(
        `/order/${client.config.tenantId}/${client.config.contextId}/getWaitTimeForItems`,
        {
            method:  'POST',
            headers: { ...JSON_HEADERS },
            body:    JSON.stringify({
                cartItems:          [
                    {
                        kitchenVideoId: ' ',
                        quantity:       totalQuantity
                    }
                ],
                varianceEnabled:    true,
                variancePercentage: 5
            })
        }
    );
    const dummyJson = await dummyResponse.json();
    console.log('Dummy response:', JSON.stringify(dummyJson, null, 2));

    // Approach 2: Full item data (like the HAR shows)
    console.log('\nApproach 2: Full item data...');
    const fullItemCartData = {
        ...detailedItem ?? sampleItem,
        properties: {
            cartGuid:     `${sampleItem.id}-${Date.now()}`,
            scannedItem:  false,
            priceLevelId: '96', // MS_2025
        },
        count:                totalQuantity,
        quantity:             totalQuantity,
        lineItemInstructions: [],
        conceptName:          station.name,
        holdAndFire:          false,
        modifierTotal:        0,
        mealPeriodId:         null,
        uniqueId:             `${sampleItem.id}-${Date.now()}`,
        cartItemId:           `adhoc-test-${Date.now()}`,
    };

    const fullResponse = await client.requestAsync(
        `/order/${client.config.tenantId}/${client.config.contextId}/getWaitTimeForItems`,
        {
            method:  'POST',
            headers: { ...JSON_HEADERS },
            body:    JSON.stringify({
                cartItems:          [fullItemCartData],
                varianceEnabled:    true,
                variancePercentage: 5,
                kitchenContextId:   null,
                deliveryType:       'pickup'
            })
        }
    );
    const fullJson = await fullResponse.json();
    console.log('Full response:', JSON.stringify(fullJson, null, 2));

    // Compare
    const dummyStr = JSON.stringify(dummyJson);
    const fullStr = JSON.stringify(fullJson);
    if (dummyStr === fullStr) {
        console.log('\n✅ Both approaches returned identical results.');
    } else {
        console.log('\n⚠️ DIFFERENT RESULTS!');
        console.log('Dummy:', dummyStr);
        console.log('Full:', fullStr);
    }

    // Save results
    const resultsDir = path.join(import.meta.dirname, 'results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    fs.writeFileSync(
        path.join(resultsDir, 'wait-time-comparison.json'),
        JSON.stringify({ dummyResponse: dummyJson, fullResponse: fullJson, sampleItemKeys: Object.keys(sampleItem) }, null, 2)
    );
    console.log('\nResults saved to results/wait-time-comparison.json');
};

run().catch(console.error);
