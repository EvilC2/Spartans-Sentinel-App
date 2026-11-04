// Spartans — cafeteria menu (Gemini Foods, Sentinel caf).
// Prices come from Gemini's posted menus (Sept 2026): the Hot Meals board, the
// Cold Meals sheet, and the Snacks & Baked Goods and Beverages sheets with the
// staff's handwritten changes (crossed out = gone, new price = new price).
// Items no menu prices say "Ask at counter". Do not guess prices.
// Art: Microsoft Fluent Emoji 3D (MIT) plus Spartans originals drawn in the same
// style by tools/food-art (run `node tools/food-art/build.mjs`). Every item gets
// its own picture; there are no badge overlays.

import type { ImageSourcePropType } from 'react-native';

export type MenuCategory =
  | 'breakfast' | 'items' | 'drinks' | 'sandwiches' | 'handheld' | 'plated'
  | 'produce' | 'burgers' | 'bowls' | 'sides' | 'dessert';

export type Tag = 'popular' | 'healthy' | 'gf' | 'veg' | 'snack' | 'meal' | 'hot' | 'cold' | 'handheld' | 'plated';

export type MenuItem = {
  id: string;
  name: string;
  price?: number;            // undefined = not on any menu, ask at the counter
  cats: MenuCategory[];      // an item can sit in more than one category
  icon: ImageSourcePropType;
  blurb: string;
  tags: Tag[];
  sometimes?: boolean;       // only in stock some days
  // Set by App Club Admin menu posts (src/content), never in MENU below:
  soldOut?: boolean;         // greyed out, can't go on the tray
  featured?: boolean;        // in the "Today" strip at the top
  postId?: string;           // the post that changed or added it
};

