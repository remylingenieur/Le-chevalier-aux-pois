// Minimal Zelda-like prototype (top-down / slightly platformy feel)
const canvas = document.getElementById('game');
canvas.width = 960;
canvas.height = 640;
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// Input initialization

// --- Input ---
const keys = {};
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; e.preventDefault && e.preventDefault(); });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

// touch controls bindings
function bindTouchControls(){
  const tc = document.getElementById('touch-controls'); if (!tc) return;
  const map = {
    'btn-left': ['arrowleft','a'],
    'btn-right': ['arrowright','d'],
    'btn-jump': ['w','arrowup',' '],
    'btn-attack': ['z','k'],
    'btn-shoot': ['x','j']
  };
  for (const cls in map){
    const btn = tc.querySelector('.'+cls);
    if (!btn) continue;
    btn.addEventListener('touchstart', (ev)=>{ ev.preventDefault(); for (const k of map[cls]) keys[k]=true; }, {passive:false});
    btn.addEventListener('touchend', (ev)=>{ ev.preventDefault(); for (const k of map[cls]) keys[k]=false; }, {passive:false});
    btn.addEventListener('mousedown', ()=>{ for (const k of map[cls]) keys[k]=true; });
    btn.addEventListener('mouseup', ()=>{ for (const k of map[cls]) keys[k]=false; });
    btn.addEventListener('mouseleave', ()=>{ for (const k of map[cls]) keys[k]=false; });
  }
}
window.addEventListener('load', bindTouchControls);

// --- World / Camera (top-down world)
const world = {
  width: 2400,
  height: 1600
};

// --- Equipment & Items System ---
const ITEM_TYPES = {
  WEAPON: 'weapon',
  BOW: 'bow',
  SHIELD: 'shield',
  ARMOR: 'armor',
  CONSUMABLE: 'consumable'
};

const SHOP_INVENTORY = [
  { itemId: 'wooden_sword', price: 100 },
  { itemId: 'iron_sword', price: 250 },
  { itemId: 'short_bow', price: 150 },
  { itemId: 'long_bow', price: 300 },
  { itemId: 'wooden_shield', price: 120 },
  { itemId: 'iron_shield', price: 280 },
  { itemId: 'leather_armor', price: 200 }
];

const ITEMS_DATABASE = {
  wooden_sword: {
    id: 'wooden_sword',
    name: "Wooden Sword",
    type: ITEM_TYPES.WEAPON,
    damage: 1,
    attackSpeed: 1.0,
    swingArc: Math.PI * 0.6,
    attackRadius: 56,
    description: "A basic wooden sword",
    price: 100
  },
  iron_sword: {
    id: 'iron_sword',
    name: "Iron Sword",
    type: ITEM_TYPES.WEAPON,
    damage: 2,
    attackSpeed: 1.2,
    swingArc: Math.PI * 0.7,
    attackRadius: 60,
    description: "Stronger than wood, but still quite common"
  },
  short_bow: {
    id: 'short_bow',
    name: "Short Bow",
    type: ITEM_TYPES.BOW,
    damage: 1,
    projectileSpeed: 680,
    cooldown: 0.45,
    description: "A simple short bow"
  },
  long_bow: {
    id: 'long_bow',
    name: "Long Bow",
    type: ITEM_TYPES.BOW,
    damage: 2,
    projectileSpeed: 780,
    cooldown: 0.6,
    description: "Slower but more powerful"
  },
  wooden_shield: {
    id: 'wooden_shield',
    name: "Wooden Shield",
    type: ITEM_TYPES.SHIELD,
    defense: 1,
    durability: 100,
    description: "Basic protection against attacks"
  },
  iron_shield: {
    id: 'iron_shield',
    name: "Iron Shield",
    type: ITEM_TYPES.SHIELD,
    defense: 2,
    durability: 200,
    description: "Sturdy protection"
  },
  leather_armor: {
    id: 'leather_armor',
    name: "Leather Armor",
    type: ITEM_TYPES.ARMOR,
    defense: 1,
    description: "Light protection"
  }
};

// --- Player ---
const player = {
  x: 200, y: 400, w: 36, h: 52,
  vx: 0, vy: 0,
  // top-down movement
  speed: 180,
  dashSpeed: 540,
  dashCooldown: 0,
  dashTimer: 0,
  onGround: true,
  color: '#1e8f6e',
  // facing vector (normalized)
  fx: 1, fy: 0,
  health: 5, maxHealth: 5,
  // attackTimer: active frames while the swing can hit; attackCooldown: time until next swing allowed
  attackTimer: 0, attackCooldown: 0,
  // invulnerability after taking damage
  invuln: 0,
  // shooting
  shootCooldown: 0,
  // Equipment slots
  equipment: {
    weapon: ITEMS_DATABASE.wooden_sword,
    bow: ITEMS_DATABASE.short_bow,
    shield: null,
    armor: null
  },
  // Inventory (array of item IDs)
  inventory: ['wooden_sword', 'short_bow'],
  // Current equipment stats (calculated from equipment)
  stats: {
    attack: 1,
    defense: 0,
    attackSpeed: 1.0
  },
  // Gold/currency
  gold: 0
};

// enemies (will be spawned per-level)
const enemies = [];

