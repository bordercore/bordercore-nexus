# ES7 script_score vs ES8 kNN — relevance check

Model: text-embedding-3-small. Corpus: 1485 notes (user_id=1), identical on both clusters.
Query = each note's own name (self-retrieval).
**Summary (8 queries):** self@1 ES7=6/8 ES8=6/8; self@3 ES7=6/8 ES8=6/8; avg top3 overlap=3.00/3

## Conclusion

- **Rankings are identical**: ES8 kNN returns the same top-3 (in the same order) as ES7
  script_score on every query (overlap 3.00/3). The two self@1 "misses" occur on both
  engines and are notes with near-duplicate siblings (e.g. repeated appointment notes) that
  outrank the specific source — not a regression.
- **Scores map exactly `ES8 = ES7 / 2`** (1.701→0.851, 1.692→0.846, …), confirming
  ES8 native cosine kNN = `(1 + cosine) / 2 ∈ [0, 1]` vs ES7's `cosineSimilarity + 1.0 ∈ [0, 2]`.
- **Threshold mapping for the RAG work:** the RAG doc's "raw cosine < 0.3 ⇒ irrelevant" maps to
  an **ES8 kNN score floor of `(1 + 0.3) / 2 = 0.65`**. Observed self/strong matches score
  ~0.75–0.90; weaker secondary hits ~0.63–0.74 — so `min_score ≈ 0.65` is a sane starting cutoff
  to tune. (Applying the cutoff in code is RAG-project work, not this upgrade.)
- Conversion is therefore behavior-preserving for retrieval; only the score scale changed.


## 'OS X VPN and DNS'
- ES7 top3: 'OS X VPN and DNS'(1.701), ''(1.494), ''(1.447)
- ES8 top3: 'OS X VPN and DNS'(0.851), ''(0.748), ''(0.724)
- self@1 ES7=True ES8=True; top3 overlap=3/3

## 'Appointment with Dr. Rabinowitz'
- ES7 top3: 'Appointment with Dr. Rabinowit'(1.692), 'Appointment with Dr. Rabinowit'(1.658), 'Appointment with Dr. Rabinowit'(1.643)
- ES8 top3: 'Appointment with Dr. Rabinowit'(0.846), 'Appointment with Dr. Rabinowit'(0.829), 'Appointment with Dr. Rabinowit'(0.823)
- self@1 ES7=False ES8=False; top3 overlap=3/3

## 'Credit Scores'
- ES7 top3: 'Credit Scores'(1.567), ''(1.333), 'Personal Finance'(1.268)
- ES8 top3: 'Credit Scores'(0.783), ''(0.666), 'Personal Finance'(0.636)
- self@1 ES7=True ES8=True; top3 overlap=3/3

## 'Misc Notes'
- ES7 top3: 'Misc Notes'(1.507), 'Notes'(1.473), 'Notes'(1.422)
- ES8 top3: 'Misc Notes'(0.754), 'Notes'(0.738), 'Notes'(0.714)
- self@1 ES7=True ES8=True; top3 overlap=3/3

## 'IP Masquerading'
- ES7 top3: 'IP Masquerading'(1.602), ''(1.415), ''(1.402)
- ES8 top3: 'IP Masquerading'(0.801), ''(0.707), ''(0.700)
- self@1 ES7=True ES8=True; top3 overlap=3/3

## 'Dental Cleaning with Christine'
- ES7 top3: 'Dental Cleaning with Christine'(1.791), 'Dental Cleaning with Christine'(1.759), 'Dental Cleaning with Christine'(1.758)
- ES8 top3: 'Dental Cleaning with Christine'(0.896), 'Dental Cleaning with Christine'(0.880), 'Dental Cleaning with Christine'(0.879)
- self@1 ES7=False ES8=False; top3 overlap=3/3

## 'Whole Grains'
- ES7 top3: 'Whole Grains'(1.666), 'Food Recommendations'(1.406), ''(1.350)
- ES8 top3: 'Whole Grains'(0.833), 'Food Recommendations'(0.702), ''(0.675)
- self@1 ES7=True ES8=True; top3 overlap=3/3

## 'Giving all todo items an initial sort order'
- ES7 top3: 'Giving all todo items an initi'(1.644), ''(1.434), 'isort'(1.362)
- ES8 top3: 'Giving all todo items an initi'(0.822), ''(0.716), 'isort'(0.681)
- self@1 ES7=True ES8=True; top3 overlap=3/3

