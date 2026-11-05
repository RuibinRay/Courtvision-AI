"""Elo rating model for NBA games (FiveThirtyEight-style): margin-of-victory multiplier,
home-court advantage in rating points, and between-season regression toward the mean."""
from __future__ import annotations
import math
from collections import defaultdict

class Elo:
    def __init__(self, k=20.0, hca=75.0, base=1500.0, carry=0.75):
        self.k, self.hca, self.base, self.carry = k, hca, base, carry
        self.r = defaultdict(lambda: base)
        self.history = defaultdict(list)       # teamId -> [(date, rating)]
        self.season = None
    def new_season(self, season):
        if self.season is not None and season != self.season:
            for t in list(self.r): self.r[t] = self.base + self.carry * (self.r[t] - self.base)
        self.season = season
    def expect(self, home, away, neutral=False):
        d = self.r[home] + (0 if neutral else self.hca) - self.r[away]
        return 1.0 / (1.0 + 10 ** (-d / 400.0))
    def pre_diff(self, home, away):
        return self.r[home] - self.r[away]
    def update(self, home, away, home_pts, away_pts, date=None, playoffs=False):
        p = self.expect(home, away)
        s = 1.0 if home_pts > away_pts else 0.0
        margin = abs(home_pts - away_pts)
        elo_diff_winner = (self.r[home] - self.r[away] + self.hca) * (1 if s == 1 else -1)
        mult = math.log(max(margin, 1) + 1) * (2.2 / (elo_diff_winner * 0.001 + 2.2))
        k = self.k * (1.25 if playoffs else 1.0)
        delta = k * mult * (s - p)
        self.r[home] += delta; self.r[away] -= delta
        if date is not None:
            self.history[home].append((str(date)[:10], round(self.r[home], 1))); self.history[away].append((str(date)[:10], round(self.r[away], 1)))
        return p
    @staticmethod
    def prob_from_diff(diff, hca=75.0):
        return 1.0 / (1.0 + 10 ** (-(diff + hca) / 400.0))
