import { Player } from "@/core/Player";
import { ShopManager } from "@/core/ShopManager";
import type {
  MatchRecord,
  RoundIncome,
  RoundResult,
  ShopBuyResult,
} from "@/core/types";
import { getHero, listHeroKeys } from "@/data/heroes";

// Type-only import keeps `GameState` runtime-free of Phaser; only callers
// that actually use `startCombat` end up pulling Phaser into their graph.
import type { Scene as PhaserScene } from "phaser";

/** Number of competitors in a standard tournament. */
export const PLAYERS_PER_MATCH = 8;

/** Options accepted by `GameState.startNewMatch`. */
export interface StartMatchOptions {
  /**
   * Optional explicit hero assignment. Index `i` is assigned to player id `i`.
   * Must contain `PLAYERS_PER_MATCH` keys when provided.
   *
   * If omitted, heroes are picked at random with replacement from the roster.
   */
  heroKeys?: string[];
  /** Player id (0..PLAYERS_PER_MATCH-1) controlled by the human. Defaults to 0. */
  humanPlayerId?: number;
  /** Starting per-match gold for every player. Defaults to 3. */
  startingGold?: number;
}

/**
 * Singleton holding all global, run-wide state for the autobattler.
 *
 * Owns the persistent meta-game (player gold, cosmetic gems, match history)
 * **and** the in-progress match (8 players, current round). Access via
 * `GameState.instance`.
 *
 * Designed for incremental expansion — add new fields here as features land,
 * and update `reset()` and `toJSON()` accordingly.
 */
export class GameState {
  private static _instance: GameState | null = null;

  // ---- meta-game (persists across matches) ---------------------------------

  /** Soft currency earned from playing matches. Used for unlocks. */
  public playerGold: number = 0;

  /** Premium currency for skins, hero unlocks, backgrounds, etc. */
  public cosmeticGems: number = 0;

  /** Append-only log of every completed match this session/save. */
  public readonly matchHistory: MatchRecord[] = [];

  // ---- current match (resets on `startNewMatch`) ---------------------------

  public players: Player[] = [];
  public currentRound: number = 0;
  public currentMatch: MatchRecord | null = null;
  /** Active upgrade shop for the current match. Null between matches. */
  public currentShop: ShopManager | null = null;

  private constructor() {}

  public static get instance(): GameState {
    if (!GameState._instance) GameState._instance = new GameState();
    return GameState._instance;
  }

  /** Test-only: drop the singleton so a fresh instance is built next access. */
  public static resetInstance(): void {
    GameState._instance = null;
  }

  // -------------------------------------------------------------------------
  // Match lifecycle
  // -------------------------------------------------------------------------

  /**
   * Begin a new match: roll up 8 `Player`s, reset round counters, and open
   * a fresh `MatchRecord`. The previous match (if any) is left in
   * `matchHistory` if it was already finalized via `endMatch()`.
   */
  public startNewMatch(options: StartMatchOptions = {}): MatchRecord {
    const humanId = options.humanPlayerId ?? 0;
    const startingGold = options.startingGold ?? 3;
    const heroKeys = options.heroKeys ?? this.rollHeroKeys(PLAYERS_PER_MATCH);

    if (heroKeys.length !== PLAYERS_PER_MATCH) {
      throw new Error(
        `startNewMatch: expected ${PLAYERS_PER_MATCH} hero keys, got ${heroKeys.length}`,
      );
    }

    this.players = heroKeys.map((key, id) =>
      Player.fromHero(id, getHero(key), {
        isHuman: id === humanId,
        gold: startingGold,
      }),
    );

    this.currentRound = 1;
    this.currentShop = new ShopManager();
    this.currentMatch = {
      matchId: this.makeMatchId(),
      startedAt: Date.now(),
      endedAt: null,
      heroesByPlayerId: Object.fromEntries(
        this.players.map((p) => [p.id, p.heroKey]),
      ),
      rounds: [],
      finalStandings: [],
    };
    return this.currentMatch;
  }

  /**
   * Advance to the next round and return the new round number. Players who
   * have been eliminated (tournamentHP <= 0) are skipped.
   */
  public nextRound(): number {
    if (!this.currentMatch) {
      throw new Error("nextRound: no active match. Call startNewMatch() first.");
    }
    this.currentRound += 1;
    return this.currentRound;
  }

  /** Append a round result to the current match's history. */
  public recordRound(result: RoundResult): void {
    if (!this.currentMatch) {
      throw new Error("recordRound: no active match.");
    }
    this.currentMatch.rounds.push(result);
  }

  /**
   * Finalize the current match: lock in the standings, archive it into
   * `matchHistory`, and clear the live match slot.
   *
   * `finalStandings` should be an array of player ids ordered by placement
   * (index 0 = winner). If omitted, the current alive players are sorted
   * by remaining tournament HP (desc) and used as the standings.
   */
  public endMatch(finalStandings?: number[]): MatchRecord {
    if (!this.currentMatch) {
      throw new Error("endMatch: no active match.");
    }
    const standings =
      finalStandings ??
      [...this.players]
        .sort((a, b) => b.tournamentHP - a.tournamentHP)
        .map((p) => p.id);

    this.currentMatch.finalStandings = standings;
    this.currentMatch.endedAt = Date.now();
    this.matchHistory.push(this.currentMatch);

    const finished = this.currentMatch;
    this.currentMatch = null;
    this.currentShop = null;
    this.players = [];
    this.currentRound = 0;
    return finished;
  }

  // -------------------------------------------------------------------------
  // Round-end flow (gold + shop)
  // -------------------------------------------------------------------------

