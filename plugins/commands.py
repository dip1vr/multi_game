from pyrogram import Client, filters
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from pyrogram.enums import ParseMode
import html
import database
import global_state
import ui
from utils import is_admin, get_top_3_users

@Client.on_message(filters.command("start"))
async def start_cmd(c, m):
    await m.reply_text(
        "👋 <b>Welcome to Anime Draft Wars!</b>\n\n"
        "Draft a team of 8 anime characters and battle friends!\n"
        "Use /draft to play.\n"
        "Use /guide to learn how to play.",
        parse_mode=ParseMode.HTML
    )

@Client.on_message(filters.command("guide"))
async def guide_cmd(c, m):
    await m.reply_text(
        "📚 <b>Game Guide</b>\n\n"
        "1. <b>Challenge</b>: Reply `/draft` to a user.\n"
        "2. <b>Filter</b>: Use `/draft naruto` to play with specific series.\n"
        "3. <b>Drafting</b>: Take turns drawing characters.\n"
        "4. <b>Roles</b>:\n"
        "   ⚔️ Captain/Vice: Strongest fighters.\n"
        "   🛡 Tank: Defense.\n"
        "   💚 Healer: Counters Assassins.\n"
        "   💀 Assassin: Counters Healers.\n"
        "   🎭 Traitor: High stats but might betray you!\n\n"
        "5. <b>Winning</b>: Higher score wins. Wins increase your Rank Points!",
        parse_mode=ParseMode.HTML
    )

@Client.on_message(filters.command("list"))
async def list_cmd(c, m):
    mode = "anime"
    # Check if user specified comics mode
    if len(m.text.split()) > 1 and m.text.split()[1].lower() == "comics":
        mode = "comics"
    
    if mode == "anime":
        if not global_state.SERIES_DISPLAY:
            return await m.reply_text("📚 No anime series found.")
        
        series = sorted(set(global_state.SERIES_DISPLAY.values()))
    else:  # comics
        if not global_state.MARVEL_SERIES_DISPLAY:
            return await m.reply_text("🎬 No comics found.")
        
        series = sorted(set(global_state.MARVEL_SERIES_DISPLAY.values()))
    
    page = 1
    if len(m.text.split()) > 1:
        try:
            page = max(1, int(m.text.split()[1]))
        except ValueError:
            page = 1
    
    per_page = 25
    total_pages = (len(series) + per_page - 1) // per_page
    page = min(page, total_pages)
    
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    page_series = series[start_idx:end_idx]
    
    if mode == "anime":
        txt = f"📚 <b>Available Anime Series</b> (Page {page}/{total_pages})\n\n" + "\n".join(f"• {html.escape(s)}" for s in page_series)
    else:
        txt = f"🎬 <b>Available Comics</b> (Page {page}/{total_pages})\n\n" + "\n".join(f"• {html.escape(s)}" for s in page_series)
    
    kb = []
    row = []
    if page > 1:
        row.append(InlineKeyboardButton("⬅️ Prev", callback_data=f"list_{mode}_{page-1}"))
    if page < total_pages:
        row.append(InlineKeyboardButton("Next ➡️", callback_data=f"list_{mode}_{page+1}"))
    if row:
        kb.append(row)
    
    # Add toggle button for Anime/Comics
    toggle_btn = InlineKeyboardButton("🎬 Comics", callback_data="list_comics_1") if mode == "anime" else InlineKeyboardButton("🎭 Anime", callback_data="list_anime_1")
    kb.append([toggle_btn])
    
    await m.reply_text(txt, reply_markup=InlineKeyboardMarkup(kb) if kb else None, parse_mode=ParseMode.HTML)

