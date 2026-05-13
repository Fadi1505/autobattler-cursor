import type { HeroDefinition } from "@/core/types";

/**
 * Roster of all playable heroes. Designer-tunable data — feel free to add,
 * remove, or rebalance entries without touching the rest of the codebase.
 *
 * Stat philosophy:
 *   - Tanks (`tank`)        → high HP/defense/shield, low evasion/crit.
 *   - Bruisers (`bruiser`)  → solid HP and attack, mid everything else.
 *   - Assassins (`asn`)     → low HP, high attack/crit/evasion.
 *   - Mages (`mage`)        → mid HP, high `manaGain` so ultimates loop fast.
 *
 * Ability philosophy:
 *   - `passive.trigger` is required (`interval` | `onHit` | `onUltimate`)
 *     and `passive.cooldown` is the seconds between ticks for `interval`.
 *   - `ultimate.cooldown` is the seconds between casts; ultimates are
 *     activated automatically when the caster's mana fills up.
 *   - `effects` are processed in order. Default `target` for offensive
 *     effects is `enemy`; default `element` is `physical` if omitted.
 */
export const HEROES: Record<string, HeroDefinition> = {
  // -------------------------------------------------------------------------
  // Mages
  // -------------------------------------------------------------------------
  infernoDrake: {
    key: "infernoDrake",
    name: "Inferno Drake",
    role: "Mage",
    description:
      "An ancient fire dragon whose every breath sets the field ablaze.",
    baseStats: {
      hp: 1100,
      attack: 75,
      defense: 30,
      manaGain: 9,
      evasion: 0.05,
      critChance: 0.15,
      shield: 0,
    },
    passive: {
      name: "Searing Scales",
      description:
        "Each auto-attack ignites the target, dealing 30 fire damage per second for 3s.",
      trigger: "onHit",
      effects: [
        {
          type: "dot",
          value: 30,
          duration: 3,
          element: "fire",
          target: "enemy",
        },
      ],
    },
    ultimate: {
      name: "Inferno Breath",
      description:
        "Unleashes a torrent of dragonfire, dealing 250 fire damage to all enemies.",
      cooldown: 18,
      effects: [
        { type: "damage", value: 250, element: "fire", target: "enemy" },
      ],
    },
  },

  elyndraFrostweaver: {
    key: "elyndraFrostweaver",
    name: "Elyndra Frostweaver",
    role: "Mage",
    description:
      "A reclusive ice mage who weaves spells from glacier-cold winds.",
    baseStats: {
      hp: 1050,
      attack: 70,
      defense: 30,
      manaGain: 10,
      evasion: 0.08,
      critChance: 0.18,
      shield: 50,
    },
    passive: {
      name: "Frostbite",
      description:
        "Auto-attacks chill the target, slowing them by 25% for 2s.",
      trigger: "onHit",
      effects: [
        {
          type: "slow",
          value: 0.25,
          duration: 2,
          element: "ice",
          target: "enemy",
        },
      ],
    },
    ultimate: {
      name: "Blizzard",
      description:
        "Calls down a localized blizzard: 220 ice damage and a 1.5s stun on all enemies.",
      cooldown: 16,
      effects: [
        { type: "damage", value: 220, element: "ice", target: "enemy" },
        {
          type: "stun",
          value: 1,
          duration: 1.5,
          element: "ice",
          target: "enemy",
        },
      ],
    },
  },

  // -------------------------------------------------------------------------
  // Bruisers
  // -------------------------------------------------------------------------
  grommashIronfist: {
    key: "grommashIronfist",
    name: "Grommash Ironfist",
    role: "Bruiser",
    description:
      "A clan-chief barbarian who feeds on pain and pays it back tenfold.",
    baseStats: {
      hp: 1300,
      attack: 85,
      defense: 50,
      manaGain: 6,
      evasion: 0.05,
      critChance: 0.20,
      shield: 0,
    },
    passive: {
      name: "Bloodthirst",
      description:
        "Heals for 15% of all auto-attack damage dealt.",
      trigger: "onHit",
      effects: [
        {
          type: "lifesteal",
          value: 0.15,
          element: "physical",
          target: "self",
        },
      ],
    },
    ultimate: {
      name: "Berserker Rage",
      description:
        "Slams the front line for 200 physical damage and gains +50 attack for 6s.",
      cooldown: 15,
      effects: [
        { type: "damage", value: 200, element: "physical", target: "enemy" },
        { type: "buff", value: 50, duration: 6, target: "self" },
      ],
    },
  },

  ragnokStormlord: {
    key: "ragnokStormlord",
    name: "Ragnok Stormlord",
    role: "Bruiser",
    description:
      "A storm-giant whose footsteps crack the sky with thunder.",
    baseStats: {
      hp: 1200,
      attack: 80,
      defense: 45,
      manaGain: 7,
      evasion: 0.05,
      critChance: 0.18,
      shield: 50,
    },
    passive: {
      name: "Static Discharge",
      description:
        "Every 4s, electricity arcs to a random enemy for 60 lightning damage.",
      trigger: "interval",
      cooldown: 4,
      effects: [
        { type: "damage", value: 60, element: "lightning", target: "enemy" },
      ],
    },
    ultimate: {
      name: "Thunderstorm",
      description:
        "Calls a thunderstorm onto all enemies for 280 lightning damage and a 1.2s stun.",
      cooldown: 19,
      effects: [
        {
          type: "damage",
          value: 280,
          element: "lightning",
          target: "enemy",
        },
        {
          type: "stun",
          value: 1,
          duration: 1.2,
          element: "lightning",
          target: "enemy",
        },
      ],
    },
  },

  // -------------------------------------------------------------------------
  // Tanks
  // -------------------------------------------------------------------------
  thrainStonebeard: {
    key: "thrainStonebeard",
    name: "Thrain Stonebeard",
    role: "Tank",
    description:
      "A dwarven shield-master, immovable as the mountain that bore him.",
    baseStats: {
      hp: 1250,
      attack: 60,
      defense: 80,
      manaGain: 5,
      evasion: 0.05,
      critChance: 0.05,
      shield: 200,
    },
    passive: {
      name: "Stone Skin",
      description:
        "Every 5s, regenerates a 50-point shield.",
      trigger: "interval",
      cooldown: 5,
      effects: [{ type: "shield", value: 50, target: "self" }],
    },
    ultimate: {
      name: "Earthen Bulwark",
      description:
        "Plants a 400-point shield on himself for 8s and stuns the front rank for 2s.",
      cooldown: 20,
      effects: [
        { type: "shield", value: 400, duration: 8, target: "self" },
        {
          type: "stun",
          value: 1,
          duration: 2,
          element: "physical",
          target: "enemy",
        },
      ],
    },
  },

  obsidianGolem: {
    key: "obsidianGolem",
    name: "Obsidian Golem",
    role: "Tank",
    description:
      "A construct of black volcanic glass, hardened by every blow it takes.",
    baseStats: {
      hp: 1300,
      attack: 65,
      defense: 90,
      manaGain: 4,
      evasion: 0.0,
      critChance: 0.05,
      shield: 300,
    },
    passive: {
      name: "Obsidian Body",
      description:
        "Every incoming hit grants a 20-point shield, hardening the golem in real time.",
      trigger: "onHit",
      effects: [{ type: "shield", value: 20, target: "self" }],
    },
    ultimate: {
      name: "Quake",
      description:
        "Crushes the ground for 220 physical damage to all enemies and slows them by 40% for 4s.",
      cooldown: 22,
      effects: [
        { type: "damage", value: 220, element: "physical", target: "enemy" },
        {
          type: "slow",
          value: 0.4,
          duration: 4,
          element: "physical",
          target: "enemy",
        },
      ],
    },
  },

  // -------------------------------------------------------------------------
  // Assassins
  // -------------------------------------------------------------------------
  shadowveil: {
    key: "shadowveil",
    name: "Shadowveil",
    role: "Assassin",
    description:
      "A cloaked rogue who slips between shadows and arteries with equal ease.",
    baseStats: {
      hp: 1000,
      attack: 90,
      defense: 25,
      manaGain: 9,
      evasion: 0.25,
      critChance: 0.30,
      shield: 0,
    },
    passive: {
      name: "Shadow Step",
      description:
        "Every 6s, briefly phases out — gains +50% evasion for 1.5s.",
      trigger: "interval",
      cooldown: 6,
      effects: [
        { type: "buff", value: 0.5, duration: 1.5, target: "self" },
      ],
    },
    ultimate: {
      name: "Assassinate",
      description:
        "Strikes the lowest-HP enemy for 350 physical damage as a guaranteed crit.",
      cooldown: 14,
      effects: [
        { type: "damage", value: 350, element: "physical", target: "enemy" },
      ],
    },
  },

  vexVenomfang: {
    key: "vexVenomfang",
    name: "Vex Venomfang",
    role: "Assassin",
    description:
      "A serpent-blooded duelist whose blades are slick with apothecary's dread.",
    baseStats: {
      hp: 1050,
      attack: 80,
      defense: 30,
      manaGain: 8,
      evasion: 0.20,
      critChance: 0.22,
      shield: 0,
    },
    passive: {
      name: "Toxic Strike",
      description:
        "Auto-attacks apply venom: 25 poison damage per second for 4s (stacks).",
      trigger: "onHit",
      effects: [
        {
          type: "dot",
          value: 25,
          duration: 4,
          element: "poison",
          target: "enemy",
        },
      ],
    },
    ultimate: {
      name: "Death's Embrace",
      description:
        "Plunges both daggers into the target: 180 poison + 60/s poison for 5s, and heals self for 100.",
      cooldown: 17,
      effects: [
        { type: "damage", value: 180, element: "poison", target: "enemy" },
        {
          type: "dot",
          value: 60,
          duration: 5,
          element: "poison",
          target: "enemy",
        },
        { type: "heal", value: 100, target: "self" },
      ],
    },
  },
};

/** Strict union of all defined hero keys — useful for typed lookups. */
export type HeroKey = keyof typeof HEROES;

/** Throw-on-miss lookup for a hero by key. */
export function getHero(key: string): HeroDefinition {
  const hero = HEROES[key];
  if (!hero) throw new Error(`Unknown hero key: "${key}"`);
  return hero;
}

/** All heroes as an array (handy for rosters, drafts, UI). */
export function listHeroes(): HeroDefinition[] {
  return Object.values(HEROES);
}

/** All hero keys as an array. */
export function listHeroKeys(): HeroKey[] {
  return Object.keys(HEROES) as HeroKey[];
}