// Loot tables
const LOOT_TABLES = {
  tier1: [ // Common enemies
    { item: 'wooden_sword', chance: 0.05 },
    { item: 'short_bow', chance: 0.05 },
    { item: 'wooden_shield', chance: 0.05 },
    { gold: [5, 15], chance: 0.8 }
  ],
  tier2: [ // Stronger enemies
    { item: 'iron_sword', chance: 0.08 },
    { item: 'wooden_shield', chance: 0.1 },
    { item: 'leather_armor', chance: 0.08 },
    { gold: [15, 30], chance: 0.9 }
  ],
  tier3: [ // Elite enemies
    { item: 'iron_sword', chance: 0.15 },
    { item: 'long_bow', chance: 0.12 },
    { item: 'iron_shield', chance: 0.12 },
    { item: 'leather_armor', chance: 0.15 },
    { gold: [30, 50], chance: 1 }
  ],
  boss: [ // Boss drops
    { item: 'iron_sword', chance: 0.5 },
    { item: 'long_bow', chance: 0.5 },
    { item: 'iron_shield', chance: 0.5 },
    { item: 'leather_armor', chance: 0.5 },
    { gold: [100, 200], chance: 1 }
  ]
};

// enemy templates (tiers)
const enemyTemplates = {
  goblin: { 
    w:36, h:48, baseHp:1, baseVx:40, color:'#7fc97f', tier:1,
    lootTable: 'tier1'
  },
  wolf: { 
    w:40, h:44, baseHp:2, baseVx:60, color:'#fdb462', tier:2,
    lootTable: 'tier2'
  },
  armored: { 
    w:44, h:50, baseHp:4, baseVx:30, color:'#bdbdbd', tier:3, armor:1,
    lootTable: 'tier3'
  },
  boss: { 
    w:96, h:96, baseHp:12, baseVx:22, color:'#ff6961', tier:4, boss:true,
    lootTable: 'boss'
  }
};

// level state
let currentLevel = 1;
let levelTransitionTimer = 0; // delay before spawning next level
let awaitingNextLevel = false;
// level menu and progression
const maxLevels = 15;
let unlockedLevels = 1;
let menuOpen = true; // start showing menu

function loadUnlocked(){
  try{ const v = parseInt(localStorage.getItem('zelda_unlocked')||'1',10); unlockedLevels = Math.max(1, Math.min(maxLevels, isNaN(v)?1:v)); }catch(e){ unlockedLevels = 1; }
}
function saveUnlocked(){ try{ localStorage.setItem('zelda_unlocked', String(unlockedLevels)); }catch(e){}
}

// projectiles and items
const projectiles = [];
const items = [];

// audio (basic WebAudio feedback)
let audioCtx = null;
function ensureAudio(){ if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function playBeep(freq=440, len=0.08, type='sine', vol=0.12){ try{ ensureAudio(); const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = vol; o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + len); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + len); }catch(e){} }
function playHit(){ playBeep(960,0.06,'square',0.14); }
function playJump(){ playBeep(520,0.06,'sine',0.12); }
function playPickup(){ playBeep(720,0.08,'triangle',0.16); }
function playShoot(){ playBeep(820,0.06,'sawtooth',0.12); }

// Camera
const camera = { x:0, y:0, w: W, h: H };

// Physics / movement constants (top-down)
const FRICTION = 0.92;

