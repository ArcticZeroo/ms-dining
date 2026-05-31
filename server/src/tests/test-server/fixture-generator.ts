import seedrandom from 'seedrandom';



// ── Station templates ───────────────────────────────────────────────

interface ItemTemplate {
    name: string;
    receiptText: string;
    amount: string;
    calories: string;
    maxCalories: string;
    description?: string;
    hasModifiers?: boolean;
    tagIds?: string[];
}

interface CategoryTemplate {
    name: string;
    /** Indices into the station's item pool */
    itemIndices: number[];
}

interface StationTemplate {
    name: string;
    categories: CategoryTemplate[];
    items: ItemTemplate[];
    openTime: string;
    closeTime: string;
}

const STATION_POOL: StationTemplate[] = [
    {
        name: 'Grill',
        openTime: '7:00 AM', closeTime: '3:00 PM',
        categories: [
            { name: 'Burgers', itemIndices: [0, 1, 2] },
            { name: 'Sides', itemIndices: [3, 4] },
            { name: 'Salads', itemIndices: [5, 6] },
        ],
        items: [
            { name: 'Classic Cheeseburger', receiptText: 'CLASSIC CHZBRGR', amount: '11.99', calories: '780', maxCalories: '850', description: 'Angus beef patty with cheddar, lettuce, tomato, special sauce', hasModifiers: true },
            { name: 'BBQ Bacon Burger', receiptText: 'BBQ BACON BURGER', amount: '12.99', calories: '920', maxCalories: '980', description: 'Angus beef with applewood bacon, cheddar, crispy onion rings, BBQ sauce', hasModifiers: true },
            { name: 'Impossible Burger', receiptText: 'IMPOSSIBLE BRGR', amount: '13.50', calories: '630', maxCalories: '700', description: 'Plant-based patty with lettuce, tomato, pickles', hasModifiers: true, tagIds: ['tag-vegetarian'] },
            { name: 'Seasoned Fries', receiptText: 'SEASONED FRIES', amount: '4.50', calories: '400', maxCalories: '400', tagIds: ['tag-vegan'] },
            { name: 'Onion Rings', receiptText: 'ONION RINGS', amount: '5.25', calories: '450', maxCalories: '450', tagIds: ['tag-vegan'] },
            { name: 'Caesar Salad', receiptText: 'CAESAR SALAD', amount: '9.50', calories: '320', maxCalories: '380', description: 'Romaine, parmesan, croutons, caesar dressing', hasModifiers: true },
            { name: 'Garden Salad', receiptText: 'GARDEN SALAD', amount: '8.75', calories: '180', maxCalories: '250', description: 'Mixed greens, tomato, cucumber, carrots, choice of dressing', hasModifiers: true, tagIds: ['tag-vegan'] },
        ],
    },
    {
        name: 'Deli',
        openTime: '8:00 AM', closeTime: '2:30 PM',
        categories: [
            { name: 'Half Sandwiches', itemIndices: [0, 1, 2] },
            { name: 'Whole Sandwiches', itemIndices: [3, 4, 5] },
            { name: 'Soups', itemIndices: [6, 7] },
        ],
        items: [
            { name: 'Half Turkey Avocado', receiptText: '1/2 TURKEY AVO', amount: '7.99', calories: '380', maxCalories: '420', description: 'Sliced turkey, avocado, sprouts, swiss on multigrain' },
            { name: 'Half Italian', receiptText: '1/2 ITALIAN', amount: '7.50', calories: '410', maxCalories: '430', description: 'Salami, capicola, provolone, pepperoncini' },
            { name: 'Half Veggie', receiptText: '1/2 VEGGIE', amount: '6.99', calories: '280', maxCalories: '310', description: 'Roasted vegetables, hummus, feta on ciabatta', tagIds: ['tag-vegetarian'] },
            { name: 'Whole Turkey Avocado', receiptText: 'TURKEY AVO', amount: '11.99', calories: '720', maxCalories: '780', description: 'Sliced turkey, avocado, sprouts, swiss on multigrain' },
            { name: 'Whole Italian Sub', receiptText: 'ITALIAN SUB', amount: '11.50', calories: '780', maxCalories: '810', description: 'Salami, capicola, mortadella, provolone, oil & vinegar' },
            { name: 'Whole Veggie', receiptText: 'VEGGIE SUB', amount: '10.50', calories: '520', maxCalories: '560', description: 'Roasted vegetables, hummus, feta on ciabatta', tagIds: ['tag-vegetarian'] },
            { name: 'Tomato Basil Soup', receiptText: 'TOMATO SOUP', amount: '5.50', calories: '220', maxCalories: '220', tagIds: ['tag-vegetarian'] },
            { name: 'Chicken Noodle Soup', receiptText: 'CHKN NOODLE', amount: '5.50', calories: '180', maxCalories: '180' },
        ],
    },
    {
        name: 'Pacific Rim',
        openTime: '10:30 AM', closeTime: '2:00 PM',
        categories: [
            { name: 'Entrees', itemIndices: [0, 1, 2, 3] },
            { name: 'Sides', itemIndices: [4, 5] },
        ],
        items: [
            { name: 'Teriyaki Chicken Bowl', receiptText: 'TERIYAKI CHKN', amount: '13.50', calories: '680', maxCalories: '750', description: 'Grilled chicken, steamed rice, stir-fried vegetables, teriyaki glaze' },
            { name: 'Kung Pao Tofu', receiptText: 'KUNG PAO TOFU', amount: '12.50', calories: '550', maxCalories: '600', description: 'Crispy tofu, peanuts, bell peppers, chili sauce', tagIds: ['tag-vegan'] },
            { name: 'Orange Chicken', receiptText: 'ORANGE CHKN', amount: '13.00', calories: '780', maxCalories: '830', description: 'Crispy chicken in sweet orange glaze with broccoli' },
            { name: 'Beef Bulgogi Bowl', receiptText: 'BULGOGI BOWL', amount: '14.25', calories: '720', maxCalories: '780', description: 'Marinated beef, steamed rice, pickled vegetables, gochujang' },
            { name: 'Edamame', receiptText: 'EDAMAME', amount: '4.25', calories: '180', maxCalories: '180', tagIds: ['tag-vegan', 'tag-gf'] },
            { name: 'Miso Soup', receiptText: 'MISO SOUP', amount: '3.75', calories: '80', maxCalories: '80', tagIds: ['tag-vegan'] },
        ],
    },
    {
        name: 'Comfort Kitchen',
        openTime: '11:00 AM', closeTime: '2:00 PM',
        categories: [
            // Intentionally duplicate an item across categories
            { name: 'Comfort Classics', itemIndices: [0, 1, 2] },
            { name: 'Specials', itemIndices: [2, 3] },
        ],
        items: [
            { name: 'Beef Lasagna', receiptText: 'BEEF LASAGNA', amount: '10.99', calories: '650', maxCalories: '700', description: 'Layers of pasta, seasoned beef, ricotta, and marinara' },
            { name: 'Veggie Lasagna', receiptText: 'VEGGIE LASAGNA', amount: '10.99', calories: '550', maxCalories: '600', description: 'Layers of pasta, roasted vegetables, ricotta, and marinara', tagIds: ['tag-vegetarian'] },
            { name: 'Mac & Cheese', receiptText: 'MAC CHEESE', amount: '8.99', calories: '720', maxCalories: '750', description: 'Creamy four-cheese blend with elbow pasta', hasModifiers: true, tagIds: ['tag-vegetarian'] },
            { name: 'Chicken Pot Pie', receiptText: 'CHKN POT PIE', amount: '11.50', calories: '680', maxCalories: '730', description: 'Flaky crust with chicken, peas, carrots in cream sauce' },
        ],
    },
    {
        name: "Chef's Table",
        openTime: '11:00 AM', closeTime: '1:30 PM',
        categories: [
            { name: "Chef's Table", itemIndices: [0, 1, 2] },
        ],
        items: [
            { name: 'Chicken & Waffles', receiptText: 'CHKN WAFFLES', amount: '12.99', calories: '890', maxCalories: '950', description: 'Crispy fried chicken tenders on a Belgian waffle with maple syrup' },
            { name: 'Pan-Seared Salmon', receiptText: 'SEARED SALMON', amount: '15.99', calories: '520', maxCalories: '580', description: 'Atlantic salmon with lemon-dill sauce, roasted potatoes, asparagus', tagIds: ['tag-gf'] },
            { name: 'Braised Short Ribs', receiptText: 'SHORT RIBS', amount: '16.50', calories: '780', maxCalories: '850', description: 'Red wine braised short ribs with creamy polenta and gremolata' },
        ],
    },
    {
        name: 'Taqueria',
        openTime: '10:30 AM', closeTime: '2:30 PM',
        categories: [
            { name: 'Tacos', itemIndices: [0, 1, 2] },
            { name: 'Burritos', itemIndices: [3, 4] },
            // Intentionally share items across categories (like Typhoon)
            { name: 'Bowls', itemIndices: [5] },
            { name: 'Build Your Own', itemIndices: [0, 1, 3] },
        ],
        items: [
            { name: 'Carnitas Taco', receiptText: 'CARNITAS TACO', amount: '5.50', calories: '310', maxCalories: '350', description: 'Slow-roasted pork with salsa verde, cilantro, and onion', tagIds: ['tag-gf'] },
            { name: 'Pollo Asado Taco', receiptText: 'POLLO TACO', amount: '5.50', calories: '280', maxCalories: '320', description: 'Grilled chicken with pico de gallo and crema', tagIds: ['tag-gf'] },
            { name: 'Barbacoa Taco', receiptText: 'BARBACOA TACO', amount: '6.00', calories: '340', maxCalories: '380', description: 'Braised beef cheek with pickled red onion and cotija' },
            { name: 'Carne Asada Burrito', receiptText: 'CARNE BURRITO', amount: '12.50', calories: '980', maxCalories: '1050', description: 'Grilled steak, rice, beans, cheese, pico, sour cream', hasModifiers: true },
            { name: 'Veggie Burrito', receiptText: 'VEGGIE BURRITO', amount: '10.50', calories: '750', maxCalories: '820', description: 'Grilled peppers, onions, rice, beans, cheese, guacamole', hasModifiers: true, tagIds: ['tag-vegetarian'] },
            { name: 'Chicken Bowl', receiptText: 'CHICKEN BOWL', amount: '11.75', calories: '680', maxCalories: '750', description: 'Grilled chicken over rice with beans, corn salsa, and chipotle crema', hasModifiers: true, tagIds: ['tag-gf'] },
        ],
    },
    {
        name: 'Ramen Bar',
        openTime: '11:00 AM', closeTime: '2:00 PM',
        categories: [
            { name: 'Ramen Bowls', itemIndices: [0, 1, 2, 3] },
            { name: 'Sides & Apps', itemIndices: [4, 5, 6] },
        ],
        items: [
            { name: 'Tonkotsu Ramen', receiptText: 'TONKOTSU', amount: '14.50', calories: '890', maxCalories: '950', description: 'Rich pork bone broth with chashu, soft-boiled egg, nori, and green onion', hasModifiers: true },
            { name: 'Miso Ramen', receiptText: 'MISO RAMEN', amount: '13.75', calories: '780', maxCalories: '830', description: 'White miso broth with ground pork, corn, butter, and bean sprouts', hasModifiers: true },
            { name: 'Shoyu Ramen', receiptText: 'SHOYU RAMEN', amount: '13.50', calories: '720', maxCalories: '770', description: 'Soy sauce-based broth with chicken, bamboo shoots, and nori' },
            { name: 'Spicy Tantan Ramen', receiptText: 'SPICY TANTAN', amount: '15.00', calories: '920', maxCalories: '1000', description: 'Sesame-chili broth with ground pork, bok choy, and chili oil', hasModifiers: true, tagIds: ['tag-spicy'] },
            { name: 'Pan-Fried Gyoza (6pc)', receiptText: 'GYOZA 6PC', amount: '6.50', calories: '340', maxCalories: '340', description: 'Pork and cabbage dumplings with ponzu dipping sauce' },
            { name: 'Edamame', receiptText: 'EDAMAME', amount: '4.25', calories: '180', maxCalories: '180', tagIds: ['tag-vegan', 'tag-gf'] },
            { name: 'Chicken Karaage', receiptText: 'CHKN KARAAGE', amount: '7.75', calories: '420', maxCalories: '420', description: 'Japanese-style fried chicken with yuzu mayo' },
        ],
    },
    {
        name: 'Pizza & Pasta',
        openTime: '10:30 AM', closeTime: '3:00 PM',
        categories: [
            { name: 'Pizza', itemIndices: [0, 1, 2] },
            { name: 'Pasta', itemIndices: [3, 4] },
            { name: 'Sides', itemIndices: [5] },
        ],
        items: [
            { name: 'Margherita Pizza', receiptText: 'MARG PIZZA', amount: '10.50', calories: '680', maxCalories: '720', description: 'Fresh mozzarella, San Marzano tomatoes, basil', tagIds: ['tag-vegetarian'] },
            { name: 'Pepperoni Pizza', receiptText: 'PEP PIZZA', amount: '11.50', calories: '780', maxCalories: '820', description: 'Classic pepperoni with mozzarella and red sauce' },
            { name: 'BBQ Chicken Pizza', receiptText: 'BBQ CHKN PIZZA', amount: '12.50', calories: '750', maxCalories: '800', description: 'BBQ sauce, grilled chicken, red onion, cilantro' },
            { name: 'Penne Marinara', receiptText: 'PENNE MRNRA', amount: '9.50', calories: '580', maxCalories: '580', description: 'Penne with house marinara and parmesan', tagIds: ['tag-vegetarian'] },
            { name: 'Chicken Alfredo', receiptText: 'CHKN ALFREDO', amount: '12.75', calories: '850', maxCalories: '900', description: 'Fettuccine with grilled chicken in creamy alfredo sauce' },
            { name: 'Garlic Bread', receiptText: 'GARLIC BREAD', amount: '3.99', calories: '280', maxCalories: '280', tagIds: ['tag-vegetarian'] },
        ],
    },
    {
        name: 'Poke Bar',
        openTime: '10:30 AM', closeTime: '2:00 PM',
        categories: [
            { name: 'Poke Bowls', itemIndices: [0, 1, 2, 3] },
            { name: 'Extras', itemIndices: [4, 5] },
        ],
        items: [
            { name: 'Ahi Tuna Poke Bowl', receiptText: 'AHI TUNA POKE', amount: '14.99', calories: '520', maxCalories: '600', description: 'Fresh ahi tuna, sushi rice, cucumber, avocado, sesame', hasModifiers: true, tagIds: ['tag-gf'] },
            { name: 'Salmon Poke Bowl', receiptText: 'SALMON POKE', amount: '15.50', calories: '540', maxCalories: '620', description: 'Fresh salmon, sushi rice, mango, edamame, ponzu', hasModifiers: true, tagIds: ['tag-gf'] },
            { name: 'Tofu Poke Bowl', receiptText: 'TOFU POKE', amount: '12.50', calories: '420', maxCalories: '480', description: 'Marinated tofu, sushi rice, cucumber, avocado, ginger', hasModifiers: true, tagIds: ['tag-vegan', 'tag-gf'] },
            { name: 'Shrimp Poke Bowl', receiptText: 'SHRIMP POKE', amount: '15.99', calories: '490', maxCalories: '560', description: 'Cooked shrimp, sushi rice, seaweed salad, pickled ginger', hasModifiers: true, tagIds: ['tag-gf'] },
            { name: 'Extra Protein', receiptText: 'EXTRA PROTEIN', amount: '3.50', calories: '120', maxCalories: '180' },
            { name: 'Miso Soup', receiptText: 'MISO SOUP', amount: '3.75', calories: '80', maxCalories: '80', tagIds: ['tag-vegan'] },
        ],
    },
    {
        name: 'Espresso',
        openTime: '6:30 AM', closeTime: '4:00 PM',
        categories: [
            { name: 'Hot Drinks', itemIndices: [0, 1, 2, 3] },
            { name: 'Cold Drinks', itemIndices: [4, 5] },
            { name: 'Bakery', itemIndices: [6, 7, 8] },
        ],
        items: [
            { name: 'Drip Coffee', receiptText: 'DRIP COFFEE', amount: '4.25', calories: '5', maxCalories: '5', tagIds: ['tag-vegan'] },
            { name: 'Caffè Latte', receiptText: 'LATTE', amount: '4.75', calories: '190', maxCalories: '250', hasModifiers: true, tagIds: ['tag-vegetarian'] },
            { name: 'Cappuccino', receiptText: 'CAPPUCCINO', amount: '4.50', calories: '130', maxCalories: '180', hasModifiers: true, tagIds: ['tag-vegetarian'] },
            { name: 'Caffè Mocha', receiptText: 'MOCHA', amount: '5.25', calories: '350', maxCalories: '400', description: 'Espresso with steamed milk and chocolate', hasModifiers: true, tagIds: ['tag-vegetarian'] },
            { name: 'Iced Latte', receiptText: 'ICED LATTE', amount: '5.25', calories: '170', maxCalories: '230', hasModifiers: true, tagIds: ['tag-vegetarian'] },
            { name: 'Cold Brew', receiptText: 'COLD BREW', amount: '4.50', calories: '10', maxCalories: '10', description: 'Slow-steeped for 20 hours', tagIds: ['tag-vegan'] },
            { name: 'Blueberry Muffin', receiptText: 'BLBRY MUFFIN', amount: '3.50', calories: '380', maxCalories: '380', tagIds: ['tag-vegetarian'] },
            { name: 'Chocolate Croissant', receiptText: 'CHOC CROISSANT', amount: '4.00', calories: '340', maxCalories: '340', tagIds: ['tag-vegetarian'] },
            { name: 'Banana Bread', receiptText: 'BANANA BREAD', amount: '3.75', calories: '310', maxCalories: '310', tagIds: ['tag-vegetarian'] },
        ],
    },
    {
        name: 'Indian Kitchen',
        openTime: '11:00 AM', closeTime: '2:00 PM',
        categories: [
            { name: 'Curries', itemIndices: [0, 1, 2] },
            { name: 'Sides & Bread', itemIndices: [3, 4, 5] },
            // Intentional cross-category repeat
            { name: 'Combo Meals', itemIndices: [0, 3, 5] },
        ],
        items: [
            { name: 'Butter Chicken', receiptText: 'BUTTER CHKN', amount: '13.50', calories: '650', maxCalories: '720', description: 'Tender chicken in creamy tomato-butter sauce with basmati rice', tagIds: ['tag-gf'] },
            { name: 'Chana Masala', receiptText: 'CHANA MASALA', amount: '11.50', calories: '480', maxCalories: '520', description: 'Chickpeas in spiced tomato gravy with basmati rice', tagIds: ['tag-vegan', 'tag-gf'] },
            { name: 'Lamb Vindaloo', receiptText: 'LAMB VINDALOO', amount: '15.00', calories: '720', maxCalories: '780', description: 'Tender lamb in fiery vindaloo sauce with basmati rice', tagIds: ['tag-spicy', 'tag-gf'] },
            { name: 'Garlic Naan', receiptText: 'GARLIC NAAN', amount: '3.50', calories: '260', maxCalories: '260', tagIds: ['tag-vegetarian'] },
            { name: 'Samosa (2pc)', receiptText: 'SAMOSA 2PC', amount: '4.50', calories: '320', maxCalories: '320', description: 'Crispy pastry filled with spiced potato and peas', tagIds: ['tag-vegan'] },
            { name: 'Raita', receiptText: 'RAITA', amount: '2.50', calories: '80', maxCalories: '80', tagIds: ['tag-vegetarian', 'tag-gf'] },
        ],
    },
    {
        name: 'Mediterranean',
        openTime: '10:30 AM', closeTime: '2:30 PM',
        categories: [
            { name: 'Bowls', itemIndices: [0, 1] },
            { name: 'Wraps', itemIndices: [2, 3] },
            { name: 'Sides', itemIndices: [4, 5] },
        ],
        items: [
            { name: 'Lamb Gyro Bowl', receiptText: 'LAMB GYRO BWL', amount: '14.50', calories: '680', maxCalories: '740', description: 'Seasoned lamb, rice, hummus, tzatziki, tomato-cucumber salad' },
            { name: 'Falafel Bowl', receiptText: 'FALAFEL BWL', amount: '12.50', calories: '550', maxCalories: '620', description: 'Crispy falafel, rice, hummus, pickled turnips, tahini', tagIds: ['tag-vegan'] },
            { name: 'Chicken Shawarma Wrap', receiptText: 'CHKN SHWARMA', amount: '11.99', calories: '620', maxCalories: '680', description: 'Marinated chicken, pickles, garlic sauce in lavash' },
            { name: 'Falafel Wrap', receiptText: 'FALAFEL WRAP', amount: '10.50', calories: '520', maxCalories: '580', description: 'Falafel, hummus, tomato, pickled vegetables in lavash', tagIds: ['tag-vegan'] },
            { name: 'Hummus & Pita', receiptText: 'HUMMUS PITA', amount: '5.50', calories: '320', maxCalories: '320', tagIds: ['tag-vegan'] },
            { name: 'Tabbouleh', receiptText: 'TABBOULEH', amount: '4.50', calories: '150', maxCalories: '150', tagIds: ['tag-vegan'] },
        ],
    },
];