export const FOOD_ART = {
  // breakfast + bakery
  wrapBaconSausage: require('../assets/food/wrap-bacon-sausage.png'),
  wrapSausage: require('../assets/food/wrap-sausage.png'),
  wrapEgg: require('../assets/food/wrap-egg.png'),
  breakfastSandwich: require('../assets/food/breakfast-sandwich.png'),
  croissantChoc: require('../assets/food/croissant-choc.png'),
  muffin: require('../assets/food/muffin.png'),
  scone: require('../assets/food/scone.png'),
  cinnamonBun: require('../assets/food/cinnamon-bun.png'),
  appleFritter: require('../assets/food/apple-fritter.png'),
  breakfast: require('../assets/food/breakfast.png'),
  // sandwiches + wraps
  hamTurkey: require('../assets/food/sand-ham-turkey.png'),
  chickenSalad: require('../assets/food/sand-chicken-salad.png'),
  eggSalad: require('../assets/food/sand-egg-salad.png'),
  blt: require('../assets/food/sand-blt.png'),
  grilledCheese: require('../assets/food/grilled-cheese.png'),
  grilledHamCheese: require('../assets/food/grilled-ham-cheese.png'),
  wrapBuffalo: require('../assets/food/wrap-buffalo.png'),
  wrapCaesar: require('../assets/food/wrap-caesar.png'),
  sandwich: require('../assets/food/sandwich.png'),
  // handheld + burgers
  pizza: require('../assets/food/pizza.png'),
  pizzaCheese: require('../assets/food/pizza-cheese.png'),
  hotdog: require('../assets/food/hotdog.png'),
  quesadillaCheese: require('../assets/food/quesadilla-cheese.png'),
  quesadillaChicken: require('../assets/food/quesadilla-chicken.png'),
  pizzaRolls: require('../assets/food/pizza-rolls.png'),
  burger: require('../assets/food/burger.png'),
  burgerBeef: require('../assets/food/burger-beef.png'),
  burgerCheese: require('../assets/food/burger-cheese.png'),
  burgerBacon: require('../assets/food/burger-bacon.png'),
  burgerChicken: require('../assets/food/burger-chicken.png'),
  burgerVeggie: require('../assets/food/burger-veggie.png'),
  // plated, bowls, sides
  special: require('../assets/food/special.png'),
  pasta: require('../assets/food/pasta.png'),
  soup: require('../assets/food/soup.png'),
  pot: require('../assets/food/pot.png'),
  tenders: require('../assets/food/tenders.png'),
  fries: require('../assets/food/fries.png'),
  tots: require('../assets/food/tots.png'),
  gyoza: require('../assets/food/gyoza.png'),
  samosa: require('../assets/food/samosa.png'),
  perogies: require('../assets/food/perogies.png'),
  pizzaPretzel: require('../assets/food/pizza-pretzel.png'),
  pepperoniStick: require('../assets/food/pepperoni-stick.png'),
  // fruit, veg, salads
  salad: require('../assets/food/salad.png'),
  fruitCup: require('../assets/food/fruit-cup.png'),
  veggieCup: require('../assets/food/veggie-cup.png'),
  wholeFruit: require('../assets/food/whole-fruit.png'),
  parfait: require('../assets/food/yogurt-parfait.png'),
  chiaPudding: require('../assets/food/chia-pudding.png'),
  caesarSalad: require('../assets/food/salad-caesar.png'),
  southwestSalad: require('../assets/food/salad-southwest.png'),
  pastaSalad: require('../assets/food/salad-pasta.png'),
  // dessert
  brownie: require('../assets/food/brownie.png'),
  donut: require('../assets/food/donut.png'),
  cookie: require('../assets/food/cookie.png'),
  riceCrispy: require('../assets/food/rice-crispy.png'),
  iceCream: require('../assets/food/ice-cream.png'),
  // snacks
  doritos: require('../assets/food/chips-doritos.png'),
  lays: require('../assets/food/chips-lays.png'),
  laysBbq: require('../assets/food/chips-lays-bbq.png'),
  laysKetchup: require('../assets/food/chips-lays-ketchup.png'),
  mvJalapeno: require('../assets/food/chips-mv-jalapeno.png'),
  mvSourCream: require('../assets/food/chips-mv-sour-cream.png'),
  mvOriginal: require('../assets/food/chips-mv-original.png'),
  mvVinegar: require('../assets/food/chips-mv-vinegar.png'),
  hickory: require('../assets/food/chips-hickory.png'),
  sunchips: require('../assets/food/chips-sunchips.png'),
  cheetos: require('../assets/food/chips-cheetos.png'),
  smartfood: require('../assets/food/popcorn-smartfood.png'),
  pringles: require('../assets/food/pringles.png'),
  gum: require('../assets/food/gum.png'),
  mints: require('../assets/food/mints.png'),
  halls: require('../assets/food/halls.png'),
  // drinks
  cola: require('../assets/food/cola.png'),
  coffeeTea: require('../assets/food/coffee-tea.png'),
  hotDrink: require('../assets/food/hot-drink.png'),
  icedCoffee: require('../assets/food/iced-coffee.png'),
  canPop: require('../assets/food/can-pop.png'),
  bottledPop: require('../assets/food/bottled-pop.png'),
  water: require('../assets/food/water-bottle.png'),
  pellegrino: require('../assets/food/pellegrino.png'),
  juiceCan: require('../assets/food/juice-can.png'),
  gatorade: require('../assets/food/gatorade.png'),
  pureLeaf: require('../assets/food/pure-leaf.png'),
  milkToGo: require('../assets/food/milk-to-go.png'),
  smoothie: require('../assets/food/smoothie.png'),
  juicebox: require('../assets/food/juicebox.png'),
  snapple: require('../assets/food/snapple.png'),
  sparklingIce: require('../assets/food/sparkling-ice.png'),
  // ui
  plate: require('../assets/food/plate.png'),
  cutlery: require('../assets/food/cutlery.png'),
  leafy: require('../assets/food/leafy.png'),
  veggie: require('../assets/food/veggie.png'),
  fire: require('../assets/food/fire.png'),
  ice: require('../assets/food/ice.png'),
  star: require('../assets/food/star.png'),
  cash: require('../assets/food/cash.png'),
  coin: require('../assets/food/coin.png'),
  card: require('../assets/food/card.png'),
  gift: require('../assets/food/gift.png'),
};

