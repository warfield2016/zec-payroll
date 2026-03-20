# ZEC Payroll

Shielded payroll for paying people who do digital work. You keep a list of recipients with their Zcash addresses and pay amounts. When payday comes, the app builds a single payment link that your wallet can read. You scan it, confirm, and everyone gets paid.

Built for the Zypherpunk hackathon. Privacy-first, shielded-by-default.

## What it does

You upload a CSV (or type in recipients manually) with names, shielded Zcash addresses, and how much each person gets. The app converts any USD amounts to ZEC at the current exchange rate, then generates a ZIP-321 payment URI — a standardized format that Zcash wallets understand. It shows up as a QR code you scan with Zodl or Zashi.

The whole point is to make recurring crypto payroll as simple as running a bank transfer, without leaking any metadata.

## Features

- **CSV import** — drop in a spreadsheet instead of typing addresses one by one
- **Live ZEC/USD conversion** — people can be paid in USD terms, converted at the current rate
- **ZIP-321 URIs** — follows the [actual spec](https://zips.z.cash/zip-0321), handles multi-payment batches
- **QR codes** — auto-split into groups of 15 if you have a large roster
- **Test mode** — sends 0.001 ZEC to everyone first so you know the addresses work
- **Encrypted storage** — AES-256-GCM with a passphrase you choose, nothing stored in plaintext
- **Telegram notifications** — get pinged when a batch is sent or when payday is coming up
- **Live price ticker** — current ZEC/USD in the nav bar, updates every 60 seconds
- **Privacy shield** — blurs all names, addresses, amounts, and QR codes with one click
- **Dark and light mode** — follows your system setting, remembers your pick
- **Payout scheduling** — weekly, biweekly, or monthly with countdown on the dashboard

## Shielded only

Transparent addresses (`t1`, `t3`) are rejected outright. Only shielded Sapling (`zs1`) and Unified (`u1`) addresses are accepted. The encrypted data file stays on disk and never touches the network.

## Run it

```
npm install
npm start
```

Opens at `http://localhost:3001`. Set a passphrase on first run, then import `sample.csv` or add people manually.

## How to use it

1. Unlock with your passphrase (creates a fresh encrypted data file on first use)
2. Add recipients — type them in or import a CSV with columns: `name, wallet_address, amount, currency`
3. Hit "New Batch" to preview the payout with live ZEC prices
4. Hit "Generate" to build the payment URI and QR code
5. Scan with Zodl to sign and broadcast the transaction
6. Mark the batch as sent — the app sets the next payout date automatically

## Telegram setup (optional)

1. Message `@BotFather` on Telegram, create a bot, grab the token
2. Send any message to your bot, then visit `https://api.telegram.org/bot{TOKEN}/getUpdates` to find your chat ID
3. Go to Settings in the app, paste both values, hit Save
4. You'll get a notification when a batch is marked as sent, and a reminder when the next payout is within 2 days

## Stack

Node.js, Express, EJS. No frontend framework, no build step. QR generation via `qrcode`, CSV parsing via `csv-parse`, encryption via Node's built-in `crypto`. CoinGecko free API for price data. Telegram Bot API for notifications.

## File structure

```
lib/
  zip321.js       ZIP-321 URI builder (the core)
  encryption.js   AES-256-GCM encrypt/decrypt
  price.js        CoinGecko ZEC/USD with 60s cache
  csv.js          CSV parsing and validation
  telegram.js     Telegram Bot API notifications
server.js         Express routes and app logic
views/            EJS templates (dashboard, recipients, batch, settings, etc.)
public/           CSS + client-side JS (theme, shield, price ticker)
sample.csv        Example payroll file
data/             Encrypted data (gitignored)
```

## Deploy

Works on Render, Railway, or any Node host. Set the `PORT` env variable (the app reads it automatically). Note that Render's free tier uses ephemeral storage — your encrypted data file resets on each deploy. For persistence, attach a disk or use a database.

## License

MIT