@Client.on_message(filters.command("profile"))
async def profile_cmd(c, m):
    user = m.from_user
    stats = database.get_user_stats(user.id, user.first_name)

    wins = stats.get("wins", 0)
    matches = stats.get("matches", 0)
    rating = stats.get("rating", 1200)
    wr = round((wins / matches * 100), 1) if matches > 0 else 0

    # Get top 3 users
    top_3 = get_top_3_users()
    is_top_3 = user.id in top_3

    if rating < 1000: rank = "🐣 Novice"
    elif rating < 1300: rank = "🥉 Bronze"
    elif rating < 1600: rank = "🥈 Silver"
    elif rating < 2000: rank = "🥇 Gold"
    elif rating < 2500: rank = "💎 Diamond"
    elif is_top_3: rank = "👑 Anime King"
    else: rank = "⭐ Legendary"

    # Achievements
    user_achis = global_state.USER_ACHIEVEMENTS.get(str(user.id), [])
    achievements_txt = "\n".join([f"  {global_state.AVAILABLE_ACHIEVEMENTS.get(k, k)}" for k in user_achis]) if user_achis else "  No achievements yet"

    txt = (
        f"👤 <b>Profile: {html.escape(user.first_name)}</b>\n\n"
        f"🏅 <b>Rank:</b> {rank}\n"
        f"💠 <b>Points:</b> {rating}\n"
        f"⚔️ <b>Matches:</b> {matches}\n"
        f"🏆 <b>Wins:</b> {wins}\n"
        f"📈 <b>Win Rate:</b> {wr}%\n\n"
        f"🎖 <b>Achievements:</b>\n{achievements_txt}"
    )
    await m.reply(txt, parse_mode=ParseMode.HTML)

@Client.on_message(filters.command("status") & filters.create(lambda _, __, m: is_admin(m.from_user.id)))
async def status_cmd(c, m):
    c_count = len(database.load_id_set(database.CHATS_FILE))
    u_count = len(database.load_id_set(database.USERS_FILE))
    await m.reply(f"📊 **Bot Statistics**\n👥 Active Users: **{u_count}**\n💬 Active Chats: **{c_count}**")


@Client.on_message(filters.command("leaderboard"))
async def leaderboard_cmd(c, m):
    """Show leaderboard (paged). Usage: /leaderboard [page]"""
    # page param (optional)
    args = m.text.split()
    page = 1
    if len(args) > 1:
        try:
            page = max(1, int(args[1]))
        except ValueError:
            page = 1

    per_page = 16
    start = (page - 1) * per_page
    end = start + per_page

    # Fetch leaderboard entries
    entries = []
    try:
        if database.USE_MONGO and database.COL_LEADERBOARD:
            docs = list(database.COL_LEADERBOARD.find({}).sort("rating", -1).skip(start).limit(per_page))
            for d in docs:
                uid = d.get("user_id")
                name = d.get("name") or str(uid)
                rating = d.get("rating", 0)
                wins = d.get("wins", 0)
                entries.append((name, rating, wins))
        else:
            if os.path.exists(database.LEADERBOARD_FILE):
                with open(database.LEADERBOARD_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                sorted_users = sorted(data.items(), key=lambda x: x[1].get("rating", 0), reverse=True)
                page_slice = sorted_users[start:end]
                for uid, stats in page_slice:
                    name = stats.get("name") or uid
                    rating = stats.get("rating", 0)
                    wins = stats.get("wins", 0)
                    entries.append((name, rating, wins))
    except Exception:
        return await m.reply_text("❌ Failed to load leaderboard.")

    if not entries:
        return await m.reply_text("🏆 Leaderboard is empty or page out of range.")

    txt_lines = [f"🏆 <b>Leaderboard</b> — Page {page}\n"]
    rank = start + 1
    for name, rating, wins in entries:
        txt_lines.append(f"{rank}. {html.escape(str(name))} — {rating} pts ({wins} wins)")
        rank += 1

    # navigation
    # try to determine total pages if possible
    total_pages = None
    try:
        if database.USE_MONGO and database.COL_LEADERBOARD:
            total = database.COL_LEADERBOARD.count_documents({})
            total_pages = (total + per_page - 1) // per_page
        else:
            if os.path.exists(database.LEADERBOARD_FILE):
                with open(database.LEADERBOARD_FILE, "r", encoding="utf-8") as f:
                    total = len(json.load(f))
                    total_pages = (total + per_page - 1) // per_page
    except Exception:
        total_pages = None

    kb = []
    row = []
    if page > 1:
        row.append(InlineKeyboardButton("⬅️ Prev", callback_data=f"leader_{page-1}"))
    if total_pages and page < total_pages:
        row.append(InlineKeyboardButton("Next ➡️", callback_data=f"leader_{page+1}"))
    if row:
        kb.append(row)

    # Add toggle button to view by wins
    kb.append([InlineKeyboardButton("Most Wins", callback_data="lb_toggle_wins")])

    await m.reply_text("\n".join(txt_lines), reply_markup=InlineKeyboardMarkup(kb) if kb else None, parse_mode=ParseMode.HTML)