import type {
  CombatEvent,
  CombatEventType,
  CombatSide,
} from "@/core/types";

/**
 * Append-only chronological log of every notable thing that happens during a
 * fight. The `CombatEngine` writes events here as it simulates; the
 * animated `CombatScene` (and AI / replay code) reads them.
 *
 * Intentionally simple — just a typed wrapper around an array — so it can be
 * trivially serialized for replays, AI training data, or save files.
 */
export class CombatLog {
  /** Backing storage. Events are always appended in chronological order. */
  private readonly _events: CombatEvent[] = [];

  // -------------------------------------------------------------------------
  // Writing
  // -------------------------------------------------------------------------

  /** Append a fully-formed event. */
  public add(event: CombatEvent): void {
    this._events.push(event);
  }

  /**
   * Convenience helper: build and append an event in one call.
   * Most engine code reaches for this rather than constructing `CombatEvent`
   * literals by hand.
   */
  public log(
    time: number,
    type: CombatEventType,
    source: CombatSide,
    target: CombatSide,
    extras: {
      value?: number;
      abilityName?: string;
      effectType?: string;
    } = {},
  ): void {
    this._events.push({ time, type, source, target, ...extras });
  }

  // -------------------------------------------------------------------------
  // Reading
  // -------------------------------------------------------------------------

  /** Read-only view of every event recorded so far. */
  public get events(): readonly CombatEvent[] {
    return this._events;
  }

  /** Number of events recorded. */
  public size(): number {
    return this._events.length;
  }

  /** True if no events have been recorded yet. */
  public isEmpty(): boolean {
    return this._events.length === 0;
  }

  /** All events strictly after `fromTime`. Useful for cursor-based playback. */
  public since(fromTime: number): CombatEvent[] {
    return this._events.filter((e) => e.time > fromTime);
  }

  /** All events of the given type(s). */
  public ofType(...types: CombatEventType[]): CombatEvent[] {
    const set = new Set<CombatEventType>(types);
    return this._events.filter((e) => set.has(e.type));
  }

  // -------------------------------------------------------------------------
  // Maintenance
  // -------------------------------------------------------------------------

  /** Drop every event. */
  public clear(): void {
    this._events.length = 0;
  }

  /** Plain-JSON snapshot (just the events array). */
  public toJSON(): CombatEvent[] {
    return [...this._events];
  }

  /**
   * Human-readable dump for `console.log` debugging — e.g.:
   *   `[01.00s] left→right attack value=120.0`
   */
  public toString(): string {
    return this._events
      .map((e) => {
        const ability = e.abilityName ? ` (${e.abilityName})` : "";
        const value = e.value !== undefined ? ` value=${e.value.toFixed(1)}` : "";
        const effect = e.effectType ? ` effect=${e.effectType}` : "";
        return `[${e.time.toFixed(2).padStart(5, "0")}s] ${e.source}→${e.target} ${e.type}${ability}${value}${effect}`;
      })
      .join("\n");
  }
}
