# trading_bot
Engineered a trading bot that analyzes for arbitrage in mock financial markets using the Atlas Trading API.

Check documentation for rules of financial market.

Employs two different arbitrage strategies:

1.

  Place limit orders significantly away from the current market price.
  For instance, if the market is trading around 900, place bids around 800 and offers around 1100.
  As the bot and customers randomly trade, my orders may get filled at advantageous prices, allowing ne to profit when the market eventually moves    toward the resolution price of 1000.

2. 

When ETF Price < Sum of A, B, and C:
  Action: Buy ETF shares and redeem them into 0.99 shares of A, B, and C.
  Result: Sell the 0.99 shares of A, B, and C at market value to profit from the difference.
When ETF Price > Sum of A, B, and C:
  Action: Buy 1 share each of A, B, and C and convert them into 0.99 ETF shares.
  Result: Sell the ETF shares at market value to profit from the difference.

Example:

If the ETF is trading at 350, and A, B, and C are trading at 120 each:
Sum of A, B, and C: 120 + 120 + 120 = 360.
ETF Price: 350.
Arbitrage: Buy ETF at 350, redeem for 0.99 * 3 shares of A, B, and C, and sell them for 356.4 (approx), making a profit.
