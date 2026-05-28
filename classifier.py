"""
classifier.py — Keyword-based expense classifier (cloud deployment)

Architecture:
  1. LRU cache      — identical description → instant repeat lookup
  2. Keyword rules  — regex rules cover ~85% of real-world expenses
  3. Fallback       → "other"

Note: Semantic ML model (sentence-transformers) removed for cloud deployment
due to bundle size constraints. Keyword path is fast and accurate enough
for the vast majority of expense descriptions.
"""

import re
import logging
from functools import lru_cache

logger = logging.getLogger(__name__)


# ── Keyword fast-path rules ───────────────────────────────────────────────────
def _build_keyword_rules():
    rules_raw = [
        # ── Food & Dining ──────────────────────────────────────────────────
        (r"restauran|cafe|coffee|starbucks|dunkin|mcdonald|burger|pizza|kfc|subway|"
         r"domino|sushi|diner|bistro|bakery|grocery|supermarke|walmart|costco|"
         r"whole\s*foods|trader\s*joe|aldi|lidl|meal|lunch|dinner|breakfast|"
         r"takeaway|takeout|delivery|zomato|swiggy|doordash|ubereats|grubhub|"
         r"food|snack|beverage|bar|pub|brewery|wine|beer|drinks|juice|tea|"
         r"blinkit|zepto|bigbasket|grofers|instamart|dunzo|jiomart|"
         r"haldiram|bikanervala|amul|saravana\s*bhavan|udupi|dhaba|"
         r"chaayos|third\s*wave|blue\s*tokai|barista|cafe\s*coffee\s*day|ccd|"
         r"faasos|behrouz|box8|freshmenu|eatfit|lunchbox|"
         r"khaana|khana|nashta|chai|lassi|doodh|sabzi|daal|dal|roti|"
         r"paratha|biryani|paneer|mithai|sweet\s*shop|namkeen|"
         r"kirana|provision|general\s*store|dmart|reliance\s*fresh|"
         r"more\s*supermarket|spar|natures\s*basket",
         "food"),

        # ── Transport & Travel ─────────────────────────────────────────────
        (r"uber|lyft|ola|rapido|taxi|cab|auto\s*rickshaw|metro|bus\s*pass|train|"
         r"flight|airfare|airline|airways|airport|hotel|hostel|airbnb|booking\.com|"
         r"makemytrip|goibibo|yatra|cleartrip|ixigo|redbus|abhibus|"
         r"fuel|petrol|diesel|gas\s*station|parking|toll|toll\s*tax|"
         r"transit|commute|travel|ferry|cruise|visa\s*fee|car\s*rental|"
         r"indigo|spicejet|air\s*india|vistara|akasa|"
         r"irctc|tatkal|railway|indian\s*railways|bus\s*ticket|"
         r"rickshaw|auto|e-?rickshaw|metro\s*card|"
         r"fastag|highway|expressway|petrol\s*pump|hp\s*petrol|bharat\s*petrol|"
         r"indian\s*oil|iocl|bpcl|hpcl",
         "transport"),

        # ── Entertainment & Leisure ────────────────────────────────────────
        (r"netflix|spotify|hulu|disney\+|amazon\s*prime|youtube\s*premium|"
         r"hotstar|jio\s*cinema|sony\s*liv|zee5|voot|mxplayer|alt\s*balaji|"
         r"movie|cinema|theatre|pvr|inox|cinepolis|bookmyshow|"
         r"concert|ticket|event|show|game|gaming|"
         r"steam|playstation|xbox|nintendo|twitch|amusement|park|zoo|museum|"
         r"bowling|golf|sport|recreation|hobby|magazine|newspaper|"
         r"apple\s*music|apple\s*tv|tidal|deezer|gaana|wynk|jiosaavn|saavn|"
         r"ludo|cricket\s*match|ipl\s*ticket|"
         r"esports|pubg|bgmi|freefire|lol|dota|valorant|"
         r"amazon\s*prime\s*video",
         "entertainment"),

        # ── Health & Medical ───────────────────────────────────────────────
        (r"hospital|clinic|doctor|physician|dentist|optician|pharmacy|chemist|"
         r"medicine|prescription|lab\s*test|health\s*insurance|gym|fitness|"
         r"yoga|pilates|massage|therapy|wellness|vitamins|supplement|medical|"
         r"apollo|fortis|max\s*hospital|aiims|manipal|narayana|"
         r"1mg|pharmeasy|netmeds|tata\s*1mg|healthkart|medplus|"
         r"cult\.fit|fitpass|anytime\s*fitness|gold\s*gym|"
         r"ayurvedic|homeopathy|diagnostic|pathology|xray|x-?ray|mri|scan|"
         r"blood\s*test|urine\s*test|ecg|health\s*checkup",
         "health"),

        # ── Shopping ──────────────────────────────────────────────────────
        (r"amazon|flipkart|meesho|myntra|ajio|nykaa|ebay|etsy|zalando|"
         r"clothing|clothes|shirt|trouser|dress|shoes|sneaker|jacket|"
         r"accessories|jewellery|jewelry|electronics|mobile|laptop|tablet|appliance|"
         r"furniture|home\s*decor|gift|toy|stationery|"
         r"snapdeal|shopclues|tata\s*cliq|reliance\s*digital|croma|vijay\s*sales|"
         r"decathlon|ikea|pepperfry|urban\s*ladder|fabindia|westside|zara|h&m|"
         r"pantaloons|lifestyle|shoppers\s*stop|max\s*fashion|"
         r"boat|realme|oneplus|samsung|apple\s*store|mi\s*store|"
         r"shein|beauty|cosmetics|skincare|haircare|salon|spa|parlour",
         "shopping"),

        # ── Utilities & Bills ──────────────────────────────────────────────
        (r"electricity|electric\s*bill|water\s*bill|gas\s*bill|rent|"
         r"internet|broadband|wifi|mobile\s*bill|phone\s*bill|recharge|"
         r"insurance|emi|loan|mortgage|tax|council\s*tax|maintenance|"
         r"subscription\s*fee|annual\s*fee|bank\s*charge|"
         r"jio|airtel|bsnl|vi\b|vodafone|idea|"
         r"tata\s*sky|dish\s*tv|d2h|siti\s*cable|local\s*cable|"
         r"piped\s*gas|lpg|cylinder|gas\s*cylinder|indane|hp\s*gas|bharat\s*gas|"
         r"bescom|msedcl|torrent\s*power|adani\s*electricity|"
         r"society\s*maintenance|flat\s*maintenance|apartment|"
         r"paytm\s*payment|phonepe\s*payment|gpay\s*payment|"
         r"credit\s*card\s*bill|emi\s*payment|sip|mutual\s*fund",
         "utilities"),

        # ── Education ─────────────────────────────────────────────────────
        (r"tuition|course|class|workshop|seminar|udemy|coursera|skillshare|"
         r"linkedin\s*learning|edx|school|college|university|exam\s*fee|"
         r"textbook|book|kindle|e-?book|software\s*license|adobe|notion|"
         r"microsoft\s*365|google\s*workspace|canva|figma|research|"
         r"byju|unacademy|vedantu|toppr|meritnation|"
         r"coaching|tutoring|iit|jee|neet|upsc|cat\s*exam|"
         r"pen|pencil|notebook|stationery|school\s*supplies",
         "education"),
    ]
    return [
        (re.compile(pattern, re.IGNORECASE), category)
        for pattern, category in rules_raw
    ]