// ── Modifier templates ──────────────────────────────────────────────

interface ModifierTemplate {
    description: string;
    type: 'radio' | 'checkbox';
    minimum: number;
    maximum: number;
    options: Array<{ description: string; amount: string }>;
}

const MODIFIER_POOL: ModifierTemplate[] = [
    {
        description: 'Size',
        type: 'radio',
        minimum: 1,
        maximum: 1,
        options: [
            { description: 'Regular', amount: '0.00' },
            { description: 'Large', amount: '1.50' },
        ],
    },
    {
        description: 'Add-Ons',
        type: 'checkbox',
        minimum: 0,
        maximum: 3,
        options: [
            { description: 'Extra Cheese', amount: '1.00' },
            { description: 'Bacon', amount: '1.50' },
            { description: 'Avocado', amount: '2.00' },
            { description: 'Fried Egg', amount: '1.25' },
        ],
    },
    {
        description: 'Dressing',
        type: 'radio',
        minimum: 0,
        maximum: 1,
        options: [
            { description: 'Ranch', amount: '0.00' },
            { description: 'Vinaigrette', amount: '0.00' },
            { description: 'Caesar', amount: '0.00' },
            { description: 'No Dressing', amount: '0.00' },
        ],
    },
    {
        description: 'Spice Level',
        type: 'radio',
        minimum: 1,
        maximum: 1,
        options: [
            { description: 'Mild', amount: '0.00' },
            { description: 'Medium', amount: '0.00' },
            { description: 'Hot', amount: '0.00' },
            { description: 'Extra Hot', amount: '0.00' },
        ],
    },
    {
        description: 'Milk Choice',
        type: 'radio',
        minimum: 1,
        maximum: 1,
        options: [
            { description: 'Whole Milk', amount: '0.00' },
            { description: 'Oat Milk', amount: '0.75' },
            { description: 'Almond Milk', amount: '0.75' },
            { description: 'Soy Milk', amount: '0.50' },
        ],
    },
    {
        description: 'Bread Choice',
        type: 'radio',
        minimum: 1,
        maximum: 1,
        options: [
            { description: 'White', amount: '0.00' },
            { description: 'Wheat', amount: '0.00' },
            { description: 'Sourdough', amount: '0.00' },
            { description: 'Ciabatta', amount: '0.50' },
            { description: 'Gluten-Free Bun', amount: '1.50' },
        ],
    },
    {
        description: 'Cheese',
        type: 'radio',
        minimum: 0,
        maximum: 1,
        options: [
            { description: 'American', amount: '0.00' },
            { description: 'Cheddar', amount: '0.00' },
            { description: 'Pepper Jack', amount: '0.00' },
            { description: 'Swiss', amount: '0.50' },
            { description: 'Provolone', amount: '0.50' },
            { description: 'No Cheese', amount: '0.00' },
        ],
    },
    {
        description: 'Sauce',
        type: 'checkbox',
        minimum: 0,
        maximum: 2,
        options: [
            { description: 'Mayo', amount: '0.00' },
            { description: 'Mustard', amount: '0.00' },
            { description: 'Ketchup', amount: '0.00' },
            { description: 'Sriracha', amount: '0.25' },
            { description: 'Garlic Aioli', amount: '0.50' },
            { description: 'BBQ', amount: '0.25' },
        ],
    },
    {
        description: 'Protein',
        type: 'radio',
        minimum: 1,
        maximum: 1,
        options: [
            { description: 'Chicken', amount: '0.00' },
            { description: 'Tofu', amount: '0.00' },
            { description: 'Beef', amount: '1.50' },
            { description: 'Shrimp', amount: '2.00' },
            { description: 'No Protein', amount: '-2.00' },
        ],
    },
    {
        description: 'Cooked Temp',
        type: 'radio',
        minimum: 1,
        maximum: 1,
        options: [
            { description: 'Rare', amount: '0.00' },
            { description: 'Medium Rare', amount: '0.00' },
            { description: 'Medium', amount: '0.00' },
            { description: 'Medium Well', amount: '0.00' },
            { description: 'Well Done', amount: '0.00' },
        ],
    },
    {
        description: 'Side Choice',
        type: 'radio',
        minimum: 1,
        maximum: 1,
        options: [
            { description: 'Fries', amount: '0.00' },
            { description: 'Side Salad', amount: '0.00' },
            { description: 'Soup of the Day', amount: '0.50' },
            { description: 'Onion Rings', amount: '1.00' },
        ],
    },
    {
        description: 'Toppings',
        type: 'checkbox',
        minimum: 0,
        maximum: 5,
        options: [
            { description: 'Lettuce', amount: '0.00' },
            { description: 'Tomato', amount: '0.00' },
            { description: 'Onion', amount: '0.00' },
            { description: 'Pickles', amount: '0.00' },
            { description: 'Jalapenos', amount: '0.25' },
            { description: 'Mushrooms', amount: '0.50' },
        ],
    },
    {
        description: 'Sweetener',
        type: 'radio',
        minimum: 0,
        maximum: 1,
        options: [
            { description: 'None', amount: '0.00' },
            { description: 'Sugar', amount: '0.00' },
            { description: 'Stevia', amount: '0.00' },
            { description: 'Honey', amount: '0.25' },
            { description: 'Vanilla Syrup', amount: '0.75' },
        ],
    },
];

