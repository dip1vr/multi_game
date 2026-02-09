from pyrogram import Client, filters
from pyrogram.enums import ParseMode
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from utils import is_admin
import global_state
import database
from config import DATA_DIR
import json
import logging
import os
import re
import html

@Client.on_message(filters.command("acast") & filters.create(lambda _, __, m: is_admin(m.from_user.id)))
async def acast_cmd(c, m):
    if len(m.command) < 2: return await m.reply("Usage: /acast <message>")
    msg = m.text.split(maxsplit=1)[1]
    sent, failed = 0, 0
    await m.reply("📡 Sending broadcast...")
    chats = database.load_id_set(database.CHATS_FILE)
    for chat_id in chats:
        try:
            await c.send_message(chat_id, f"📢 <b>Broadcast</b>\n\n{msg}", parse_mode=ParseMode.HTML)
            sent += 1
        except: failed += 1
    await m.reply(f"✅ Sent: {sent} | ❌ Failed: {failed}")

@Client.on_message(filters.command("add") & filters.create(lambda _, __, m: is_admin(m.from_user.id)))
async def add_char_cmd(c, m):
    lines = m.text.split('\n')
    if len(lines) < 11:
        return await m.reply("❌ Invalid format. See guide.")
    
    try:
        char_name = lines[0].split(maxsplit=1)[1].strip()
        anime_name = lines[1].strip()
        img_url = lines[2].strip()
        
        # Stats parsing
        stats = {
            "captain": int(lines[3]), "vice_captain": int(lines[4]),
            "tank": int(lines[5]), "healer": int(lines[6]),
            "assassin": int(lines[7]), "support": int(lines[8]),
            "traitor": int(lines[10]) # Skipping support 2 for brevity in example, ensure indices match your input
        }

        char_doc = {"name": char_name, "series": anime_name, "img": img_url, "stats": stats}
        
        # Update Memory
        unique_id = f"{char_name} | {anime_name}"
        global_state.CHAR_STATS[unique_id] = stats
        global_state.CHAR_IMAGES[unique_id] = img_url
        if char_name not in global_state.ANIME_CHARACTERS: global_state.ANIME_CHARACTERS.append(char_name)
        
        norm = re.sub(r'[^a-z0-9]', '', anime_name.lower())
        global_state.SERIES_MAP.setdefault(norm, []).append(unique_id)
        global_state.SERIES_DISPLAY[norm] = anime_name

        # Save to DB/File
        if database.USE_MONGO:
            database.COL_CHARACTERS.update_one({"name": char_name}, {"$set": char_doc}, upsert=True)
        else:
            data = []
            if os.path.exists(database.CHARACTERS_FILE):
                with open(database.CHARACTERS_FILE, 'r') as f: data = json.load(f)
            data.append(char_doc)
            with open(database.CHARACTERS_FILE, 'w') as f: json.dump(data, f)
            
        await m.reply(f"✅ Added <b>{char_name}</b> from {anime_name}!", parse_mode=ParseMode.HTML)
    except Exception as e:
        await m.reply(f"❌ Error: {e}")

@Client.on_message(filters.command("addpoints") & filters.create(lambda _, __, m: is_admin(m.from_user.id)))
async def addpoints_cmd(c, m):
    try:
        _, uid, pts = m.text.split()
        uid, pts = int(uid), int(pts)
        stats = database.get_user_stats(uid)
        stats["rating"] = max(0, stats.get("rating", 1200) + pts)
        database.save_user_stats(uid, stats)
        await m.reply(f"✅ Added {pts} points to user {uid}.")
    except: await m.reply("Usage: /addpoints <uid> <points>")

@Client.on_message(filters.command("newyear") & filters.create(lambda _, __, m: is_admin(m.from_user.id)))
async def newyear_cmd(c, m):
    arg = m.text.split()[1].lower() if len(m.text.split()) > 1 else ""
    if arg in ("on", "true", "yes"):
        global_state.NEW_YEAR_EVENT = True
        await m.reply("✅ New Year Event: ON")
    else:
        global_state.NEW_YEAR_EVENT = False
        await m.reply("❌ New Year Event: OFF")
    
    with open(database.EVENT_FLAGS_FILE, "w") as f:
        json.dump({"NEW_YEAR_EVENT": global_state.NEW_YEAR_EVENT}, f)

