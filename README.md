# trading212-ark-pie-builder

## Description
The purpose of this app is to fetch the current list of shares
held in an ARK ETF as well as the current list of shares offered
by trading212 in their ISA wrapper.

It will then go through the list of ARK shares, remove any that
aren't available on trading212 and roughly rebalance the remaining
shares.

Note this 'rebalance' is rather crude by proportioning the missing
weight % and equally distributing it to all the remaining shares. This
may be a little buggy and be off by a fraction of a percent, so if that's the
case for you just remove some weight from whichever shares you want
to make the total pie equal 100%
 
## Prereqs
- Node installed (13.14+)

## How to use
- Type `npm install`
- Open up `config.js` and change the `arkCode` value to 
be whatever etf you wish to run this for (it should work for all
5 but must be done 1 at a time)
- Type `node app.js`