// ── Tag definitions pool ────────────────────────────────────────────
// Real DB has ~123 distinct MenuItemTag IDs (the BoD-supplied label tags
// like "vegetarian", "vegan", carbon-emission badges). Only ~32% of items
// are tagged, and most have just 1 tag. This pool reflects that ratio.

const TAG_POOL = [
    { tagId: 'tag-vegetarian', tagName: 'vegetarian' },
    { tagId: 'tag-vegan', tagName: 'vegan' },
    { tagId: 'tag-gf', tagName: 'gluten free' },
    { tagId: 'tag-spicy', tagName: 'spicy' },
    { tagId: 'tag-new', tagName: 'new' },
    { tagId: 'tag-healthy', tagName: 'healthy' },
    // Carbon-emission badges — mirrors real DB
    { tagId: 'tag-low-emissions', tagName: 'low emissions' },
    { tagId: 'tag-medium-emissions', tagName: 'medium emissions' },
    { tagId: 'tag-high-emissions', tagName: 'high emissions' },
    { tagId: 'tag-low-circle', tagName: 'low_circle' },
    { tagId: 'tag-medium-circle', tagName: 'medium_circle' },
    { tagId: 'tag-high-circle', tagName: 'high_circle' },
];

// ── Seeded random helpers ───────────────────────────────────────────