export const BRAND = {
  logo: require('../assets/brand/gemini-foods.png'),   // 900x130, official mark from geminifoods.ca
  giftCard: require('../assets/brand/gift-card.png'),  // 1390x970, tilt + shadow baked in
};

export const GIFT_CARD_URL = 'https://my.loopz.io/gift-card/effc293b-5308-4955-87e3-83fa0999df8d/order';

export const CATEGORIES: { id: MenuCategory | 'all'; label: string; icon: ImageSourcePropType; note?: string }[] = [
  { id: 'all', label: 'All', icon: FOOD_ART.plate },
  { id: 'breakfast', label: 'Breakfast', icon: FOOD_ART.breakfast, note: 'Breakfast items usually run out before noon.' },
  { id: 'items', label: 'Items', icon: FOOD_ART.lays },
  { id: 'drinks', label: 'Drinks', icon: FOOD_ART.cola },
  { id: 'sandwiches', label: 'Sandwiches', icon: FOOD_ART.sandwich },
  { id: 'handheld', label: 'Handheld', icon: FOOD_ART.pizza, note: 'From the food truck window.' },
  { id: 'plated', label: 'Plated', icon: FOOD_ART.cutlery },
  { id: 'produce', label: 'Fruit & Veg', icon: FOOD_ART.salad },
  { id: 'burgers', label: 'Burgers', icon: FOOD_ART.burger },
  { id: 'bowls', label: 'Bowls', icon: FOOD_ART.soup },
  { id: 'sides', label: 'Sides', icon: FOOD_ART.fries },
  { id: 'dessert', label: 'Dessert', icon: FOOD_ART.donut },
];

export const TAGS: { id: Tag | 'cheap'; label: string; icon?: ImageSourcePropType }[] = [
  { id: 'cheap', label: 'Under $5' },
  { id: 'popular', label: 'Popular', icon: FOOD_ART.star },
  { id: 'healthy', label: 'Healthy', icon: FOOD_ART.leafy },
  { id: 'gf', label: 'Gluten free' },
  { id: 'veg', label: 'Vegetarian', icon: FOOD_ART.veggie },
  { id: 'snack', label: 'Snack' },
  { id: 'meal', label: 'Meal' },
  { id: 'hot', label: 'Hot', icon: FOOD_ART.fire },
  { id: 'cold', label: 'Cold', icon: FOOD_ART.ice },
  { id: 'handheld', label: 'Handheld' },
  { id: 'plated', label: 'Plated' },
];

const A = FOOD_ART;
const m = (id: string, name: string, price: number | undefined, cats: MenuCategory[], icon: ImageSourcePropType, blurb: string, tags: Tag[], extra?: Partial<MenuItem>): MenuItem =>
  ({ id, name, price, cats, icon, blurb, tags, ...extra });
const CHIPS = 2.5;

