import json
import os
import logging
from pymongo import MongoClient
from config import *
import global_state

MONGO_CLIENT = None
MONGO_DB = None
COL_ACTIVE_CHATS = None
COL_ACTIVE_USERS = None
COL_LEADERBOARD = None
COL_CHARACTERS = None
USE_MONGO = False

def init_mongo():
    global MONGO_CLIENT, MONGO_DB, COL_ACTIVE_CHATS, COL_ACTIVE_USERS, COL_LEADERBOARD, COL_CHARACTERS, USE_MONGO
    try:
        MONGO_CLIENT = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        MONGO_CLIENT.admin.command('ping')
        MONGO_DB = MONGO_CLIENT[MONGO_DB_NAME]
        COL_ACTIVE_CHATS = MONGO_DB['active_chats']
        COL_ACTIVE_USERS = MONGO_DB['active_users']
        COL_LEADERBOARD = MONGO_DB['leaderboard']
        COL_CHARACTERS = MONGO_DB['characters']
        
        # Ensure Indexes
        try:
            COL_ACTIVE_CHATS.create_index('chat_id', unique=True)
            COL_ACTIVE_USERS.create_index('user_id', unique=True)
            COL_LEADERBOARD.create_index('user_id', unique=True)
            COL_CHARACTERS.create_index('name', unique=True)
        except: pass

        USE_MONGO = True
        logging.info("✅ Connected to MongoDB.")
    except Exception as e:
        USE_MONGO = False
        logging.error(f"❌ MongoDB connection failed: {e}")

def load_id_set(filename):
    if USE_MONGO:
        col = COL_ACTIVE_CHATS if filename == CHATS_FILE else COL_ACTIVE_USERS
        key = "chat_id" if filename == CHATS_FILE else "user_id"
        try:
            return set(d[key] for d in col.find({}, {"_id": 0, key: 1}))
        except: return set()
    if os.path.exists(filename):
        try:
            with open(filename, "r") as f: return set(json.load(f))
        except: return set()
    return set()

def save_id_set(filename, id_set):
    if USE_MONGO:
        col = COL_ACTIVE_CHATS if filename == CHATS_FILE else COL_ACTIVE_USERS
        key = "chat_id" if filename == CHATS_FILE else "user_id"
        try:
            if not id_set: return
            for i in id_set:
                try: col.update_one({key: i}, {"$set": {key: i}}, upsert=True)
                except: pass
        except: pass
        return
    try:
        with open(filename, "w") as f: json.dump(list(id_set), f)
    except: pass

def get_user_stats(user_id, name="Unknown"):
    default = {"name": name, "wins": 0, "matches": 0, "rating": 1200}
    try:
        if USE_MONGO:
            u = COL_LEADERBOARD.find_one({"user_id": user_id})
            if u: return u
            return default
        else:
            if os.path.exists(LEADERBOARD_FILE):
                with open(LEADERBOARD_FILE, "r") as f: data = json.load(f)
                return data.get(str(user_id), default)
            return default
    except:
        return default

def save_user_stats(user_id, stats):
    if USE_MONGO:
        COL_LEADERBOARD.update_one({"user_id": user_id}, {"$set": stats}, upsert=True)
    else:
        data = {}
        if os.path.exists(LEADERBOARD_FILE):
            with open(LEADERBOARD_FILE, "r") as f: data = json.load(f)
        data[str(user_id)] = stats
        with open(LEADERBOARD_FILE, "w") as f: json.dump(data, f)

def load_admin_ids():
    try:
        if os.path.exists(ADMIN_IDS_FILE):
            with open(ADMIN_IDS_FILE, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if isinstance(loaded, list):
                    global_state.ADMIN_IDS = loaded
    except Exception as e:
        logging.error(f"Failed to load admin IDs: {e}")

def save_admin_ids():
    try:
        with open(ADMIN_IDS_FILE, "w", encoding="utf-8") as f:
            json.dump(list(global_state.ADMIN_IDS), f, indent=2)
    except Exception: pass