@Client.on_message(filters.command("comicimg") & filters.create(lambda _, __, m: is_admin(m.from_user.id)))
async def comicimg_cmd(c, m):
    """Update character image: /comicimg "url" "name" "series name" """
    try:
        parts = m.text.split('"')
        if len(parts) < 6:
            return await m.reply('Usage: /comicimg "url" "name" "series name"')
        
        img_url = parts[1]
        char_name = parts[3]
        series_name = parts[5]
        
        unique_id = f"{char_name} | Marvel"
        global_state.CHAR_IMAGES[unique_id] = img_url
        
        # Update in stats database too if character exists
        if unique_id in global_state.CHAR_STATS:
            if database.USE_MONGO and database.COL_CHARACTERS:
                database.COL_CHARACTERS.update_one({"name": char_name, "series": series_name}, {"$set": {"img": img_url}}, upsert=False)
            else:
                marvel_file = os.path.join(DATA_DIR, "marvel.json")
                if os.path.exists(marvel_file):
                    with open(marvel_file, 'r') as f: data = json.load(f)
                    for char in data:
                        if char.get("name") == char_name and char.get("series") == series_name:
                            char["img"] = img_url
                            break
                    with open(marvel_file, 'w') as f: json.dump(data, f)
        
        await m.reply(f"✅ Updated image for <b>{char_name}</b>", parse_mode=ParseMode.HTML)
    except Exception as e:
        await m.reply(f"❌ Error: {e}")

@Client.on_message(filters.command("add_comic") & filters.create(lambda _, __, m: is_admin(m.from_user.id)))
async def add_comic_cmd(c, m):
    """Add Marvel character: /add_comic <name> <series> <img_url> <captain> <genius> <powerhouse> <mystic> <street_level> <cosmic> <trickster> <herald>"""
    lines = m.text.split('\n')
    if len(lines) < 11:
        return await m.reply("❌ Invalid format. Expected 11 lines (name, series, url, then 8 stats).")
    
    try:
        char_name = lines[0].split(maxsplit=1)[1].strip()
        series_name = lines[1].strip()
        img_url = lines[2].strip()
        
        # Marvel stats
        stats = {
            "paragon": int(lines[3]),
            "genius": int(lines[4]),
            "powerhouse": int(lines[5]),
            "mystic": int(lines[6]),
            "street_level": int(lines[7]),
            "cosmic": int(lines[8]),
            "trickster": int(lines[9]),
            "herald": int(lines[10])
        }

        char_doc = {"name": char_name, "series": series_name, "img": img_url, "stats": stats}
        
        # Update Memory
        unique_id = f"{char_name} | Marvel"
        global_state.CHAR_STATS[unique_id] = stats
        global_state.CHAR_IMAGES[unique_id] = img_url
        global_state.MARVEL_CHARACTERS.append(unique_id)
        
        # Update series maps
        norm = re.sub(r'[^a-z0-9]', '', series_name.lower())
        global_state.MARVEL_SERIES_MAP.setdefault(norm, []).append(unique_id)
        global_state.MARVEL_SERIES_DISPLAY[norm] = series_name

        # Save to DB/File
        if database.USE_MONGO and database.COL_CHARACTERS:
            database.COL_CHARACTERS.insert_one(char_doc)
        else:
            marvel_file = os.path.join(DATA_DIR, "marvel.json")
            data = []
            if os.path.exists(marvel_file):
                with open(marvel_file, 'r') as f: data = json.load(f)
            data.append(char_doc)
            with open(marvel_file, 'w') as f: json.dump(data, f)
            
        await m.reply(f"✅ Added <b>{char_name}</b> from {series_name}!", parse_mode=ParseMode.HTML)
    except Exception as e:
        await m.reply(f"❌ Error: {e}")

@Client.on_message(filters.command("characters") & filters.create(lambda _, __, m: is_admin(m.from_user.id)))
async def characters_cmd(c, m):
    """Show all characters with toggle between anime/comics - admin only"""
    mode = "anime"
    if len(m.text.split()) > 1 and m.text.split()[1].lower() == "comics":
        mode = "comics"
    
    if mode == "anime":
        if not global_state.SERIES_DISPLAY:
            return await m.reply_text("📚 No anime series found.")
        all_series = sorted(set(global_state.SERIES_DISPLAY.items()))  # Get tuples of (normalized, display)
    else:  # comics
        if not global_state.MARVEL_SERIES_DISPLAY:
            return await m.reply_text("🎬 No comics found.")
        all_series = sorted(set(global_state.MARVEL_SERIES_DISPLAY.items()))
    
    txt = f"{'🎭 Anime Series' if mode == 'anime' else '🎬 Comics'}\n(Click to see characters)\n\n"
    
    kb = []
    buttons_in_row = 2
    row = []
    for norm_name, display_name in all_series:
        row.append(InlineKeyboardButton(display_name, callback_data=f"char_{mode}_{norm_name}"))
        if len(row) == buttons_in_row:
            kb.append(row)
            row = []
    if row:
        kb.append(row)
    
    # Add toggle button
    toggle_btn = InlineKeyboardButton("🎬 Comics", callback_data="char_comics_list") if mode == "anime" else InlineKeyboardButton("🎭 Anime", callback_data="char_anime_list")
    kb.append([toggle_btn])
    
    await m.reply_text(txt, reply_markup=InlineKeyboardMarkup(kb) if kb else None)