_KEYWORD_RULES = _build_keyword_rules()

_CLEAN_RE = re.compile(r"[^a-z0-9\s]")
_SPACE_RE = re.compile(r"\s+")

_ABBREV_MAP = [
    (re.compile(r"\bswgy\b",  re.I), "swiggy"),
    (re.compile(r"\bzmt\b",   re.I), "zomato"),
    (re.compile(r"\bbms\b",   re.I), "bookmyshow"),
    (re.compile(r"\bmmt\b",   re.I), "makemytrip"),
    (re.compile(r"\bmob\s*bill\b", re.I), "mobile bill"),
    (re.compile(r"\bnet\s*bill\b", re.I), "internet bill"),
    (re.compile(r"\bpg\b",    re.I), "paying guest rent"),
    (re.compile(r"\blpg\b",   re.I), "gas cylinder"),
    (re.compile(r"\bmt\b",    re.I), "metro"),
    (re.compile(r"\botc\b",   re.I), "pharmacy medicine"),
]


def _normalise(description: str) -> str:
    text = description.lower()
    for pattern, replacement in _ABBREV_MAP:
        text = pattern.sub(replacement, text)
    text = _CLEAN_RE.sub(" ", text)
    return _SPACE_RE.sub(" ", text).strip()


def _keyword_classify(normalised: str):
    for pattern, category in _KEYWORD_RULES:
        if pattern.search(normalised):
            return category
    return None


# ── LRU-cached core ───────────────────────────────────────────────────────────
@lru_cache(maxsize=4096)
def _cached_classify(normalised: str) -> dict:
    kw = _keyword_classify(normalised)
    if kw is not None:
        return {"category": kw, "confidence": 1.0, "method": "keyword"}
    return {"category": "other", "confidence": 0.0, "method": "fallback"}


# ── Public API ────────────────────────────────────────────────────────────────
def classify_expense(description: str) -> dict:
    if not description or not description.strip():
        return {"category": "other", "confidence": 0.0, "method": "empty"}
    return _cached_classify(_normalise(description))


def classify_batch(descriptions: list[str]) -> list[dict]:
    return [classify_expense(d) for d in descriptions]


def warm_up():
    """No-op in cloud deployment."""
    pass


def cache_info():
    return _cached_classify.cache_info()


def cache_clear():
    _cached_classify.cache_clear()