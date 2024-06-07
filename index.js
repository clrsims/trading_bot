import makeBot from 'atlas-trading-api';


function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function getOpenOrders(bot, market) {
  const data = await bot.getMarketData(market);
  const myBids = data.bids.filter(order => order.user === bot.id);
  const myOffers = data.offers.filter(order => order.user === bot.id);
  return { myBids, myOffers };
}


async function runMarketMaker(bot, market, prior, spread, fade, size) {
  // In case the bot was already running, clear out any existing orders.
  await bot.out(market)

  // This is a helper function that picks a 'fair price' based on the current exposure.
  async function getFair() {
    const portfolio = await bot.getPortfolio();
    let exposure = 0;
    if (market in portfolio.contracts) {
      exposure = portfolio.contracts[market].exposure
    }
    return prior - exposure*fade;
  }

  // Keep track of the length of the trade log so that we know when new trades happen.
  let lastLength = (await bot.getMarketData(market)).trades.length;

  { // Place some initial orders on the market
    const fair = await getFair();
    await bot.placeOrder(market, 'bid', fair - spread/2, size);
    await bot.placeOrder(market, 'offer', fair + spread/2, size);
  }

  while(true) {
    const data = await bot.getMarketData(market);

    // In order to keep the bot simple, we'll reset our orders whenever a new trade happens.
    if(data.trades.length > lastLength) { 
      lastLength = data.trades.length;
      await bot.out(market)
      const fair = await getFair();
  
      await bot.placeOrder(market, 'bid', fair - spread/2, size);
      await bot.placeOrder(market, 'offer', fair + spread/2, size);
    } else {
      // No new trades have occurred; wait to check again in 10 seconds.
      // We need to sleep here to avoid spamming the server with requests.
      await sleep(10000); 
    }
    
  }
}

/*
  This bot randomly trades with either the best bid or best offer.
*/
async function runNaive(bot, market, lossPerTrade, secondsPerTrade) {
  // In case the bot was already running, clear out any existing orders.
  await bot.out(market);

  while(true) {
    // Generate random numbers so that the bot trades unpredictably, but on
    // average the bot will trade once every `secondsPerTrade` seconds.
    if(Math.random() < 1/(secondsPerTrade)) {

      const data = await bot.getMarketData(market);
      // The bot will only trade if there are orders on both sides of the market.
      if("bids" in data && "offers" in data && data.bids.length > 0 && data.offers.length > 0) {
        const spread = data.offers[0].price - data.bids[0].price;

        // Calculate the maximum size the bot is willing to trade at, given
        // we want to lose `lossPerTrade` clips per trade on average.
        const availableSize = Math.min(data.bids[0].size, data.offers[0].size);
        const desiredSize = lossPerTrade*2 / spread;
        const size = Math.min(availableSize, desiredSize);

        console.log(`[${bot.name}] ${market}: Found spread ${spread}, using size ${size}.`);

        // The bot will randomly choose whether to buy or sell.
        if(Math.random() < 0.5) {
          await bot.placeOrder(market, 'bid', data.offers[0].price, size);
        } else {
          await bot.placeOrder(market, 'offer', data.bids[0].price, size);
        }
        await bot.out(market);
      }
    }
    
    await sleep(1000);
  }
}


async function runMyBot(bot) {
  console.log(`[${bot.name}] Starting bot...`);

  // Clear out any existing orders.
  await bot.out('bond');

  const data = await bot.getMarketData('bond');
  let best_bid = (data.bids[0]?.price ?? data.min); // Increment best bid by 1
  let best_offer = (data.offers[0]?.price ?? data.max); // Decrement best offer by 1

  // Auto buy if the best bid is above 1000
  if (best_bid > 1000) {
    console.log(`[${bot.name}] Auto buying because best_bid ${best_bid} is above 1000.`);
    await bot.placeOrder('bond', 'bid', best_bid, .1); // Buy 1 contract at best_bid
  }

  // Auto buy if the best offer is below 1000
  if (best_offer < 1000) {
    console.log(`[${bot.name}] Auto buying because best_offer ${best_offer} is below 1000.`);
    await bot.placeOrder('bond', 'bid', best_offer, .1); // Buy 1 contract at best_offer
  }

  // Ensure the bid does not exceed 1000 and the offer does not go below 1000.
  const adjusted_bid = Math.min(best_bid, 1000);
  const adjusted_offer = Math.max(best_offer, 1000);

  // // Place adjusted orders
  // if (best_bid <= 1000) {
  //   await bot.placeOrder('bond', 'bid', adjusted_bid, 0.01); // Bid for 1 contract
  // }
  if (best_offer >= 1000) {
    await bot.placeOrder('bond', 'offer', adjusted_offer, 2); // Offer 1 contract
  }
  
  await bot.out('etf');

  // Retrieve current prices for A, B, C, and ETF.
  const aData = await bot.getMarketData('a');
  const bData = await bot.getMarketData('b');
  const cData = await bot.getMarketData('c');
  const etfData = await bot.getMarketData('etf');
  
  const aPrice = aData.currentPrice;
  const bPrice = bData.currentPrice;
  const cPrice = cData.currentPrice;
  const etfPrice = etfData.currentPrice;
  
  const sumABC = aPrice + bPrice + cPrice;
  
  if (etfPrice < sumABC) {
    // ETF is undervalued: buy ETF and redeem for A, B, and C
    console.log(`[${bot.name}] ETF undervalued. Buying ETF at ${etfPrice} and redeeming.`);
    await bot.placeOrder('etf', 'bid', etfPrice, 0.001); // Adjust size if necessary
    await bot.redeem(0.001); // Redeem the bought ETF shares
  } else if (etfPrice > sumABC) {
    // ETF is overvalued: buy A, B, and C and convert to ETF
    console.log(`[${bot.name}] ETF overvalued. Buying A, B, and C at ${aPrice}, ${bPrice}, ${cPrice} and converting to ETF.`);
    await bot.placeOrder('a', 'bid', aPrice, 0.001); // Adjust size if necessary
    await bot.placeOrder('b', 'bid', bPrice, 0.001); // Adjust size if necessary
    await bot.placeOrder('c', 'bid', cPrice, 0.001); // Adjust size if necessary
    await bot.redeem(-0.001); // Convert to ETF
  
  }
}


// ** Make sure to change the password in the line below! **
const PASSWORD = "csNGNG1156";
if(PASSWORD === "") throw new Error("Make sure to set your bot's password in index.js.")

const first_bot = makeBot('https://atlas-eclips-bot.herokuapp.com', '1247658526004875374', PASSWORD, 'first_bot');
runMyBot(first_bot);