class SeededRandom {
    private rng: () => number;

    constructor(seed: string) {
        this.rng = seedrandom(seed);
    }

    /** [0, 1) */
    next(): number {
        return this.rng();
    }

    /** [min, max] inclusive */
    int(min: number, max: number): number {
        return Math.floor(this.rng() * (max - min + 1)) + min;
    }

    /** Pick count unique items from arr (Fisher-Yates shuffle, take count) */
    pick<T>(arr: readonly T[], count: number): T[] {
        const copy = [...arr];
        const result: T[] = [];
        for (let i = 0; i < Math.min(count, copy.length); i++) {
            const j = this.int(i, copy.length - 1);
            [copy[i], copy[j]] = [copy[j]!, copy[i]!];
            result.push(copy[i]!);
        }
        return result;
    }

    pickOne<T>(arr: readonly T[]): T {
        return arr[this.int(0, arr.length - 1)]!;
    }

    /** Pick count items with replacement (allows duplicates) */
    sample<T>(arr: readonly T[], count: number): T[] {
        return Array.from({ length: count }, () => this.pickOne(arr));
    }
}

// ── Generation ──────────────────────────────────────────────────────

export interface GeneratedFixtures {
    config: object;
    stations: object[];
    'menu-items': object[];
    tags: Record<string, { customLabels: Record<string, { tagId: string; tagName: string }> }>;
}

