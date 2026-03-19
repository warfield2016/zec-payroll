# ZEC Payroll

Shielded payroll for digital work. Import a CSV of recipients, convert USD amounts to ZEC at the live rate, and generate ZIP-321 multi-payment URIs as scannable QR codes for Zodl.

Built for the Zypherpunk hackathon. Privacy-first, shielded-by-default.

## What it does

- **CSV import** or manual entry of recipients (name, shielded address, amount, currency)
- **Live ZEC/USD conversion** via CoinGecko at batch generation time
- **ZIP-321 URI generation** per the [spec](https://zips.z.cash/zip-0321), with multi-payment support
- **QR codes** sized for Zodl scanning, auto-split for large batches (15 recipients per QR)
- **Test batch mode** sends 0.001 ZEC per recipient to verify addresses before full payout
- **E2E encrypted storage** (AES-256-GCM, PBKDF2 key derivation) with a passphrase you set on first run
- **Bi-weekly schedule tracking** with overdue alerts
- **Privacy shield mode** blurs all sensitive data (names, addresses, amounts, QR codes) with one click
- **Dark/light theme** respects system preference, persists across sessions

## Shielded by default

Transparent addresses (`t1`, `t3`) are rejected. Only shielded Sapling (`zs1`) and Unified (`u1`) addresses are accepted. The encrypted data file never touches the network.

## Run it

```
npm install
npm start
```

Open `http://localhost:3001`, set a passphrase, import `sample.csv` or add recipients manually.

## Stack

Node.js, Express, EJS. No frontend framework. QR generation via `qrcode`, CSV parsing via `csv-parse`, encryption via Node's built-in `crypto`. CoinGecko free API for price data.

## How it works

1. Unlock with your passphrase (decrypts the local data file, or creates one on first use)
2. Add recipients manually or import a CSV (`name, wallet_address, amount, currency`)
3. Click "New Batch" to preview the payout with live ZEC prices
4. Click "Generate" to build the ZIP-321 URI and render the QR code
5. Scan with Zodl to sign and broadcast
6. Mark the batch as sent to update the payout schedule

## File structure

```
lib/
  zip321.js       ZIP-321 URI builder (the core)
  encryption.js   AES-256-GCM encrypt/decrypt
  price.js        CoinGecko ZEC/USD with caching
  csv.js          CSV parsing and validation
server.js         Express routes
views/            EJS templates
public/           CSS + client JS
sample.csv        Example payroll file
data/             Encrypted data (gitignored)
```

## License

MIT
