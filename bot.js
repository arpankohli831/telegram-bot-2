import { Telegraf, Markup } from "telegraf";
import sqlite3 from "sqlite3";
import {
  BOT_TOKEN,
  ADMIN_ID,
  UPI_ID,
  QR_IMAGE,
  REF_BONUS,
  CHANNEL_LINK,
  OWNER_USERNAME
} from "./config.js";

// ================= BOT INIT =================
const bot = new Telegraf(BOT_TOKEN);
const db = new sqlite3.Database("database.db");

// ================= DATABASE =================
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    balance REAL DEFAULT 0,
    referred_by INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS stocks (
    name TEXT,
    price INTEGER,
    qty INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS promocodes (
    code TEXT PRIMARY KEY,
    amount INTEGER,
    used INTEGER DEFAULT 0
  )`);
});

// ================= MAIN MENU =================
const menu = Markup.keyboard([
  ["🟢 ADD FUNDS"],
  ["🔵 FACEBOOK ₹25", "🔵 GOOGLE ₹25"],
  ["🔵 TWITTER ₹25", "🔵 GUEST ₹20"],
  ["🟡 STOCK", "🟡 MY BALANCE"],
  ["🟣 PROMO CODE", "🟣 REFER & EARN"],
  ["⭐ PAID PUSH ⭐", "🔗 CHANNEL"],
  ["⚫ CONTACT OWNER"]
]).resize();

// ================= START =================
bot.start((ctx) => {
  const userId = ctx.from.id;
  const ref = ctx.startPayload || null;

  db.get("SELECT user_id FROM users WHERE user_id = ?", [userId], (err, row) => {
    if (!row) {
      db.run(
        "INSERT INTO users (user_id, balance, referred_by) VALUES (?,?,?)",
        [userId, 0, ref]
      );

      if (ref && ref != userId) {
        db.run(
          "UPDATE users SET balance = balance + ? WHERE user_id = ?",
          [REF_BONUS, ref]
        );
      }
    }
  });

  ctx.reply("✅ Bot Activated Successfully", menu);
});

// ================= ADD FUNDS =================
bot.hears("🟢 ADD FUNDS", (ctx) => {
  ctx.replyWithPhoto(QR_IMAGE, {
    caption: `💳 *Add Funds*\n\nUPI ID: \`${UPI_ID}\`\n\nSend UTR or Screenshot here.`,
    parse_mode: "Markdown"
  });
});

// ================= AUTO FORWARD PAYMENT =================
bot.on(["photo", "text"], (ctx) => {
  if (
    ctx.chat.type !== "private" ||
    ctx.from.id === ADMIN_ID ||
    ctx.message.text?.startsWith("/")
  ) return;

  ctx.forwardMessage(ADMIN_ID);
  ctx.reply("✅ Sent to admin for approval");
});

// ================= ADMIN APPROVE =================
bot.command("approve", (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const [, userId, amount] = ctx.message.text.split(" ");
  db.run(
    "UPDATE users SET balance = balance + ? WHERE user_id = ?",
    [amount, userId]
  );
  ctx.reply("✅ Payment Approved");
});

// ================= BALANCE =================
bot.hears("🟡 MY BALANCE", (ctx) => {
  db.get(
    "SELECT balance FROM users WHERE user_id = ?",
    [ctx.from.id],
    (err, row) => {
      ctx.reply(`💰 Your Balance: ₹${row?.balance || 0}`);
    }
  );
});

// ================= PROMO CODE =================
bot.hears("🟣 PROMO CODE", (ctx) => {
  ctx.reply("🎁 Send your promo code:");
});

bot.on("text", (ctx) => {
  const code = ctx.message.text;

  db.get(
    "SELECT amount, used FROM promocodes WHERE code = ?",
    [code],
    (err, row) => {
      if (row && row.used === 0) {
        db.run("UPDATE promocodes SET used = 1 WHERE code = ?", [code]);
        db.run(
          "UPDATE users SET balance = balance + ? WHERE user_id = ?",
          [row.amount, ctx.from.id]
        );
        ctx.reply("✅ Promo code applied");
      }
    }
  );
});

// ================= ADMIN PROMO =================
bot.command("addpromo", (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const [, code, amount] = ctx.message.text.split(" ");
  db.run("INSERT INTO promocodes VALUES (?,?,0)", [code, amount]);
  ctx.reply("✅ Promo Created");
});

// ================= STOCK =================
bot.hears("🟡 STOCK", (ctx) => {
  db.all("SELECT * FROM stocks", [], (err, rows) => {
    let msg = "📦 Available Stocks\n\n";
    rows.forEach((s) => {
      msg += `${s.name} — ₹${s.price} — Qty: ${s.qty}\n`;
    });
    ctx.reply(msg || "No stock available");
  });
});

// ================= ADMIN STOCK =================
bot.command("addstock", (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const [, name, price, qty] = ctx.message.text.split(" ");
  db.run("INSERT INTO stocks VALUES (?,?,?)", [name, price, qty]);
  ctx.reply("✅ Stock Added");
});

/// ================= PAID PUSH =================
bot.hears("⭐ PAID PUSH ⭐", (ctx) => {
  ctx.reply(
    "⭐ *Paid Push*\n\n⭐ 1 STAR — ₹2\n⭐⭐ 10 STAR — ₹20\n⭐⭐⭐ 25 STAR — ₹50",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          {
            text: "📩 Buy Paid Push",
            url: `https://t.me/${OWNER_USERNAME}`
          }
        ]
      }
    }
  );
});

// ================= CHANNEL =================
bot.hears("🔗 CHANNEL", (ctx) => {
  ctx.reply(
    "📢 Join our official channel",
    {
      reply_markup: {
        inline_keyboard: [
          {
            text: "🔗 Join Channel",
            url: CHANNEL_LINK
          }
        ]
      }
    }
  );
});

// ================= CONTACT OWNER =================
bot.hears("⚫ CONTACT OWNER", (ctx) => {
  ctx.reply(
    "👤 Owner: @ARPANMODX",
    {
      reply_markup: {
        inline_keyboard: [
          {
            text: "📩 Contact Owner",
            url: "https://t.me/ARPANMODX"
          }
        ]
      }
    }
  );
});

// ================= BOT START =================
bot.launch();
console.log("🤖 Bot is running...");

// SAFE STOP
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));