  /**
   * End the current round for the **human** player: award their round
   * gold (40 win / 20 lose + interest), then advance the round counter.
   *
   * Bot players are awarded gold via `awardRoundIncome()` directly during
   * round-result resolution so the human's UI flow stays focused.
   *
   * Returns the gold breakdown so the UI can animate "+40 win, +3 interest".
   */
  public endRound(wasWin: boolean): RoundIncome {
    const human = this.getHumanPlayer();
    if (!human) {
      throw new Error("endRound: no active match.");
    }
    if (!this.currentShop) {
      throw new Error("endRound: no active shop.");
    }
    const income = this.currentShop.awardRoundIncome(human, wasWin);
    this.nextRound();
    return income;
  }

  /**
   * Award round gold to an arbitrary player (used by the round-resolver
   * for bot players). Does **not** advance the round counter — only
   * `endRound()` and `nextRound()` do that.
   */
  public awardRoundIncome(player: Player, wasWin: boolean): RoundIncome {
    if (!this.currentShop) {
      throw new Error("awardRoundIncome: no active shop.");
    }
    return this.currentShop.awardRoundIncome(player, wasWin);
  }

  // -------------------------------------------------------------------------
  // Combat launch
  // -------------------------------------------------------------------------

  /**
   * Launch the animated `CombatScene` from `fromScene`, fighting the human
   * against the given opponent (or a random eligible bot if omitted).
   *
   * Returns `true` if the scene transition was triggered, `false` if no
   * valid opponent could be picked (caller can fall back to "match over"
   * navigation, e.g. transition to `StandingsScene` themselves).
   *
   * Note: only a **type** import of `phaser` is used here, so consumers
   * that don't call `startCombat` won't pull Phaser into their import graph.
   */
  public startCombat(
    fromScene: PhaserScene,
    options: { opponentId?: number } = {},
  ): boolean {
    const human = this.getHumanPlayer();
    if (!human) {
      throw new Error("startCombat: no human player in the current match.");
    }
    const opponent =
      options.opponentId !== undefined
        ? this.getPlayer(options.opponentId)
        : this.pickRandomOpponent(human.id);

    if (!opponent || opponent.id === human.id || opponent.isEliminated()) {
      return false;
    }

    fromScene.scene.start("CombatScene", {
      humanPlayerId: human.id,
      opponentPlayerId: opponent.id,
      roundNumber: this.currentRound,
    });
    return true;
  }

  /** Pick a random alive player other than `excludeId`. */
  private pickRandomOpponent(excludeId: number): Player | undefined {
    const candidates = this.getAlivePlayers().filter(
      (p) => p.id !== excludeId,
    );
    if (candidates.length === 0) return undefined;
    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx];
  }

  /**
   * Buy an upgrade for the human player via the active shop. The category
   * argument is typed as `string` so it can come straight from a UI button;
   * unknown keys produce a clean `invalid_category` failure rather than
   * a thrown error.
   */
  public buyUpgrade(category: string): ShopBuyResult {
    if (!this.currentShop) {
      throw new Error("buyUpgrade: no active shop.");
    }
    const human = this.getHumanPlayer();
    if (!human) {
      throw new Error("buyUpgrade: no human player.");
    }
    return this.currentShop.buyUpgrade(category, human);
  }

  // -------------------------------------------------------------------------
  // Player accessors
  // -------------------------------------------------------------------------

  public getPlayer(id: number): Player | undefined {
    return this.players.find((p) => p.id === id);
  }

  public getHumanPlayer(): Player | undefined {
    return this.players.find((p) => p.isHuman);
  }

  public getAlivePlayers(): Player[] {
    return this.players.filter((p) => !p.isEliminated());
  }

  // -------------------------------------------------------------------------
  // Currencies (meta-game)
  // -------------------------------------------------------------------------

  public addGold(amount: number): void {
    if (amount <= 0) return;
    this.playerGold += amount;
  }

  public spendGold(amount: number): boolean {
    if (amount <= 0) return true;
    if (this.playerGold < amount) return false;
    this.playerGold -= amount;
    return true;
  }

  public addGems(amount: number): void {
    if (amount <= 0) return;
    this.cosmeticGems += amount;
  }

  public spendGems(amount: number): boolean {
    if (amount <= 0) return true;
    if (this.cosmeticGems < amount) return false;
    this.cosmeticGems -= amount;
    return true;
  }

  // -------------------------------------------------------------------------
  // Reset / serialization
  // -------------------------------------------------------------------------

  /** Wipe **everything**, including currencies and match history. */
  public reset(): void {
    this.playerGold = 0;
    this.cosmeticGems = 0;
    this.matchHistory.length = 0;
    this.players = [];
    this.currentRound = 0;
    this.currentMatch = null;
    this.currentShop = null;
  }

  /** JSON-friendly snapshot of the entire game state. */
  public toJSON(): Record<string, unknown> {
    return {
      playerGold: this.playerGold,
      cosmeticGems: this.cosmeticGems,
      matchHistory: this.matchHistory,
      currentRound: this.currentRound,
      currentMatch: this.currentMatch,
      players: this.players.map((p) => p.toJSON()),
    };
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /** Pick `count` hero keys at random (with replacement) from the roster. */
  private rollHeroKeys(count: number): string[] {
    const all = listHeroKeys();
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * all.length);
      out.push(all[idx]!);
    }
    return out;
  }

  private makeMatchId(): string {
    // Short, monotonic-ish id good enough for client-side bookkeeping.
    return `m_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6)
      .toString(36)
      .padStart(4, "0")}`;
  }
}
