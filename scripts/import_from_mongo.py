"""Import characters from a MongoDB characters collection and write to data/character.json

Usage:
  python import_from_mongo.py --uri "mongodb+srv://..." --db mydb --collection characters --out ../data/character.json

If not provided, defaults will be taken from config.py (MONGO_URI, MONGO_DB_NAME, CHARACTERS_FILE).
The script attempts to normalize documents with fields: name, series, stats (dict), img.
If stats are stored as top-level numeric fields, they'll be gathered into a stats dict.
"""
import argparse
import json
import os
import sys
from pymongo import MongoClient
from bson import ObjectId

# Attempt to import project config for defaults
try:
    from config import MONGO_URI as CFG_MONGO_URI, MONGO_DB_NAME as CFG_DB, CHARACTERS_FILE as CFG_OUT
except Exception:
    CFG_MONGO_URI, CFG_DB, CFG_OUT = None, None, None

KNOWN_ROLE_KEYS = set([
    'captain','vice_captain','tank','healer','assassin','support','traitor',
    'paragon','genius','powerhouse','mystic','street_level','cosmic','trickster','herald'
])


def normalize_doc(doc):
    # Convert ObjectId and bytes to str
    def safe_str(v):
        if isinstance(v, ObjectId):
            return str(v)
        return v

    name = doc.get('name') or doc.get('title') or doc.get('character') or safe_str(doc.get('_id'))
    series = doc.get('series') or doc.get('franchise') or doc.get('universe') or doc.get('group') or ""
    img = doc.get('img') or doc.get('image') or doc.get('avatar') or doc.get('thumbnail') or ""

    stats = {}
    if isinstance(doc.get('stats'), dict):
        # copy numeric values only
        for k, v in doc.get('stats').items():
            if isinstance(v, (int, float)):
                stats[k if isinstance(k, str) else str(k)] = int(v)
    else:
        # collect numeric top-level fields and known roles
        for k, v in doc.items():
            if k in ['_id', 'name', 'series', 'img', 'image', 'avatar', 'stats']: continue
            if isinstance(v, (int, float)):
                stats[k if isinstance(k, str) else str(k)] = int(v)
            else:
                # also try nested dicts containing numeric role keys
                if isinstance(v, dict):
                    for kk, vv in v.items():
                        if isinstance(vv, (int, float)):
                            stats[kk if isinstance(kk, str) else str(kk)] = int(vv)

    # normalize stat keys: lower, replace spaces/dashes with underscore
    norm_stats = {}
    for k, v in stats.items():
        nk = k.lower().replace(' ', '_').replace('-', '_')
        norm_stats[nk] = int(v)

    return {
        'name': str(name),
        'series': str(series),
        'stats': norm_stats,
        'img': str(img)
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--uri', help='MongoDB URI', default=CFG_MONGO_URI)
    parser.add_argument('--db', help='Database name', default=CFG_DB)
    parser.add_argument('--collection', help='Collection name', default='characters')
    parser.add_argument('--out', help='Output JSON file', default=CFG_OUT or os.path.join('data', 'character.json'))
    parser.add_argument('--limit', type=int, help='Limit number of documents to import', default=0)
    parser.add_argument('--dry-run', action='store_true', help='Do not write file, just print count and sample')
    args = parser.parse_args()

    if not args.uri:
        print('Missing MongoDB URI (pass --uri or set MONGO_URI in config.py)')
        sys.exit(2)
    if not args.db:
        print('Missing DB name (pass --db or set MONGO_DB_NAME in config.py)')
        sys.exit(2)

    client = MongoClient(args.uri, serverSelectionTimeoutMS=5000)
    try:
        client.admin.command('ping')
    except Exception as e:
        print('Failed to connect to MongoDB:', e)
        sys.exit(2)

    db = client[args.db]
    col = db[args.collection]

    cursor = col.find({})
    if args.limit and args.limit > 0:
        cursor = cursor.limit(args.limit)

    out = []
    count = 0
    for doc in cursor:
        normalized = normalize_doc(doc)
        out.append(normalized)
        count += 1

    print(f'Imported {count} documents from {args.db}.{args.collection}')
    if args.dry_run:
        if out:
            print('Sample:', json.dumps(out[0], indent=2, ensure_ascii=False))
        return

    # Ensure output dir exists
    out_dir = os.path.dirname(args.out)
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print('Wrote', args.out)


if __name__ == '__main__':
    main()
