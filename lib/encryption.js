// encryption.js — AES-256-GCM with PBKDF2 key derivation

const crypto = require('crypto');

const ALG = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 12;
const SALT_LEN = 16;
const ITERS = 100_000;

function deriveKey(passphrase, salt) {
  return crypto.pbkdf2Sync(passphrase, salt, ITERS, KEY_LEN, 'sha512');
}

function encrypt(plaintext, passphrase) {
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = deriveKey(passphrase, salt);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return JSON.stringify({
    iv: iv.toString('hex'),
    salt: salt.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    data: enc.toString('hex'),
  });
}

function decrypt(json, passphrase) {
  const { iv, salt, tag, data } = JSON.parse(json);
  const key = deriveKey(passphrase, Buffer.from(salt, 'hex'));
  const decipher = crypto.createDecipheriv(ALG, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString('utf8');
}

if (require.main === module) {
  const pass = 'test';
  const data = '{"test":true}';
  const enc = encrypt(data, pass);
  console.log('Round-trip:', decrypt(enc, pass) === data ? 'PASS' : 'FAIL');
  try { decrypt(enc, 'wrong'); } catch { console.log('Wrong key rejected: PASS'); }
}

module.exports = { encrypt, decrypt };
