## Usage

- Log in to TradeStation and get your historicalorders data from the network tab, and paste it into the orders.json file (overwrite whatever is in there already)
- Next, grab the symbols data from the network tab as well, and paste that into the symbols.json file.
- run `node getGains.js` from the root of this project, then check the output in the output folder
- from the client center login, grab your trade csv files and put them in `input/orders.csc` and optionally another one in `input/orders2.csv`, then run the script(s) that youd like against them.

## NOTES

- The script currently only adds up futures trades, stocks and options will be ignored
- The data from the TradeStation network tab seems to be the past 5 weeks or so of data. Anything beyond that won't show up.