// Simple rectangle collision helper
function rectsOverlap(a,b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function applyPhysics(dt){
  // top-down movement: read axis
  let sx = 0, sy = 0;
  if (keys['arrowleft'] || keys['a']) sx -= 1;
  if (keys['arrowright'] || keys['d']) sx += 1;
  if (keys['arrowup'] || keys['w']) sy -= 1;
  if (keys['arrowdown'] || keys['s']) sy += 1;

  // normalize
  const len = Math.hypot(sx, sy) || 1;
  const nx = sx / len, ny = sy / len;

  // facing set to last movement direction when moving
  if (Math.abs(sx) > 0 || Math.abs(sy) > 0) { player.fx = nx; player.fy = ny; }

  // dash
  if ((keys[' '] || keys['shift']) && player.dashCooldown <= 0 && player.dashTimer <= 0) {
    player.dashTimer = 0.18; player.dashCooldown = 0.8;
  }

  // compute velocity
  let speed = player.speed;
  if (player.dashTimer > 0) speed = player.dashSpeed;
  player.vx = nx * speed; player.vy = ny * speed;

  // integrate position
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // decays
  if (player.dashTimer > 0) player.dashTimer = Math.max(0, player.dashTimer - dt);
  if (player.dashCooldown > 0) player.dashCooldown = Math.max(0, player.dashCooldown - dt);

  // keep in world
  player.x = Math.max(8, Math.min(world.width - player.w - 8, player.x));
  player.y = Math.max(8, Math.min(world.height - player.h - 8, player.y));
}

function spawnProjectile(x, y, vx, vy) {
  projectiles.push({ x: x, y: y, w: 20, h: 24, vx: vx, vy: vy, life: 2 });
}

function updateProjectiles(dt){
  for (let i = projectiles.length-1; i >=0; --i){
    const p = projectiles[i];
    p.x += (p.vx||0) * dt;
    p.y += (p.vy||0) * dt;
    p.life -= dt;
    // remove out of world
    if (p.life <= 0 || p.x < 0 || p.x > world.width) { projectiles.splice(i,1); continue; }
    // check collision with enemies
    for (let e of enemies){
      if (!e.alive) continue;
      if (rectsOverlap(p,e)){
        // damage via function (accounts for armor)
        damageEnemy(e, 1, true);
        // destroy projectile
        projectiles.splice(i,1);
        break;
      }
    }
  }
}

// find a safe spawn position on a platform away from the player
function findSafeSpawnPos(template){
  const safeDist = 220;
  const w = template.w || 32; const h = template.h || 32;
  for (let attempt=0; attempt<120; attempt++){
    const sx = Math.floor(50 + Math.random() * (world.width - 100));
    const sy = Math.floor(50 + Math.random() * (world.height - 100));
    if (Math.hypot(sx - player.x, sy - player.y) > safeDist) return { x: sx, y: sy };
  }
  // fallback: opposite side of player
  const fx = player.fx || 1;
  const fy = player.fy || 0;
  const fallbackX = Math.max(20, Math.min(world.width - w - 20, player.x - fx * 300));
  const fallbackY = Math.max(20, Math.min(world.height - h - 20, player.y - fy * 300));
  return { x: fallbackX, y: fallbackY };
}

function generateLoot(enemy) {
  const lootTable = LOOT_TABLES[enemy.lootTable];
  if (!lootTable) return;

  for (const loot of lootTable) {
    if (Math.random() < loot.chance) {
      if (loot.item) {
        items.push({
          x: enemy.x + enemy.w/2 - 8,
          y: enemy.y + enemy.h/2 - 8,
          w: 16,
          h: 16,
          type: 'item',
          itemId: loot.item,
          showValue: ITEMS_DATABASE[loot.item].name
        });
      } else if (loot.gold) {
        const amount = Math.floor(Math.random() * (loot.gold[1] - loot.gold[0])) + loot.gold[0];
        items.push({
          x: enemy.x + enemy.w/2 - 8,
          y: enemy.y + enemy.h/2 - 8,
          w: 16,
          h: 16,
          type: 'gold',
          amount: amount,
          showValue: amount + ' gold'
        });
      }
    }
  }
}

function damageEnemy(e, dmg, fromProjectile=false){
  if (!e.alive || e.hitCooldown > 0) return;
  // armor reduces damage by its value
  const actual = Math.max(1, dmg - (e.armor||0));
  e.health -= actual;
  e.hitCooldown = 0.25;
  playHit();
  // knockback
  e.x += (player.fx||1) * 18;
  e.y += (player.fy||0) * 18;
  if (e.health <= 0){
    e.alive = false;
    // Generate loot
    generateLoot(e);
    // spawn a heart sometimes (higher-tier enemies drop less often)
    if (Math.random() < 0.7 - (e.tier||1)*0.15){
      items.push({ x: e.x + (e.w||24)/2 - 8, y: e.y + (e.h||24)/2 - 8, w:16, h:16, type:'heart' });
    }
    // if boss died, mark awaiting next level quickly
    if (e.boss){ awaitingNextLevel = true; levelTransitionTimer = 1.0; }
  }
}

function updateItems(dt){
  for (let i = items.length-1; i>=0; --i){
    const it = items[i];
    // bobbing effect
    it._bob = (it._bob||0) + dt * 6;
    // pickup by proximity
    const dx = (it.x + it.w/2) - (player.x + player.w/2);
    const dy = (it.y + it.h/2) - (player.y + player.h/2);
    if (Math.hypot(dx,dy) < 28){
      if (it.type === 'heart'){ 
        player.health = Math.min(player.maxHealth, player.health + 1); 
        playPickup(); 
      }
      else if (it.type === 'gold') {
        player.gold += it.amount;
        playPickup();
      }
      else if (it.type === 'item' && it.itemId) {
        addToInventory(it.itemId);
        playPickup();
      }
      items.splice(i,1); continue;
    }
    // remove if out of bounds
    if (it.x < -200 || it.x > world.width + 200 || it.y < -200 || it.y > world.height + 200) items.splice(i,1);
  }
}

// spawn helpers
function spawnEnemyFromTemplate(templateName, x, y){
  const t = enemyTemplates[templateName];
  if (!t) return;
  let pos = null;
  if (typeof x === 'number' && typeof y === 'number') pos = { x: x, y: y };
  else pos = findSafeSpawnPos(t);
  const e = {
    x: pos.x, y: pos.y, w: t.w, h: t.h,
    // 2D velocity and speed
    vx: (Math.random()<0.5? -1:1) * t.baseVx * 0.5,
    vy: (Math.random()<0.5? -1:1) * t.baseVx * 0.5,
    speed: t.baseVx,
    roamRadius: 180,
    roamCenterX: pos.x, roamCenterY: pos.y,
    color: t.color, alive:true, health: t.baseHp, hitCooldown:0, armor: t.armor || 0, tier: t.tier || 1,
    boss: !!t.boss,
    // reference to the loot table name for drops
    lootTable: t.lootTable || null
  };
  enemies.push(e);
  return e;
}

function spawnLevel(level){
  enemies.length = 0; items.length = 0; projectiles.length = 0;
  currentLevel = level;
  awaitingNextLevel = false; levelTransitionTimer = 0;
  // place player at a safe starting position (left area)
  const startX = Math.max(40, Math.min(world.width - player.w - 40, Math.floor(world.width * 0.12)));
  const startY = Math.floor(world.height/2);
  player.x = startX; player.y = startY;
  player.vx = 0; player.vy = 0;
  // hide menu if open
  hideMenu();
  // boss every 5 levels
  if (level % 5 === 0){
    // boss in center
    const bx = Math.min(world.width-200, Math.max(200, Math.floor(world.width/2)));
    const by = 300;
    const boss = spawnEnemyFromTemplate('boss', bx, by);
    if (boss){ boss.health = enemyTemplates.boss.baseHp + Math.floor(level/5)*4; boss.vx = enemyTemplates.boss.baseVx; }
    // small minions around
    for (let i=0;i<3 + Math.floor(level/5); i++){ spawnEnemyFromTemplate('wolf', bx - 160 + i*80, by + 80); }
    return;
  }

  // normal level: spawn mixture depending on level with more enemies
  const baseCount = 8 + Math.min(15, Math.floor(level * 1.2));
  
  // Diviser la carte en secteurs pour une meilleure distribution
  const sectors = [
    {x: world.width * 0.2, y: world.height * 0.2}, // haut gauche
    {x: world.width * 0.8, y: world.height * 0.2}, // haut droite
    {x: world.width * 0.2, y: world.height * 0.8}, // bas gauche
    {x: world.width * 0.8, y: world.height * 0.8}, // bas droite
    {x: world.width * 0.5, y: world.height * 0.5}, // centre
  ];

  // Spawn enemies in each sector
  for (const sector of sectors) {
    const sectorCount = Math.floor(baseCount / 3); // Nombre d'ennemis par secteur
    for (let i = 0; i < sectorCount; i++) {
      const r = Math.random();
      let type = 'goblin';
      // Augmentation des chances d'ennemis plus forts
      if (r < Math.min(0.3, level*0.03)) type = 'armored';
      else if (r < Math.min(0.5, level*0.06)) type = 'wolf';
      
      // Spawn near sector center with some randomness
      const offsetX = (Math.random() - 0.5) * 400;
      const offsetY = (Math.random() - 0.5) * 400;
      const e = spawnEnemyFromTemplate(type, 
        Math.max(50, Math.min(world.width-50, sector.x + offsetX)),
        Math.max(50, Math.min(world.height-50, sector.y + offsetY))
      );
      
      // Scale hp and speed with level
      if (e) {
        e.health += Math.floor(level*0.15);
        e.speed *= (1 + Math.min(0.5, level*0.02)); // Légère augmentation de vitesse avec le niveau
      }
    }
  }
}

function updateEnemies(dt){
  for (let e of enemies) {
    if (!e.alive) continue;

    // reduce hit cooldown
    if (e.hitCooldown > 0) e.hitCooldown = Math.max(0, e.hitCooldown - dt);

    // basic 2D AI: chase player if close, otherwise roam
    const px = player.x + player.w/2, py = player.y + player.h/2;
    const ex = e.x + e.w/2, ey = e.y + e.h/2;
    const dx = px - ex, dy = py - ey; const dist = Math.hypot(dx,dy);
    const aggro = 200 + (e.tier||1)*30;
    if (dist < aggro) {
      const nx = dx / (dist || 1), ny = dy / (dist || 1);
      e.vx = nx * e.speed; e.vy = ny * e.speed;
    } else {
      e._roamTimer = (e._roamTimer || 0) - dt;
      if (e._roamTimer <= 0) {
        e._roamTimer = 1 + Math.random()*2.5;
        const ang = Math.random() * Math.PI*2;
        e.vx = Math.cos(ang) * (e.speed * 0.45);
        e.vy = Math.sin(ang) * (e.speed * 0.45);
      }
      // gentle pull towards roam center
      const bx = e.roamCenterX - ex, by = e.roamCenterY - ey;
      e.vx += bx * 0.002; e.vy += by * 0.002;
    }

    // integrate
    e.x += e.vx * dt; e.y += e.vy * dt;
    e.x = Math.max(4, Math.min(world.width - e.w - 4, e.x));
    e.y = Math.max(4, Math.min(world.height - e.h - 4, e.y));

    // if player is attacking and within arc, damage
    if (player.attackTimer > 0 && e.hitCooldown === 0) {
      const cx = player.x + player.w/2, cy = player.y + player.h/2;
      const ex2 = e.x + e.w/2, ey2 = e.y + e.h/2;
      const dx2 = ex2 - cx, dy2 = ey2 - cy; const d2 = Math.hypot(dx2,dy2);
      const attackRadius = 56;
      if (d2 <= attackRadius) {
        const dot = (dx2*(player.fx||1) + dy2*(player.fy||0)) / Math.max(1, d2);
        const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
        const arc = Math.PI * 0.6;
        if (angle <= arc/2) damageEnemy(e, 1, false);
      }
    }

    // contact damage
    if (Math.hypot((player.x+player.w/2)-(e.x+e.w/2), (player.y+player.h/2)-(e.y+e.h/2)) < 28 && e.alive) {
      if (player.invuln <= 0) {
        player.health = Math.max(0, player.health - 1);
        player.invuln = 1.0;
        const kx = (player.x - e.x) || 1, ky = (player.y - e.y) || 0;
        const kn = Math.hypot(kx,ky) || 1; player.x += (kx/kn) * 28; player.y += (ky/kn) * 28;
        playHit();
      }
    }

    // boss special behavior
    if (e.boss) {
      e.specialTimer = (e.specialTimer || 0) - dt;
      if (e.specialTimer <= 0) {
        e.specialTimer = 3.0 - Math.min(2.0, currentLevel*0.08);
        const pos = { x: e.x + (Math.random()<0.5? -80 : 80), y: e.y + (Math.random()*80-40) };
        spawnEnemyFromTemplate('wolf', pos.x, pos.y);
      }
    }
  }
  }

function updateCamera(){
  // Position cible centrée sur le joueur
  const targetX = Math.floor(player.x + player.w/2 - camera.w/2);
  const targetY = Math.floor(player.y + player.h/2 - camera.h/2);
  
  // Mouvement fluide avec arrondi pour éviter le flou des pixels
  camera.x = Math.floor(camera.x + (targetX - camera.x) * 0.12);
  camera.y = Math.floor(camera.y + (targetY - camera.y) * 0.12);
  
  // Limites du monde
  camera.x = Math.max(0, Math.min(world.width - camera.w, camera.x));
  camera.y = Math.max(0, Math.min(world.height - camera.h, camera.y));
}

let last = 0;
function loop(t){
  const dt = Math.min(1/30, (t - last)/1000 || 0);
  last = t;
  // when the menu is open, pause updates (menu overlay handles selection)
  if (!menuOpen) {
    // update
    applyPhysics(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateItems(dt);
    updateCamera();

    // attack logic (press Z or k)
    if ((keys['z'] || keys['k']) && player.attackCooldown <= 0) {
      player.attackTimer = 0.18; // active hit frames
      player.attackCooldown = 0.4; // until next allowed
    }
    if (player.attackTimer > 0) player.attackTimer = Math.max(0, player.attackTimer - dt);
    if (player.attackCooldown > 0) player.attackCooldown = Math.max(0, player.attackCooldown - dt);

    // shoot logic (X or J)
    if ((keys['x'] || keys['j']) && player.shootCooldown <= 0){
      const sx = player.x + (player.fx * (player.w/2 + 8));
      const sy = player.y + (player.fy * (player.h/2 + 8));
      const sv = 680;
      spawnProjectile(sx, sy, player.fx * sv, player.fy * sv);
      player.shootCooldown = 0.45;
      playShoot();
    }
    if (player.shootCooldown > 0) player.shootCooldown = Math.max(0, player.shootCooldown - dt);

    // invulnerability timer
    if (player.invuln > 0) player.invuln = Math.max(0, player.invuln - dt);

    // restart if dead
    if (player.health <= 0) {
      if (keys['r']) restart();
    }

    // level progression: if no enemies alive, begin transition
    if (!awaitingNextLevel) {
      const anyAlive = enemies.some(e=> e.alive);
      if (!anyAlive) { awaitingNextLevel = true; levelTransitionTimer = 1.2; }
    } else {
      levelTransitionTimer -= dt;
      if (levelTransitionTimer <= 0){ currentLevel++; spawnLevel(currentLevel); unlockedLevels = Math.max(unlockedLevels, currentLevel); saveUnlocked(); buildLevelButtons(); }
    }
  }

  // render
  render();
  requestAnimationFrame(loop);
}

// hook new updates into game loop
// call updateProjectiles and updateItems each frame by wrapping loop or inserting calls earlier

// hook new updates into game loop
// call updateProjectiles and updateItems each frame by wrapping loop or inserting calls earlier

function restart(){
  // reset player
  player.x = 200; player.y = 400; player.vx = 0; player.vy = 0;
  player.health = player.maxHealth; player.invuln = 0; player.attackTimer = 0; player.attackCooldown = 0;
  // restart level progression
  currentLevel = 1;
  spawnLevel(currentLevel);
}

function worldToScreen(x,y){ return { x: x - camera.x, y: y - camera.y }; }

function render(){
  // Fond de ciel fixe
  ctx.fillStyle = '#4a708b';
  ctx.fillRect(0, 0, W, H);

  // Grille de sol avec motif en damier
  const TILE = 64; // taille des tuiles
  
  // Calcul des tuiles visibles dans la vue actuelle
  const viewStartX = Math.floor(camera.x / TILE);
  const viewStartY = Math.floor(camera.y / TILE);
  const viewEndX = Math.ceil((camera.x + W) / TILE);
  const viewEndY = Math.ceil((camera.y + H) / TILE);
  
  // Rendu des tuiles visibles uniquement
  for (let tx = viewStartX; tx <= viewEndX; tx++) {
    for (let ty = viewStartY; ty <= viewEndY; ty++) {
      // Position à l'écran
      const screenX = tx * TILE - Math.floor(camera.x);
      const screenY = ty * TILE - Math.floor(camera.y);
      
      // Motif en damier basé sur la position monde
      const isAlt = (tx + ty) % 2 === 0;
      ctx.fillStyle = isAlt ? '#2d633c' : '#244f30';
      
      // Rendu de la tuile
      ctx.fillRect(screenX, screenY, TILE, TILE);
      
      // Bordure subtile pour définir les tuiles
      ctx.fillStyle = isAlt ? '#2a5c37' : '#214a2d';
      ctx.fillRect(screenX, screenY, TILE, 1);
      ctx.fillRect(screenX, screenY, 1, TILE);
    }
  }

  // draw enemies
  for (let e of enemies) {
    if (!e.alive) continue;
    const s = worldToScreen(e.x, e.y);
    // creature-like rounded body
    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.ellipse(s.x + e.w/2, s.y + e.h/2, e.w/2, e.h/2, 0, 0, Math.PI*2); ctx.fill();
    // eyes (one or two depending on size)
    ctx.fillStyle = '#111';
    if (e.w > 44) {
      ctx.fillRect(s.x + 8, s.y + 18, 6, 6);
      ctx.fillRect(s.x + e.w - 14, s.y + 18, 6, 6);
    } else {
      ctx.fillRect(s.x + e.w/2 - 3, s.y + 14, 6, 6);
    }
  }

  // draw projectiles
  for (let p of projectiles){
    const sp = worldToScreen(p.x, p.y);
    ctx.fillStyle = '#fff'; ctx.fillRect(sp.x, sp.y, p.w, p.h);
  }

  // draw items (gold, items, hearts)
for (let it of items) {
  const si = worldToScreen(it.x, it.y);
  const bob = Math.sin((Date.now() / 250) + it.x * 0.3) * 3;

  if (it.type === 'heart') {
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.moveTo(si.x + 8, si.y + 6 + bob);
    ctx.arc(si.x + 6, si.y + 6 + bob, 6, Math.PI, 0);
    ctx.arc(si.x + 16, si.y + 6 + bob, 6, Math.PI, 0);
    ctx.lineTo(si.x + 12, si.y + 18 + bob);
    ctx.closePath();
    ctx.fill();
  } 
  else if (it.type === 'gold') {
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(si.x + 8, si.y + 8 + bob, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c9a500';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } 
  else if (it.type === 'item') {
    ctx.fillStyle = '#88f';
    ctx.fillRect(si.x + 3, si.y + 3 + bob, 10, 10);
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('?', si.x + 8, si.y + 12 + bob);
    ctx.textAlign = 'left';
  }
}

// draw player shadow
  const shp = worldToScreen(player.x + 6, player.y + player.h - 6);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(shp.x + player.w/2, shp.y + 12, player.w/2, 8, 0, 0, Math.PI*2); ctx.fill();

// draw player
const sp = worldToScreen(player.x, player.y);

// flicker when invulnerable
let drawPlayer = true;
if (player.invuln > 0) {
    // flicker: toggle on/off each 0.06s
    drawPlayer = Math.floor(player.invuln * 16) % 2 === 0;
}

if (player.health > 0 && drawPlayer) {
    // draw head
    const headX = sp.x + player.w/2, headY = sp.y + 8;
    ctx.fillStyle = '#f6d7b7';
    ctx.beginPath();
    ctx.arc(headX, headY, 8, 0, Math.PI*2);
    ctx.fill();

    // hood / hat
    ctx.fillStyle = '#4c8b9a';
    ctx.beginPath();
    ctx.moveTo(headX-12, headY);
    ctx.lineTo(headX, headY-14);
    ctx.lineTo(headX+12, headY);
    ctx.closePath();
    ctx.fill();

    // body / tunic
    ctx.fillStyle = player.color;
    ctx.fillRect(sp.x + 6, sp.y + 22, player.w - 12, player.h - 26);

    // legs
    ctx.fillStyle = '#7b5e3b';
    ctx.fillRect(sp.x + 8, sp.y + player.h - 12, 10, 10);
    ctx.fillRect(sp.x + player.w - 18, sp.y + player.h - 12, 10, 10);

    // simple face (eyes)
    ctx.fillStyle = '#111';
    ctx.fillRect(headX - 6, headY - 2, 4, 4);
    ctx.fillRect(headX + 2, headY - 2, 4, 4);

    // --- draw sword if attacking ---
    if (player.attacking) {
        ctx.fillStyle = "yellow";
        let swordX = sp.x, swordY = sp.y, swordW = 16, swordH = 8;

        switch(player.direction) {
            case "right":
                swordX = sp.x + player.w;
                swordY = sp.y + 22;
                swordW = 16;
                swordH = 8;
                break;
            case "left":
                swordX = sp.x - 16;
                swordY = sp.y + 22;
                swordW = 16;
                swordH = 8;
                break;
            case "up":
                swordX = sp.x + player.w/2 - 4;
                swordY = sp.y - 16;
                swordW = 8;
                swordH = 16;
                break;
            case "down":
                swordX = sp.x + player.w/2 - 4;
                swordY = sp.y + player.h;
                swordW = 8;
                swordH = 16;
                break;
        }

        ctx.fillRect(swordX, swordY, swordW, swordH);
    }
}

// draw sword if equipped
if (player.equipment?.weapon?.id === 'sword' || true) { // "|| true" pour la forcer à apparaître
  const angle = Math.atan2(player.fy || 0, player.fx || 1); // direction du joueur
  const sx = sp.x + player.w/2;
  const sy = sp.y + player.h/2;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle);

  // poignée
  ctx.fillStyle = '#5a3b1a';
  ctx.fillRect(-2, -2, 4, 8);

  // garde
  ctx.fillStyle = '#999';
  ctx.fillRect(-8, 0, 16, 2);

  // lame
  const gradient = ctx.createLinearGradient(0, 0, 0, -35);
  gradient.addColorStop(0, '#ccc');
  gradient.addColorStop(1, '#eef');
  ctx.fillStyle = gradient;
  ctx.fillRect(-1.5, -35, 3, 35);

  // pointe
  ctx.beginPath();
  ctx.moveTo(-1.5, -35);
  ctx.lineTo(0, -40);
  ctx.lineTo(1.5, -35);
  ctx.closePath();
  ctx.fillStyle = '#eef';
  ctx.fill();

  ctx.restore();
}

  // HUD
  drawHUD();

  // death overlay
  if (player.health <= 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = '#fff'; ctx.font = '36px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('You died', W/2, H/2 - 8);
    ctx.font = '16px sans-serif'; ctx.fillText('Press R to restart', W/2, H/2 + 24);
    ctx.textAlign = 'left';
  }
}

// Inventory management
function getInventoryItem(itemId) {
  return ITEMS_DATABASE[itemId] || null;
}

function addToInventory(itemId) {
  if (ITEMS_DATABASE[itemId] && !player.inventory.includes(itemId)) {
    player.inventory.push(itemId);
    updatePlayerStats();
  }
}

function removeFromInventory(itemId) {
  const index = player.inventory.indexOf(itemId);
  if (index !== -1) {
    player.inventory.splice(index, 1);
    // Unequip if it was equipped
    for (let slot in player.equipment) {
      if (player.equipment[slot] && player.equipment[slot].id === itemId) {
        player.equipment[slot] = null;
      }
    }
    updatePlayerStats();
  }
}

function equipItem(itemId) {
  const item = getInventoryItem(itemId);
  if (!item) return;

  // Equip in the correct slot
  switch(item.type) {
    case ITEM_TYPES.WEAPON:
      player.equipment.weapon = item;
      break;
    case ITEM_TYPES.BOW:
      player.equipment.bow = item;
      break;
    case ITEM_TYPES.SHIELD:
      player.equipment.shield = item;
      break;
    case ITEM_TYPES.ARMOR:
      player.equipment.armor = item;
      break;
  }
  
  updatePlayerStats();
}

function updatePlayerStats() {
  // Reset base stats
  player.stats = {
    attack: 1,
    defense: 0,
    attackSpeed: 1.0
  };

  // Add equipment bonuses
  if (player.equipment.weapon) {
    player.stats.attack += player.equipment.weapon.damage;
    player.stats.attackSpeed *= player.equipment.weapon.attackSpeed;
  }
  if (player.equipment.armor) {
    player.stats.defense += player.equipment.armor.defense;
  }
  if (player.equipment.shield) {
    player.stats.defense += player.equipment.shield.defense;
  }
}

let inventoryOpen = false;

function drawHUD(){
  // health hearts
  const startX = 18, startY = 18;
  for (let i=0;i<player.maxHealth;i++){
    const filled = i < player.health;
    ctx.fillStyle = filled ? '#ff6b6b' : 'rgba(255,255,255,0.2)';
    // draw simple heart
    const x = startX + i*28; const y = startY;
    ctx.beginPath(); ctx.moveTo(x+8,y+12); ctx.arc(x+6,y+8,6,Math.PI,0); ctx.arc(x+16,y+8,6,Math.PI,0); ctx.lineTo(x+12,y+22); ctx.closePath(); ctx.fill();
  }

  // Equipment indicators (two-line layout to avoid overflow)
  const equipX = startX;
  const equipY = startY + 40;
  const bgW = 360;
  const bgH = 48;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(equipX, equipY, bgW, bgH);
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';

  // Show current weapon, bow on first line; shield, armor on second line
  const weaponName = player.equipment.weapon?.name || 'None';
  const bowName = player.equipment.bow?.name || 'None';
  const shieldName = player.equipment.shield?.name || 'None';
  const armorName = player.equipment.armor?.name || 'None';

  const line1 = `W: ${weaponName}    B: ${bowName}`;
  const line2 = `S: ${shieldName}    A: ${armorName}`;

  // Simple truncation if text is still too long for the bgW
  function fitText(text, maxWidth) {
    let t = text;
    while (ctx.measureText(t).width > maxWidth && t.length > 3) {
      t = t.slice(0, -1);
    }
    if (t !== text) t = t.slice(0, -3) + '...';
    return t;
  }

  const pad = 10;
  ctx.fillText(fitText(line1, bgW - pad*2), equipX + pad, equipY + 16);
  ctx.fillText(fitText(line2, bgW - pad*2), equipX + pad, equipY + 36);

  // instructions
  // instructions (right-side box, multi-line with truncation)
  const instrMargin = 18;
  const instrBoxW = 320;
  const instrBoxH = 106;
  const instrX = Math.max(10, W - instrBoxW - instrMargin);
  const instrY = 12;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(instrX, instrY, instrBoxW, instrBoxH);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';

  const lines = [
    'Arrows / WASD: Move    Space/Shift: Dash',
    'Z or K: Attack    X or J: Shoot',
    'M: Menu    R: Restart when dead',
    'I: Inventory    P: Shop'
  ];

  // helper: fit text to width with simple truncation
  function fitTextToWidth(text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 3 && ctx.measureText(t + '...').width > maxWidth) {
      t = t.slice(0, -1);
    }
    return t.length > 3 ? t + '...' : t;
  }

  const instrPad = 12;
  for (let i = 0; i < lines.length; i++) {
    const y = instrY + instrPad + (i * 22);
    ctx.fillText(fitTextToWidth(lines[i], instrBoxW - instrPad*1.5), instrX + instrPad, y);
  }

  // level display
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(W/2 - 64, 12, 128, 28);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Level ' + currentLevel, W/2, 32);
  ctx.textAlign = 'left';
}

// Start loop
requestAnimationFrame(loop);

// --- Level menu UI functions ---
function buildLevelButtons(){
  const container = document.getElementById('levels');
  if (!container) return;
  container.innerHTML = '';
  loadUnlocked();
  for (let i=1;i<=maxLevels;i++){
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i <= unlockedLevels) {
      btn.addEventListener('click', ()=>{ spawnLevel(i); unlockedLevels = Math.max(unlockedLevels, i); saveUnlocked(); });
    } else {
      btn.classList.add('locked');
      btn.disabled = true;
    }
    container.appendChild(btn);
  }
}

function showMenu(){
  const m = document.getElementById('level-menu'); if (!m) return;
  m.setAttribute('aria-hidden','false'); menuOpen = true;
}
function hideMenu(){
  const m = document.getElementById('level-menu'); if (!m) return;
  m.setAttribute('aria-hidden','true'); menuOpen = false;
}

function showInventory() {
  const inv = document.getElementById('inventory-menu');
  if (!inv) return;
  inv.setAttribute('aria-hidden', 'false');
  inventoryOpen = true;
  buildInventoryGrid();
}

function hideInventory() {
  const inv = document.getElementById('inventory-menu');
  if (!inv) return;
  inv.setAttribute('aria-hidden', 'true');
  inventoryOpen = false;
}

function buildInventoryGrid() {
  const grid = document.getElementById('inventory-grid');
  if (!grid) return;
  grid.innerHTML = '';
  updateGoldDisplays();
  
  for (const itemId of player.inventory) {
    const item = ITEMS_DATABASE[itemId];
    if (!item) continue;
    
    const slot = document.createElement('div');
    slot.className = 'item-slot' + (player.equipment[item.type.toLowerCase()] === item ? ' equipped' : '');
    
    const name = document.createElement('div');
    name.className = 'item-name';
    name.textContent = item.name;
    
    const desc = document.createElement('div');
    desc.className = 'item-desc';
    desc.textContent = item.description;
    
    const stats = document.createElement('div');
    stats.className = 'item-stats';
    if (item.damage) stats.textContent = `Damage: ${item.damage}`;
    if (item.defense) stats.textContent = `Defense: ${item.defense}`;
    
    slot.appendChild(name);
    slot.appendChild(desc);
    slot.appendChild(stats);
    
    slot.addEventListener('click', () => {
      equipItem(itemId);
      buildInventoryGrid(); // Refresh to show equipped status
    });
    
    grid.appendChild(slot);
  }
}

document.addEventListener('keydown', (e)=>{
  const key = e.key.toLowerCase();
  if (key === 'm') { 
    if (menuOpen) hideMenu(); 
    else { buildLevelButtons(); showMenu(); }
  } else if (key === 'i') {
    if (inventoryOpen) hideInventory();
    else showInventory();
  } else if (key === 'p') {
    if (shopOpen) hideShop();
    else showShop();
  }
});

const _btnClose = document.getElementById('btn-close-menu'); 
if (_btnClose) _btnClose.addEventListener('click', ()=>{ hideMenu(); });

const _btnCloseInv = document.getElementById('btn-close-inventory');
if (_btnCloseInv) _btnCloseInv.addEventListener('click', ()=>{ hideInventory(); });

const _btnOpenShop = document.getElementById('btn-open-shop');
if (_btnOpenShop) _btnOpenShop.addEventListener('click', ()=>{ hideInventory(); showShop(); });

const _btnCloseShop = document.getElementById('btn-close-shop');
if (_btnCloseShop) _btnCloseShop.addEventListener('click', ()=>{ hideShop(); });

let shopOpen = false;

function showShop() {
  const shop = document.getElementById('shop-menu');
  if (!shop) return;
  shop.setAttribute('aria-hidden', 'false');
  shopOpen = true;
  buildShopGrid();
}

function hideShop() {
  const shop = document.getElementById('shop-menu');
  if (!shop) return;
  shop.setAttribute('aria-hidden', 'true');
  shopOpen = false;
}

function buildShopGrid() {
  const grid = document.getElementById('shop-grid');
  if (!grid) return;
  grid.innerHTML = '';
  updateGoldDisplays();

  for (const entry of SHOP_INVENTORY) {
    const item = ITEMS_DATABASE[entry.itemId];
    if (!item) continue;

    const slot = document.createElement('div');
    slot.className = 'shop-slot';

    const name = document.createElement('div');
    name.className = 'item-name';
    name.textContent = item.name;

    const desc = document.createElement('div');
    desc.className = 'item-desc';
    desc.textContent = item.description;

    const price = document.createElement('div');
    price.className = 'item-price';
    price.textContent = `${entry.price} gold`;

    slot.appendChild(name);
    slot.appendChild(desc);
    slot.appendChild(price);

    // Achat d'un objet
    slot.addEventListener('click', () => {
      if (player.gold >= entry.price) {
        player.gold -= entry.price;
        addToInventory(item.id);
        playPickup();
        buildShopGrid();
      } else {
        playBeep(200, 0.1, 'square', 0.2); // son d’erreur
      }
    });

    grid.appendChild(slot);
  }
}

function updateGoldDisplays() {
  const els = document.querySelectorAll('.gold-display');
  for (const el of els) el.textContent = player.gold + ' gold';
}

// initialize menu and unlocked levels on load
loadUnlocked(); buildLevelButtons(); showMenu();
