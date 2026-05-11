"""Static constants for the blob app.

Centralizes values that aren't model-backed but are referenced from views,
services, and the front end.
"""
from __future__ import annotations

# Ordered grouping of book tags into meta-categories for the Bookshelf
# Card Catalog page. Categories drive the left-rail Tag Index ordering,
# the per-category accent color (set in SCSS via [data-category="<id>"]),
# and the "selected drawer" subtitle ("52 books · Languages").
#
# Tags are matched case-insensitively against Tag.name. The first
# matching category wins, so place more-specific buckets (e.g. Web
# Frontend) before broader ones (e.g. CS Foundations). Tags that don't
# appear in any category surface in a synthetic "Other" bucket at the
# bottom of the rail — see blob.services.get_book_tag_categories.
#
# Promote this to a real `TagCategory` model when the grouping needs to
# be user-editable. Until then, edit this list to reshape the index.
BOOK_TAG_CATEGORIES: list[dict[str, object]] = [
    {
        "id": "languages",
        "label": "Languages",
        "tags": [
            "python", "java", "javascript", "perl", "rust", "go", "scala",
            "c", "c++", "c sharp", "ruby", "haskell", "kotlin", "swift",
            "typescript", "lisp", "r", "assembly", "clojure", "erlang",
            "groovy", "php", "bash", "shell", "awk", ".net", "jython",
            "node", "object oriented languages", "programming languages",
        ],
    },
    {
        "id": "data-ai",
        "label": "Data & AI",
        "tags": [
            "machine learning", "deep learning", "data science", "ai",
            "artificial intelligence", "nlp", "natural language processing",
            "neural networks", "scikit-learn", "tensorflow", "pytorch",
            "keras", "transformers", "llms", "reinforcement learning",
            "computer vision", "text classification", "bayesian statistics",
            "statistics", "mathematics", "big data", "hadoop", "spark",
            "spark sql", "spark streaming", "pyspark", "stream processing",
            "kafka", "kafka streams", "storm", "hbase", "hive", "pig",
            "mapreduce", "lambda architecture", "cascading", "mahout",
            "sqoop", "oozie", "flume", "accumulo", "elasticsearch", "solr",
            "lucene", "mongo", "graph databases", "graphx",
            "data visualization", "data mining", "data analytics",
            "scientific computing", "search", "information retrieval",
            "semantic web", "ipython notebook", "pandas", "optimization",
            "bioinformatics", "intelligent algorithms",
        ],
    },
    {
        "id": "systems",
        "label": "Systems",
        "tags": [
            "linux", "unix", "linux kernel", "linux drivers",
            "unix programming", "system administration", "networking",
            "tcpip", "dns", "bind", "http", "ssh", "vpn", "ethernet",
            "wifi", "wireless", "802.11", "ldap", "voip", "snmp", "nfs",
            "samba", "raid", "kerberos", "load balancing",
            "network programming", "logging", "log4j", "compression",
            "configuration management", "puppet", "vagrant", "ant",
            "gradle", "maven", "jenkins", "sbt", "make", "apache",
            "tomcat", "nginx", "jboss", "postfix", "qmail", "sendmail",
            "spam", "spamassassin", "mail", "email", "irc", "databases",
            "sql", "nosql", "postgresql", "mysql", "cassandra",
            "kubernetes", "docker", "embedded systems", "arduino",
            "raspberry pi", "electronics", "microelectronics", "circuits",
            "hardware", "device drivers", "x windows", "gnome", "gtk",
            "os x", "macintosh", "apple", "smart home",
            "internet of things", "wearables", "wearable tech",
            "cloud computing", "aws", "open source",
            "distributed programming", "distributed objects",
            "systems performance", "emacs", "vi",
        ],
    },
    {
        "id": "security",
        "label": "Security",
        "tags": [
            "security", "network security", "hacking", "hardware hacking",
            "cryptography", "penetration testing", "reverse engineering",
            "binary analysis", "computer viruses", "firewalls", "openssl",
            "wireshark", "ethereal", "snort", "ids", "wardriving",
        ],
    },
    {
        "id": "web-frontend",
        "label": "Web Frontend",
        "tags": [
            "css", "html", "dhtml", "ajax", "jquery", "jquery ui", "react",
            "vue", "angular", "bootstrap", "twitter-bootstrap", "dojo",
            "websockets", "web design", "svg", "d3", "fonts", "ui",
        ],
    },
    {
        "id": "web",
        "label": "Web & Frameworks",
        "tags": [
            "web development", "django", "spring", "rails", "catalyst",
            "hibernate", "j2ee", "jsp", "ejb", "web services", "soap",
            "rest", "apis", "xml", "xslt", "xpath", "xpointer", "sax2",
            "xml-rpc", "tika", "rss", "git", "subversion", "web scraping",
            "web",
        ],
    },
    {
        "id": "foundations",
        "label": "CS Foundations",
        "tags": [
            "algorithms", "design patterns", "software development",
            "software architecture", "software engineering", "programming",
            "computer science", "data structures", "compilers", "lex",
            "yacc", "logic", "lambda calculus", "computation",
            "functional programming", "regular expressions", "uml",
            "testing", "refactoring", "best practices",
            "version control", "game development", "game programming",
            "game engines", "computer graphics", "opengl", "3d engines",
            "machine language", "c pointers", "java generics",
            "complexity", "textbook",
        ],
    },
    {
        "id": "retro",
        "label": "Retro Computing",
        "tags": [
            "retro computing", "retro gaming", "80s", "70s",
            "internet history", "nostalgia", "pop culture", "atari",
            "atari 2600", "2600", "apple ii", "apple i", "commodore",
            "c64", "commodore 64 (c64)", "amiga", "infocom", "doom",
            "nethack", "rogue", "roguelike", "interactive fiction",
            "game consoles", "video game consoles", "video games",
            "video rentals", "video stores", "home video", "mtv",
            "music videos", "techtv", "tivo", "dotcoms", "theglobe",
            "generation x", "millennium", "cyberpunk 2077", "synthwave",
            "gaming",
        ],
    },
    {
        "id": "health",
        "label": "Health & Wellness",
        "tags": [
            "health", "fitness", "nutrition", "longevity", "exercise",
            "strength training", "yoga", "intermittent fasting", "fasting",
            "sleep", "circadian rhythms", "neuroscience", "mind", "brain",
            "brain training", "memory", "focus", "productivity",
            "mindfullness", "psychology", "therapy", "emotional health",
            "decision making", "thinking", "creativity", "introverts",
            "back pain", "lower back pain", "headaches", "posture",
            "immune system", "microbiome", "cooking", "cookbook",
            "fast food", "plants", "learning", "writing",
            "personal finance", "finance", "investing", "home buying",
            "home improvement", "diy", "maker", "pc building",
            "management", "job interviews",
        ],
    },
    {
        "id": "human",
        "label": "Human Library",
        "tags": [
            "self-help", "science fiction", "speculative fiction",
            "dystopian", "fiction", "short stories", "young adult",
            "philosophy", "history", "biography", "autobiography",
            "physics", "general relativity", "electrodynamics",
            "electricity", "calculus", "vector calculus", "linear algebra",
            "mathematica", "science", "popular science", "astronomy",
            "futurism", "transhumanism", "blockchain", "bitcoin",
            "intellectual property", "amazon", "social media", "art",
            "architecture", "heavy metal", "hard rock", "movies",
            "entertainment", "role playing games", "role-playing games",
            "audiobook", "coffee table book", "cyberpunk",
            "william gibson", "neuromancer", "dune", "the martian",
            "brave new world", "catcher in the rye", "j. d. salinger",
            "star wars", "lita ford", "godel",
            "godel's incompleteness theorem", "richard feynman",
            "einstein",
        ],
    },
]