export const MENU: MenuItem[] = [
  // ── Plated ──
  m('special', 'Daily Special', 10, ['plated'], A.special, 'Changes every day. Ask at the counter.', ['meal', 'hot', 'plated', 'popular']),

  // ── Breakfast + bakery ──
  m('wrap-bs', 'Breakfast Wrap, Bacon & Sausage', 7.5, ['breakfast'], A.wrapBaconSausage, 'Egg, cheese, bacon and sausage.', ['meal', 'hot', 'handheld', 'popular']),
  m('wrap-s', 'Breakfast Wrap, Sausage', 7.5, ['breakfast'], A.wrapSausage, 'Egg, cheese and sausage.', ['meal', 'hot', 'handheld']),
  m('wrap-e', 'Breakfast Wrap, Egg', 7.5, ['breakfast'], A.wrapEgg, 'Just egg and cheese.', ['meal', 'hot', 'handheld', 'veg']),
  m('bsand', 'Breakfast Sandwich', 6, ['breakfast', 'sandwiches'], A.breakfastSandwich, 'Egg and cheese on an English muffin.', ['meal', 'hot', 'handheld']),
  m('chocroissant', 'Chocolate Croissant', 4, ['breakfast', 'dessert'], A.croissantChoc, 'Buttery, flaky, chocolate inside.', ['snack', 'veg']),
  m('muffin', 'Muffin', 2.75, ['breakfast', 'dessert'], A.muffin, 'Flavour changes daily.', ['snack', 'veg']),
  m('scone', 'Scone', 3.5, ['breakfast', 'dessert'], A.scone, 'Fresh baked.', ['snack', 'veg']),
  m('cinnabun', 'Cinnamon Bun', 4, ['breakfast', 'dessert'], A.cinnamonBun, 'Swirled and iced.', ['snack', 'veg']),
  m('fritter', 'Apple Fritter', 3.5, ['breakfast', 'dessert'], A.appleFritter, 'Fried, glazed, apple chunks.', ['snack', 'veg']),
  m('parfait', 'Vanilla Yogurt, Granola & Fruit', 5, ['breakfast', 'produce'], A.parfait, 'Layered in a cup, from the cold case.', ['snack', 'cold', 'healthy', 'veg']),

  // ── Sandwiches + wraps (cold case unless it says grilled) ──
  m('hamturkey', 'Ham / Turkey Sandwich', 8, ['sandwiches'], A.hamTurkey, 'Ham or turkey, lettuce. From the cold case.', ['meal', 'cold', 'handheld']),
  m('chsalad', 'Chicken Salad Sandwich', 8, ['sandwiches'], A.chickenSalad, 'Creamy chicken salad, lettuce.', ['meal', 'cold', 'handheld']),
  m('eggsalad', 'Egg Salad', 8, ['sandwiches'], A.eggSalad, 'Creamy egg salad, from the cold case.', ['meal', 'cold', 'handheld', 'veg']),
  m('blt', 'BLT', 8, ['sandwiches'], A.blt, 'Bacon, lettuce, tomato.', ['meal', 'cold', 'handheld']),
  m('buffwrap', 'Buffalo Chicken Wrap', 8, ['sandwiches'], A.wrapBuffalo, 'Buffalo chicken, wrapped.', ['meal', 'cold', 'handheld']),
  m('caesarwrap', 'Chicken Caesar Wrap', 8, ['sandwiches'], A.wrapCaesar, 'Chicken, romaine, parmesan, Caesar.', ['meal', 'cold', 'handheld']),
  m('gcheese', 'Grilled Cheese', 5, ['sandwiches'], A.grilledCheese, 'Melty, golden, classic.', ['meal', 'hot', 'handheld', 'veg']),
  m('hamcheese', 'Grilled Ham & Cheese', 6, ['sandwiches'], A.grilledHamCheese, 'The grilled cheese, upgraded.', ['meal', 'hot', 'handheld']),

  // ── Handheld (food truck) ──
  m('pizzac', 'Cheese Pizza', 4.25, ['handheld'], A.pizzaCheese, 'One slice, cheese.', ['meal', 'hot', 'handheld', 'veg', 'popular']),
  m('pizzap', 'Pepperoni Pizza', 4.5, ['handheld'], A.pizza, 'One slice, pepperoni.', ['meal', 'hot', 'handheld', 'popular']),
  m('hotdog', 'Hot Dog', 5, ['handheld'], A.hotdog, 'Quick, cheap, done.', ['meal', 'hot', 'handheld']),
  m('cques', 'Cheese Quesadilla', 5.5, ['handheld', 'breakfast'], A.quesadillaCheese, 'Grilled tortilla, lots of cheese.', ['meal', 'hot', 'handheld', 'veg']),
  m('chques', 'Chicken Quesadilla', 6.5, ['handheld', 'breakfast'], A.quesadillaChicken, 'Cheese quesadilla plus chicken.', ['meal', 'hot', 'handheld']),
  m('pizzarolls', 'Pizza Rolls', undefined, ['handheld', 'sides'], A.pizzaRolls, 'Bite-size, hot.', ['snack', 'hot', 'handheld']),

  // ── Burgers ──
  m('beef', 'Beef Burger', 7, ['burgers'], A.burgerBeef, 'Grilled patty, lettuce, tomato.', ['meal', 'hot', 'handheld']),
  m('cheeseb', 'Cheese Burger', 7.5, ['burgers'], A.burgerCheese, 'Beef burger plus cheese.', ['meal', 'hot', 'handheld', 'popular']),
  m('baconb', 'Bacon Cheese Burger', 8, ['burgers'], A.burgerBacon, 'Cheese burger plus bacon. Big.', ['meal', 'hot', 'handheld']),
  m('chickb', 'Chicken Burger', 8, ['burgers'], A.burgerChicken, 'Crispy chicken instead of beef.', ['meal', 'hot', 'handheld']),
  m('veggieb', 'Veggie Burger', 8, ['burgers'], A.burgerVeggie, 'Plant patty, same fixings.', ['meal', 'hot', 'handheld', 'veg']),

  // ── Fruit & Veg ──
  m('fruitcup', 'Fruit Cup', 6, ['produce'], A.fruitCup, 'Fresh cut fruit.', ['snack', 'cold', 'healthy', 'veg', 'gf']),
  m('veggiecup', 'Veggie Cup', 4.25, ['produce'], A.veggieCup, 'Carrots, cucumber, dip.', ['snack', 'cold', 'healthy', 'veg', 'gf']),
  m('wholefruit', 'Whole Fruit', 2, ['produce'], A.wholeFruit, 'Ask what is in today.', ['snack', 'healthy', 'veg', 'gf']),
  m('chia', 'Chia Pudding', 5, ['produce'], A.chiaPudding, 'Blueberry or mango.', ['snack', 'cold', 'healthy', 'veg']),
  m('caesar', 'Caesar Salad with Chicken', 8, ['produce', 'bowls'], A.caesarSalad, 'Romaine, chicken, croutons, parmesan.', ['meal', 'cold', 'healthy']),
  m('southwest', 'Southwest Salad', 8, ['produce', 'bowls'], A.southwestSalad, 'Southwest-style salad.', ['meal', 'cold', 'healthy']),

  // ── Bowls ──
  m('pasta', 'Pasta', 6, ['bowls'], A.pasta, 'Sauce of the day.', ['meal', 'hot', 'veg']),
  m('pastasalad', 'Pasta Salad', 7.5, ['bowls'], A.pastaSalad, 'Cold pasta with veggies.', ['meal', 'cold']),
  m('soup1', 'Soup, Option A', 5, ['bowls'], A.soup, 'Two soups rotate daily. Ask which.', ['meal', 'hot']),
  m('soup2', 'Soup, Option B', 5, ['bowls'], A.pot, 'The other soup of the day.', ['meal', 'hot']),

  // ── Sides ──
  m('tenders', 'Chicken Tenders', 5.75, ['sides'], A.tenders, 'Crispy. Dip included.', ['snack', 'hot', 'popular', 'handheld']),
  m('fries', 'Fries', 4.5, ['sides'], A.fries, 'Hot and salty.', ['snack', 'hot', 'veg', 'popular']),
  m('tots', 'Tater Tots', 4.5, ['sides'], A.tots, 'Crispy outside, fluffy inside.', ['snack', 'hot', 'veg']),
  m('gyoza', 'Gyoza', 6, ['sides'], A.gyoza, 'Pan-fried dumplings.', ['snack', 'hot']),
  m('samosa', 'Samosa with Mango Chutney', 5, ['sides'], A.samosa, 'Spiced pastry, sweet chutney.', ['snack', 'hot', 'handheld']),
  m('perogies', 'Perogies', 5.25, ['sides'], A.perogies, 'Potato dumplings.', ['snack', 'hot']),
  m('pizzapretzel', 'Pizza Pretzel / Pizza Bagel', 4.5, ['sides', 'items'], A.pizzaPretzel, 'Sauce, cheese, pepperoni on a pretzel or bagel.', ['snack', 'handheld']),
  m('pepstick', 'Pepperoni Bread Stick', 4.5, ['sides', 'items'], A.pepperoniStick, 'Bread stick baked with pepperoni.', ['snack', 'handheld']),

  // ── Dessert ──
  m('brownie', 'Brownie', 4, ['dessert'], A.brownie, 'Fudgy. Gluten free.', ['snack', 'veg', 'gf', 'popular']),
  m('donut', 'Donut', 3.5, ['dessert'], A.donut, 'Assorted.', ['snack', 'veg']),
  m('cookie', 'Cookie', 1.75, ['dessert', 'items'], A.cookie, 'Big and soft.', ['snack', 'veg']),
  m('krispies', 'Rice Crispy Square', 4, ['items', 'dessert'], A.riceCrispy, 'Marshmallow, crispy.', ['snack', 'veg']),
  m('icecream', 'Ice Cream', 2.5, ['dessert'], A.iceCream, 'From the freezer.', ['snack', 'cold', 'veg']),

  // ── Items: chips (all $2.50), Pringles + popcorn ($2.75), counter extras ──
  m('doritos', 'Doritos Nacho Cheese', CHIPS, ['items'], A.doritos, 'Tortilla chips.', ['snack']),
  m('lays', "Lay's Classic", CHIPS, ['items'], A.lays, 'Plain potato chips.', ['snack', 'gf']),
  m('laysbbq', "Lay's BBQ", CHIPS, ['items'], A.laysBbq, 'Barbecue potato chips.', ['snack']),
  m('laysketchup', "Lay's Ketchup", CHIPS, ['items'], A.laysKetchup, 'The Canadian one.', ['snack']),
  m('mvjal', "Miss Vickie's Jalapeño", CHIPS, ['items'], A.mvJalapeno, 'Kettle chips, a bit spicy.', ['snack', 'gf']),
  m('mvsco', "Miss Vickie's Sour Cream, Herb & Onion", CHIPS, ['items'], A.mvSourCream, 'Kettle chips.', ['snack']),
  m('mvorig', "Miss Vickie's Original", CHIPS, ['items'], A.mvOriginal, 'Kettle chips, sea salt.', ['snack', 'gf']),
  m('mvvin', "Miss Vickie's Sea Salt & Malt Vinegar", CHIPS, ['items'], A.mvVinegar, 'Kettle chips, sour.', ['snack']),
  m('hickory', 'Hickory Sticks', CHIPS, ['items'], A.hickory, 'Smoky potato sticks.', ['snack', 'gf']),
  m('sunchips', 'Sun Chips Harvest Cheddar', CHIPS, ['items'], A.sunchips, 'Whole grain, ridged.', ['snack']),
  m('cheetos', 'Cheetos Puffs', CHIPS, ['items'], A.cheetos, 'Cheesy, puffy.', ['snack']),
  m('popcorn', 'Smartfood Popcorn', 2.75, ['items'], A.smartfood, 'White cheddar.', ['snack', 'gf']),
  m('pringles', 'Pringles', 2.75, ['items'], A.pringles, 'Once you pop.', ['snack']),
  m('gum', 'Gum', undefined, ['items'], A.gum, 'Assorted packs.', ['snack']),
  m('mints', 'Mints', undefined, ['items'], A.mints, 'Fresh breath before class.', ['snack']),
  m('halls', 'Halls', undefined, ['items'], A.halls, 'For scratchy throats.', ['snack']),

  // ── Drinks ──
  m('coffee', 'Coffee / Tea', 2.5, ['drinks'], A.coffeeTea, 'Cream and sugar at the counter.', ['hot']),
  m('specialty', 'French Vanilla / Hot Choc / Chai', 3.5, ['drinks'], A.hotDrink, 'Sweet, creamy, hot.', ['hot', 'popular']),
  m('icedcoffee', 'Iced Coffee', 4, ['drinks'], A.icedCoffee, 'Cold, sweet, caffeinated.', ['cold']),
  m('smoothie', 'Homemade Smoothie', 5, ['drinks'], A.smoothie, 'Made in house when they have it.', ['cold', 'healthy'], { sometimes: true }),
  m('canpop', 'Can Pop', 2.5, ['drinks'], A.canPop, 'Coke, Pepsi, Mountain Dew, Crush and more.', ['cold', 'popular']),
  m('bottlepop', 'Bottled Pop', 3.5, ['drinks'], A.bottledPop, 'The bigger bottle.', ['cold']),
  m('water', 'Bottled Water', 2.75, ['drinks'], A.water, 'Still water.', ['cold', 'healthy', 'gf', 'veg']),
  m('pellegrino', 'San Pellegrino / La Famiglia', 3.5, ['drinks'], A.pellegrino, 'Italian sparkling fruit soda.', ['cold']),
  m('juicecan', 'Oasis / Dole Can', 3, ['drinks'], A.juiceCan, 'Juice in a can.', ['cold']),
  m('gatorade', 'Gatorade', 3.5, ['drinks'], A.gatorade, 'Sports drink.', ['cold']),
  m('pureleaf', 'Pure Leaf', 4.5, ['drinks'], A.pureLeaf, 'Bottled iced tea.', ['cold']),
  m('milk2go', 'Milk To Go', 5.25, ['drinks'], A.milkToGo, 'Single-serve milk bottle.', ['cold', 'veg']),
  m('juicebox', 'Juice Box', 2, ['drinks'], A.juicebox, 'Small juice box.', ['cold']),
  m('snapple', 'Snapple', 3.75, ['drinks'], A.snapple, 'Juice drink, glass bottle.', ['cold']),
  m('sparkice', 'Sparkling Ice', 4.5, ['drinks'], A.sparklingIce, 'Flavoured sparkling water.', ['cold']),
];

