import json
import global_state
from config import *
import database
import os

def calculate_elo(rating_a, rating_b, actual_score_a):
    K = 32
    expected_a = 1 / (1 + 10 ** ((rating_b - rating_a) / 400))
    new_rating_a = rating_a + K * (actual_score_a - expected_a)
    return int(new_rating_a)

def update_leaderboard_elo(p1_id, p1_name, p2_id, p2_name, result):
    # result: 1 (p1 wins), 0 (p2 wins), 0.5 (draw)
    u1 = database.get_user_stats(p1_id, p1_name)
    u2 = database.get_user_stats(p2_id, p2_name)

    r1, r2 = u1.get("rating", 1200), u2.get("rating", 1200)

    def rank_index(rating):
        if rating < 1000: return 0
        if rating < 1300: return 1
        if rating < 1600: return 2
        if rating < 2000: return 3
        if rating < 2500: return 4
        return 5

    delta1, delta2 = 0, 0
    if result != 0.5:
        if result == 1:
            diff = rank_index(r1) - rank_index(r2)
            delta_w, delta_l = (16, -10) if diff >= 2 else (20, -15) if diff == 1 else (28, -20) if diff == 0 else (35, -12)
            delta1, delta2 = int(delta_w), int(delta_l)
        else:
            diff = rank_index(r2) - rank_index(r1)
            delta_w, delta_l = (16, -10) if diff >= 2 else (20, -15) if diff == 1 else (28, -20) if diff == 0 else (35, -12)
            delta2, delta1 = int(delta_w), int(delta_l)

    if global_state.NEW_YEAR_EVENT:
        if delta1 < 0: delta1 = 0
        if delta2 < 0: delta2 = 0

    u1.update({"name": p1_name, "matches": u1["matches"] + 1, "rating": max(0, r1 + delta1)})
    u2.update({"name": p2_name, "matches": u2["matches"] + 1, "rating": max(0, r2 + delta2)})
    
    if result == 1: u1["wins"] += 1
    elif result == 0: u2["wins"] += 1

    u1["user_id"], u2["user_id"] = p1_id, p2_id
    database.save_user_stats(p1_id, u1)
    database.save_user_stats(p2_id, u2)

    return int(u1["rating"] - r1), int(u2["rating"] - r2)

def get_top_3_users():
    """Get top 3 users by rating for Anime King title"""
    try:
        if database.USE_MONGO and database.COL_LEADERBOARD:
            users = list(database.COL_LEADERBOARD.find({}).sort("rating", -1).limit(3))
            return [u.get("user_id") for u in users if "user_id" in u]
        else:
            if os.path.exists(database.LEADERBOARD_FILE):
                with open(database.LEADERBOARD_FILE, "r") as f:
                    data = json.load(f)
                    sorted_users = sorted(data.items(), key=lambda x: x[1].get("rating", 0), reverse=True)
                    return [int(uid) for uid, stats in sorted_users[:3]]
            return []
    except Exception:
        return []

def is_admin(user_id):
    return user_id in global_state.ADMIN_IDS

def get_top_3_users():
    """Get the top 3 users by rating"""
    try:
        if database.USE_MONGO:
            # Get top 3 from MongoDB
            users = list(database.COL_LEADERBOARD.find({}).sort("rating", -1).limit(3))
            return [u.get("user_id") for u in users if u.get("user_id")]
        else:
            # Load from JSON file
            if os.path.exists(LEADERBOARD_FILE):
                with open(LEADERBOARD_FILE, "r") as f:
                    data = json.load(f)
                # Sort by rating descending and get top 3
                sorted_users = sorted(data.items(), key=lambda x: x[1].get("rating", 0), reverse=True)
                return [int(uid) for uid, _ in sorted_users[:3]]
    except Exception:
        pass
    return []