export function generateForCafe(cafeId: string): GeneratedFixtures {
    const rng = new SeededRandom(`ms-dining-fixtures-${cafeId}`);

    // Config
    const tenantId = `tenant-${cafeId}`;
    const contextId = `ctx-${cafeId}-${rng.int(1000, 9999)}`;
    const displayProfileId = `dp-${cafeId}-${rng.int(100, 999)}`;
    const storeId = `store-${cafeId}-${rng.int(100, 999)}`;

    const config = {
        tenantID: tenantId,
        contextID: contextId,
        theme: { logoImage: `${cafeId}-logo.png` },
        storeList: [{
            storeInfo: { storeInfoId: storeId, storeName: cafeId },
            displayProfileId: [displayProfileId],
        }],
        properties: {},
    };

    // Pick a "size class" deterministically so we end up with a realistic
    // distribution: most cafes are medium, a few are small kiosks, a few are
    // large food halls. Numbers are tuned to roughly match real DB volume
    // (170 daily stations, 3,485 daily items across 55 cafes).
    const sizeRoll = rng.next();
    let stationCount: number;
    let variantsPerItem: number;
    if (sizeRoll < 0.20) {
        // Small kiosk/coffee bar
        stationCount = rng.int(1, 2);
        variantsPerItem = rng.int(1, 2);
    } else if (sizeRoll < 0.75) {
        // Medium cafe
        stationCount = rng.int(3, 5);
        variantsPerItem = rng.int(2, 3);
    } else {
        // Large food hall — cap at pool size since we pick without replacement
        stationCount = Math.min(rng.int(6, 10), STATION_POOL.length);
        variantsPerItem = rng.int(2, 4);
    }
    const selectedStations = rng.pick(STATION_POOL, stationCount);

    const allMenuItems: object[] = [];
    const allStations: object[] = [];
    const allTags: Record<string, { customLabels: Record<string, { tagId: string; tagName: string }> }> = {};
    let itemIdCounter = 0;

    for (const template of selectedStations) {
        const stationId = `${cafeId}-stn-${template.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${rng.int(1000, 9999)}`;
        const menuId = `${cafeId}-menu-${rng.int(10000, 99999)}`;

        // Expand each template item into N variants with prefix labels so the
        // station ends up with a realistic count of distinct items. Variants
        // inherit category placement and modifier behavior from their base.
        const VARIANT_PREFIXES = ['Classic', 'Premium', 'Mini', 'Family-Size', 'Spicy', 'Loaded', 'Lite', 'Deluxe'];
        const selectedPrefixes = ['Classic', ...rng.pick(VARIANT_PREFIXES.filter(prefix => prefix !== 'Classic'), variantsPerItem - 1)];

        type ExpandedItem = { templateIdx: number; variantIdx: number; tmpl: ItemTemplate; prefix: string; itemId: string };
        const expandedItems: ExpandedItem[] = [];

        for (let i = 0; i < template.items.length; i++) {
            const baseTmpl = template.items[i]!;
            for (let variantIndex = 0; variantIndex < selectedPrefixes.length; variantIndex++) {
                const prefix = selectedPrefixes[variantIndex]!;
                const variantName = prefix === 'Classic' ? baseTmpl.name : `${prefix} ${baseTmpl.name}`;
                const variantReceipt = prefix === 'Classic'
                    ? baseTmpl.receiptText
                    : `${prefix.toUpperCase().slice(0, 4)} ${baseTmpl.receiptText}`.slice(0, 30);
                const itemId = `${cafeId}-item-${++itemIdCounter}-${rng.int(1000, 9999)}`;
                expandedItems.push({
                    templateIdx: i,
                    variantIdx: variantIndex,
                    tmpl: { ...baseTmpl, name: variantName, receiptText: variantReceipt },
                    prefix,
                    itemId,
                });
            }
        }

        // Build a 2D lookup: templateIdx -> [item IDs for all variants]
        const itemIdsByTemplateIdx = new Map<number, string[]>();
        for (const exp of expandedItems) {
            const existing = itemIdsByTemplateIdx.get(exp.templateIdx) ?? [];
            existing.push(exp.itemId);
            itemIdsByTemplateIdx.set(exp.templateIdx, existing);
        }

        const categories = template.categories.map((cat, catIdx) => ({
            categoryId: `${cafeId}-cat-${catIdx}-${rng.int(1000, 9999)}`,
            name: cat.name,
            items: cat.itemIndices.flatMap(idx => itemIdsByTemplateIdx.get(idx) ?? []),
        }));

        allStations.push({
            id: stationId,
            name: template.name,
            priceLevelConfig: { menuId },
            menus: [{
                id: menuId,
                name: `${template.name} Menu`,
                categories,
                lastUpdateTime: '2025-06-01T00:00:00.000Z',
            }],
            conceptOptions: {
                onDemandDisplayText: template.name,
                displayText: template.name,
            },
            availableAt: { open: template.openTime, close: template.closeTime },
            schedule: [{
                scheduledExpression: '0 0 0 * * *',
                displayProfileState: {
                    conceptStates: [{ conceptId: stationId, menuId }],
                },
            }],
            openScheduleExpression: '0 0 7 * * *',
            closeScheduleExpression: '0 0 15 * * *',
        });

        // Build menu items with auto-assigned tags + modifiers.
        // Real DB: 99.9% items tagged, avg 6.4 tags per item; 45.7% have modifiers.
        const stationLabels: Record<string, { tagId: string; tagName: string }> = {};

        for (const exp of expandedItems) {
            const { tmpl, itemId } = exp;

            // Real DB: only ~32% of items are tagged, and most have just 1 tag.
            // Use item-level seed so the same template's variant gets a stable tag set.
            const itemRng = new SeededRandom(`tags-${itemId}`);
            const itemTagIds = new Set<string>();
            if (itemRng.next() < 0.32) {
                // Apply template-declared tags + a few random ones.
                // 75% chance of just 1 tag, 20% chance of 2, 5% chance of 3.
                for (const tid of (tmpl.tagIds ?? [])) {
                    itemTagIds.add(tid);
                }
                const tagRoll = itemRng.next();
                const targetCount = tagRoll < 0.75 ? 1 : tagRoll < 0.95 ? 2 : 3;
                while (itemTagIds.size < targetCount) {
                    const tag = itemRng.pickOne(TAG_POOL);
                    itemTagIds.add(tag.tagId);
                }
            }

            for (const tid of itemTagIds) {
                const tagDef = TAG_POOL.find(tag => tag.tagId === tid);
                if (tagDef && !stationLabels[tid]) {
                    stationLabels[tid] = { tagId: tagDef.tagId, tagName: tagDef.tagName };
                }
            }

            // Most items get modifiers in the real DB (~46%). Template-flagged
            // items always get them, plus a chunk of others.
            const modRng = new SeededRandom(`mods-${itemId}`);
            const shouldHaveModifiers = tmpl.hasModifiers || modRng.next() < 0.25;
            let modifiers: object | undefined;
            if (shouldHaveModifiers) {
                // Real DB: avg 2.3 modifiers per item-with-mods, max 9, min 1.
                // Weight toward 1-3 with a long tail.
                const modRoll = modRng.next();
                const modCount = modRoll < 0.45 ? 1
                    : modRoll < 0.75 ? 2
                        : modRoll < 0.92 ? 3
                            : modRoll < 0.98 ? 5
                                : modRng.int(6, 9);
                const selectedMods = modRng.pick(MODIFIER_POOL, modCount);
                modifiers = {
                    modifiers: selectedMods.map((mod, modIdx) => ({
                        id: `${itemId}-mod-${modIdx}`,
                        description: mod.description,
                        minimum: mod.minimum,
                        maximum: mod.maximum,
                        type: mod.type,
                        options: mod.options.map((opt, optIdx) => ({
                            id: `${itemId}-mod-${modIdx}-opt-${optIdx}`,
                            description: opt.description,
                            amount: opt.amount,
                        })),
                    })),
                };
            }

            allMenuItems.push({
                id: itemId,
                amount: tmpl.amount,
                displayText: tmpl.name,
                properties: { calories: tmpl.calories, maxCalories: tmpl.maxCalories },
                description: tmpl.description,
                lastUpdateTime: '2025-06-01T00:00:00.000Z',
                isItemCustomizationEnabled: shouldHaveModifiers,
                receiptText: tmpl.receiptText,
                tagIds: [...itemTagIds],
                priceLevels: {
                    'pl-1': {
                        priceLevelId: 'pl-1',
                        name: 'Default',
                        price: { currencyUnit: 'USD', amount: tmpl.amount },
                    },
                },
                _modifiers: modifiers,
            });
        }

        if (Object.keys(stationLabels).length > 0) {
            allTags[stationId] = { customLabels: stationLabels };
        }
    }

    return {
        config,
        stations: allStations,
        'menu-items': allMenuItems,
        tags: allTags,
    };
}

// ── Write fixtures ──────────────────────────────────────────────────