export const priceLabel = (p: number) => `$${p.toFixed(2)}`;
export const inCategory = (item: MenuItem, cat: MenuCategory | 'all') => cat === 'all' || item.cats.includes(cat);
export const hasTag = (item: MenuItem, t: Tag | 'cheap') =>
  t === 'cheap' ? item.price !== undefined && item.price <= 5 : item.tags.includes(t);

// The menu with App Club Admin changes laid over it: a post with `itemId`
// changes that item (price, name, sold out, hidden, featured); one without
// adds a new item. `posts` = live menu posts in show order.
export type MenuPatch = {
  id: string; itemId?: string; name: string; price?: number | null; blurb: string; cats: MenuCategory[];
  art?: string; tags?: Tag[]; soldOut?: boolean; hidden?: boolean; featured?: boolean;
};
export const applyMenuPosts = (posts: MenuPatch[]): MenuItem[] => {
  const byItem = new Map(posts.filter(p => p.itemId).map(p => [p.itemId!, p]));
  const art = (k?: string) => (k ? (FOOD_ART as Record<string, ImageSourcePropType>)[k] : undefined);
  const changed = MENU.map(m => {
    const p = byItem.get(m.id);
    if (!p) return m;
    if (p.hidden) return null;
    return {
      ...m, name: p.name.trim() || m.name, blurb: p.blurb.trim() || m.blurb,
      price: p.price === null ? undefined : p.price ?? m.price,
      icon: art(p.art) || m.icon, tags: p.tags?.length ? p.tags : m.tags,
      soldOut: !!p.soldOut, featured: !!p.featured, postId: p.id,
    } as MenuItem;
  }).filter(Boolean) as MenuItem[];
  const added = posts.filter(p => !p.itemId && !p.hidden).map(p => ({
    id: `post-${p.id}`, name: p.name, price: p.price ?? undefined, cats: p.cats.length ? p.cats : ['plated'],
    icon: art(p.art) || FOOD_ART.plate, blurb: p.blurb, tags: p.tags || [], soldOut: !!p.soldOut, featured: !!p.featured, postId: p.id,
  } as MenuItem));
  return [...added, ...changed];
};
