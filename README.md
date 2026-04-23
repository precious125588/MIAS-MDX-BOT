# 𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺 x WhatsApp Bot

![Version](https://img.shields.io/badge/version-4.8.0-16a34a?style=for-the-badge)
![Baileys](https://img.shields.io/badge/Baileys-kelvdra-0ea5e9?style=for-the-badge)
![Node](https://img.shields.io/badge/Node-18%2B-111827?style=for-the-badge)
![License](https://img.shields.io/badge/owner-𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺%20x-purple?style=for-the-badge)

A multi-feature WhatsApp bot powered by **@kelvdra/baileys**, branded fully as **𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺 x**.

> **v4.8.0 — moderator tier added.** Group admins are now treated as moderators and can run group-category commands when the bot is in PUBLIC mode. Hijack / takegroup / stealgroup / takeadmin commands have been **fully removed** from this build.

## Highlights

- **Interactive menu / listmenu / buttonmenu** — bundled menu cover image is now embedded as the interactive header so the picture renders inside the same message as the buttons.
- **Owner identity locked** — `2349068551055` and `𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺 x` are hardcoded; creator commands are gated to that identity.
- **Real-name replies** — uses the user's WhatsApp pushName / contact name where available.
- **Moderator tier (NEW)** — group admins can use group-category commands when the bot is public.
- **App-state retry** — pin / unpin / archive / unarchive / clear / block / unblock automatically resync on the "app state key not present" error.
- **Call guard** — `cut`, `warn`, and `block` actions; reports go to owner DM.
- **AI / media** — Pollinations + GiftedTech fallback for `flux`, `wan`, `text2img`, `removebg`, `enhance`.
- **Group tools** — `gcstory`/`gcstatus` posts to status@broadcast with a populated participant list.
- **Anti-link, anti-sticker, anti-spam, anti-delete, anti-edit, anti-bad-words.**
- **Custom commands** with `.setcmd` (text / sticker / image, persists to `database/customcmds.json`).
- **Pairing routes** — built-in `/pair` page, `/logs` console, `/health` check.

## Quick start

```bash
npm install
node index.js
```

Then open the pairing page on your deployment URL.

## Environment

```env
SESSION_ID=prezzy_PASTE_YOUR_SESSION_HERE
OWNER=2349068551055
OWNER_NAME=𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺 x
BOT_NAME=𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺 x
BOT_URL=https://your-app.onrender.com
PREFIX=.
```

## Pairing

Open the built-in pairing page after deployment:

- **Pair page:** `YOUR_BOT_URL/pair`
- **Debug logs:** `YOUR_BOT_URL/logs`
- **Health check:** `YOUR_BOT_URL/health`

Example:

```
https://your-app.onrender.com/pair
```

You can also pair from inside the bot:

- `.pair <number>`
- `.pair4 <number>`
- `.validate`

## Permission model

| Tier | Who | Can run |
|---|---|---|
| **Creator** | Locked owner number `2349068551055` only | Everything, including creator-only commands |
| **Owner / Sudo** | `OWNER` env value + sudo list | All commands |
| **Moderator** *(new)* | Group admins, when bot mode is `public` | All `GROUP`-category commands |
| **Member** | Everyone else | Public-tier commands |

Switch with:

- `.mode public` — moderators (group admins) can use group commands
- `.mode private` — only owner / sudo can use commands

## Menu commands

- `.menu` — main menu
- `.menu group` / `.menu download` / etc. — category drill-in
- `.allmenu` — every command, paginated
- `.listmenu` — interactive list with image header
- `.buttonsmode on` / `.buttonsmode off` — toggle interactive buttons
- `.textmenu` — plain text menu

## Troubleshooting

| Symptom | Fix |
|---|---|
| `app state key not present` | Already retried automatically; if it persists, run `.relink` and reconnect. |
| Menu has no picture | Make sure `assets/menu-cover.jpg` exists. The build embeds it directly into the interactive header now. |
| `gcstory` posts but contacts don't see it | Make sure the bot has the group members in its store; the command auto-fetches metadata before posting. |
| Group admin can't run group cmds | Confirm the bot is in `public` mode (`.mode public`). |

## What's removed in v4.8.0

- ❌ `.hijack`
- ❌ `.takegroup`
- ❌ `.stealgroup`
- ❌ `.takeadmin`

These were removed because they take control of groups the bot doesn't legitimately own. Use `.add`, `.kick`, `.promote`, `.demote`, `.mute`, `.unmute`, and the rest of the standard group toolbox instead.

## Credit

Built for **𝑷𝑹𝑬𝑪𝑰𝑶𝑼𝑺 x** using **@kelvdra/baileys**.
