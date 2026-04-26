import type { Player } from './player';
import type { WeaponSystem } from './weapons';
import { WEAPON_DEFS } from './weapons';
import { ICONS } from '../ui/icons';

export interface UpgradeOption {
  id: string;
  name: string;
  tag: string;       // small subtitle like "NEW WEAPON" or "POWER"
  icon: string;
  desc: string;
  apply: () => void;
}

export function rollUpgradeOptions(player: Player, weapons: WeaponSystem, count = 3): UpgradeOption[] {
  const pool: UpgradeOption[] = [];

  // weapon unlocks
  if (!weapons.has('pistol')) {
    pool.push({
      id: 'unlock-pistol', name: WEAPON_DEFS.pistol.name, tag: 'New Acquaintance',
      icon: ICONS.pistol,
      desc: 'Fires bullets, but politely. Has a "ker-pow" sound it makes itself.',
      apply: () => weapons.add('pistol'),
    });
  }
  if (!weapons.has('shockwave')) {
    pool.push({
      id: 'unlock-shockwave', name: WEAPON_DEFS.shockwave.name, tag: 'New Acquaintance',
      icon: ICONS.shockwave,
      desc: 'A noise so dreadful it pushes monsters away. Notify the neighbours.',
      apply: () => weapons.add('shockwave'),
    });
  }
  if (!weapons.has('lightning')) {
    pool.push({
      id: 'unlock-lightning', name: WEAPON_DEFS.lightning.name, tag: 'New Acquaintance',
      icon: ICONS.lightning,
      desc: 'Hops from one bad-decision-maker to the next. Crowd-pleaser.',
      apply: () => weapons.add('lightning'),
    });
  }
  if (!weapons.has('boomerang')) {
    pool.push({
      id: 'unlock-boomerang', name: WEAPON_DEFS.boomerang.name, tag: 'New Acquaintance',
      icon: ICONS.boomerang,
      desc: 'Throw it. It will, contractually, return. The Guild insist.',
      apply: () => weapons.add('boomerang'),
    });
  }

  // weapon upgrades (only if owned and below max)
  for (const k of ['blades', 'pistol', 'shockwave', 'lightning', 'boomerang'] as const) {
    if (weapons.has(k)) {
      const lvl = weapons.level(k);
      const def = WEAPON_DEFS[k];
      if (lvl < def.maxLevel) {
        pool.push({
          id: `upgrade-${k}`, name: `${def.name} +1`,
          tag: `Lv ${lvl} → ${lvl + 1}`, icon: ICONS[k], desc: def.desc(lvl + 1),
          apply: () => weapons.upgrade(k),
        });
      }
    }
  }

  // stat upgrades
  pool.push({ id: 'stat-hp', name: 'More Liver, Same Person', tag: 'Vitality', icon: ICONS.hp,
    desc: 'Adds twenty health via methods Best Not Examined Too Closely. May involve a goat.',
    apply: () => { player.stats.maxHp += 20; player.heal(20); } });
  pool.push({ id: 'stat-speed', name: 'Brisk Locomotion', tag: 'Agility', icon: ICONS.speed,
    desc: 'You are now ten percent more brisk. Your shoes have not been informed.',
    apply: () => { player.stats.moveSpeed *= 1.1; } });
  pool.push({ id: 'stat-magnet', name: 'A Sense of Coin', tag: 'Greed', icon: ICONS.magnet,
    desc: 'Glittery objects nearby decide they have always wanted to be yours.',
    apply: () => { player.stats.magnetRadius += 1; } });
  pool.push({ id: 'stat-damage', name: 'Slightly Pointier', tag: 'Vehemence', icon: ICONS.damage,
    desc: 'Everything you hit is hit ten percent more. Mathematicians remain unimpressed.',
    apply: () => { player.stats.damageMult *= 1.1; } });
  pool.push({ id: 'stat-cd', name: 'Less Waiting About', tag: 'Haste', icon: ICONS.cooldown,
    desc: 'Eight percent less waiting between things. Try queuing for anything; you will see.',
    apply: () => { player.stats.cooldownMult = Math.max(0.5, player.stats.cooldownMult * 0.92); } });
  pool.push({ id: 'stat-heal', name: 'A Stiff Drink', tag: 'Recovery', icon: ICONS.heal,
    desc: 'Restores all missing health by drinking something one absolutely should not drink.',
    apply: () => { player.heal(player.stats.maxHp); } });

  // shuffle and pick `count`
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}
