/* 中文 for TNT Brothers: the words on the page, the toasts, the level names and tips, the world map, the ? panel and
   the comic word bursts in the 3D scene (Kit.lang, from kit/lang.js).
   Staying in English on purpose: the kids' names, the game's name and logo (TNT Brothers), the TT on the blocks and
   coins, the TNT flag and clubhouse sign, and the subway's street art (the TNT LINE sign and the posters). */
(function () {
  const L = Kit.lang;
  L.keep(['TEDDY', 'TOMMY', 'Teddy', 'Tommy', 'TNT', 'BROTHERS', 'TNT Brothers', 'TNT BROTHERS', 'TT', 'Shift', 'Esc']); // and key names

  // the 10 levels and the 4 worlds (js/levels.js, the world map in js/game.js)
  const LEVELS = {
    'Backyard Hop': '后院跳跳乐', 'Park Party': '公园派对', 'Playground Picnic': '游乐场野餐',
    'Subway Station': '地铁站', 'Tunnel Express': '隧道快车',
    'Treetop Trail': '树顶小路', 'Cloud Hop': '云朵跳跳', 'Sky Bridge': '天空之桥',
    'Zombie Castle': '僵尸城堡', 'The Zombie King': '僵尸国王',
  };
  L.add(LEVELS);

  L.add({
    // title screen
    "Teddy & Tommy's big adventure: 10 levels, from the backyard to the Zombie King's castle!": 'Teddy 和 Tommy 的大冒险：10 个关卡，从后院一路闯到僵尸国王的城堡！',
    '🐣 EASY': '🐣 简单', '🔥 NORMAL': '🔥 普通',
    'EASY: 9 lives, no timer, slower enemies': '简单：9 条命，不计时，敌人走得慢',
    'NORMAL: 5 lives, a 300-second clock, full-speed enemies': '普通：5 条命，300 秒倒计时，敌人全速',
    'Turn sideways to play!': '把手机横过来玩！',
    // who's playing
    "WHO'S PLAYING?": '谁来玩？',
    'Throws 🏀 basketballs. Buddy: Tommy': '扔 🏀 篮球。兄弟：Tommy',
    'Throws ✌️ stars. Buddy: Teddy': '扔 ✌️ 星星。兄弟：Teddy',
    '◀ BACK': '◀ 返回',
    // the world map
    'WORLD MAP': '世界地图', 'PLAY ▶': '开始 ▶', 'locked': '还没解锁', 'not cleared yet': '还没过关',
    'BACKYARD & PARK': '后院和公园', 'UNDER THE SUBWAY': '地铁下面', 'SKY & TREETOPS': '天空和树顶', 'ZOMBIE CASTLE': '僵尸城堡',
    'TEDDY + TOMMY (2 players)': 'TEDDY + TOMMY（双人）',
    // HUD and buttons (and their tooltips)
    'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', 'High five! (T)': '击掌！(T)', 'HIGH FIVE!': '击掌！',
    'Call Tommy (T)': '叫 Tommy (T)', 'Call Teddy (T)': '叫 Teddy (T)', 'Call your brother (T)': '叫兄弟来帮忙 (T)', 'JUMP': '跳',
    'NEXT ▶': '下一关 ▶',
    '← → move · Space jump · Shift run · F throw · ↓ vents · T call your brother': '← → 移动 · 空格 跳 · Shift 跑 · F 扔 · ↓ 钻通风管 · T 叫兄弟来帮忙',
    'TEDDY: A D move · W jump · Shift run · F throw  |  TOMMY: J L move · I/U jump · H run · O throw  |  T high five':
      'TEDDY：A D 移动 · W 跳 · Shift 跑 · F 扔  |  TOMMY：J L 移动 · I/U 跳 · H 跑 · O 扔  |  T 击掌',
    // pause, level clear, out of lives, the end
    '↻ RESTART': '↻ 重新开始', '🗺️ MAP': '🗺️ 地图',
    'LEVEL CLEAR!': '过关啦！', 'Score': '得分', 'Coins': '金币', '· Lives': '· 命', 'NEW BEST!': '新纪录！',
    'OUT OF LIVES!': '没命啦！', '↻ TRY AGAIN': '↻ 再试一次',
    'Good try! Your levels stay unlocked, and you get a fresh set of lives.': '玩得好！解锁的关卡都还在，命也给你补满了。',
    'YOU BONKED': '你打败了', 'THE ZOMBIE KING!': '僵尸国王！',
    'Teddy & Tommy saved the day. The TNT Brothers are the champions! 🏆': 'Teddy 和 Tommy 拯救了大家。TNT Brothers 是冠军！🏆',
    'OOPS!': '哎呀！',
    // toasts while playing
    '⭐ SUPER STAR!': '⭐ 超级星星！', '💚 1-UP!': '💚 加一条命！', '💚 1-UP! EXTRA LIFE!': '💚 多一条命！',
    "⏱️ TIME'S UP!": '⏱️ 时间到！', '⏱️ HURRY UP!': '⏱️ 快点快点！', '🚩 CHECKPOINT!': '🚩 存档点！', 'BONUS ROOM!': '奖励房间！',
    '🙌 HIGH FIVE! ⭐ STAR POWER!': '🙌 击掌！⭐ 星星超能力！', '👑 THE ZOMBIE KING!': '👑 僵尸国王来啦！', 'ONE MORE!': '再来一下！',
    '👑 YOU BONKED THE ZOMBIE KING!': '👑 你打败了僵尸国王！', 'THE GATE IS OPEN!': '大门打开啦！',
    // words drawn in the 3D scene (js/art.js and js/world.js ask for these through Kit.lang.t)
    'POW!': '砰！', 'BOP!': '啵！', 'BONK!': '咚！', 'KICK!': '踢！', 'HIGH 5!': '击掌！', 'BOING!': '嘣！', 'SWISH!': '唰！进球！',
    // the ? panel (js/keys.js)
    'jump (hold for higher)': '跳（按住跳得更高）', 'throw (🏀 power)': '扔（🏀 超能力）', 'go down a vent': '钻进通风管',
    "◀ ▶, JUMP, 🏀 and ▼ buttons. Tap your brother's face (top right) to call him. Turn a phone sideways.":
      '◀ ▶、跳、🏀 和 ▼ 按钮。点右上角兄弟的头像叫他来帮忙。手机要横过来玩。',
  });

  // strings with names and numbers in them
  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  L.rule(/^LEVEL (\d+)$/, '第 $1 关');
  L.rule(/^LEVEL (\d+) ▶$/, '第 $1 关 ▶');
  L.rule(/^LEVEL (\d+) · (.+)$/, (m, n, name) => `第 ${n} 关 · ${LEVELS[name] || name}`);
  L.rule(/^⭐ best ([\d,]+)$/, '⭐ 最高分 $1');
  L.rule(/^Best ([\d,]+)$/, '最高分 $1');
  L.rule(/^\(time bonus ([\d,]+)\)$/, '（时间奖励 $1）');
  L.rule(/^(.+) · (🐣 EASY|🔥 NORMAL) · pick a level$/, (m, who, d) => {
    const w = who.match(/^(\w+), with (\w+) on call$/);
    return `${w ? `${w[1]}，${w[2]} 随叫随到` : L.t(who)} · ${L.t(d)} · 选一关`;
  });
  L.rule(/^🍦 (\S+) GOT BIG!$/, '🍦 $1 变大啦！');
  L.rule(/^🏀 (✌️ STAR|BASKETBALL) POWER! PRESS (\S+)$/, (m, kind, key) =>
    kind === 'BASKETBALL' ? `🏀 篮球超能力！按 ${key} 投篮` : `🏀 ✌️ 星星超能力！按 ${key} 扔星星`);
  L.rule(/^OOPS, (.+)!$/, '哎呀，$1！');
  L.rule(/^(.+) IS BACK!$/, '$1 回来啦！');
  L.rule(/^(.+) IS OUT OF LIVES\. KEEP GOING!$/, '$1 没有命了，继续加油！');
  L.rule(/^(.+)'S HERE!$/, '$1 来啦！');
  L.rule(/^(.+) SAVED YOU!$/, '$1 救了你！');
  L.rule(/^(\d) MORE STOMPS!$/, '再踩 $1 下！');
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (.+)!$/, (m, emoji, item, who) => `${emoji} ${who} 送来的${TREAT[item]}！`);

  // The level tips (js/levels.js). The game fills in {jump}, {run}... with keys or touch buttons before showing a
  // tip, so each tip becomes a rule that matches any filling and puts the Chinese words in.
  const WORDS = {
    '← → (or A D)': '← →（或 A D）', 'the ◀ ▶ buttons': '◀ ▶ 按钮', SPACE: '空格键', JUMP: '“跳”按钮',
    SHIFT: 'Shift 键', '▶ (keep holding it)': '▶（一直按着）', F: 'F 键', '🏀': '🏀', '↓': '↓', '▼': '▼',
    'press T': '按 T', 'tap his face (top right)': '点右上角他的头像',
    'press T for a high five!': '按 T 击掌！', 'tap 🙌 for a high five!': '点 🙌 击掌！',
  };
  const TIPS = {
    'Walk with {move}': '用 {move} 走路',
    'Press {jump} to jump. Hold it to jump higher!': '按 {jump} 跳起来，按住跳得更高！',
    'Bump TT blocks from below!': '从下面顶 TT 方块！',
    'Jump on zombies to squash them flat!': '跳到僵尸头上，把他们踩扁！',
    'Need help? Call your brother: {call}': '需要帮忙？叫兄弟来帮忙：{call}',
    'Stand on the vent and press {down} to peek inside!': '站在通风管上，按 {down} 钻进去看看！',
    'Jump over the gap!': '跳过这个坑！',
    'Hold {run} to run faster!': '按住 {run} 跑得更快！',
    'Jump high onto the flagpole for big points!': '跳高高抓旗杆，得分更多！',
    'Robots fold up when you stomp them. Bump one to send it sliding!': '踩一下机器人，它会缩成一团。再碰它，它就滑出去啦！',
    'A plant lives in that vent. Wait for it to duck!': '通风管里住着咬咬花，等它缩回去再走！',
    'Big and got a 🏀? Press {throw}!': '变大了还有 🏀？按 {throw} 扔球！',
    'Bouncing balls! Stomp them or slip underneath.': '弹弹球！踩它，或者从下面钻过去。',
    'Some bricks hold lots of coins. Keep bumping!': '有些砖块里有好多金币，一直顶！',
    'Down in the subway! Mind the plants in the vents.': '来到地铁里啦！小心通风管里的咬咬花。',
    'Ride the moving platforms across the tracks!': '坐上移动平台，越过铁轨！',
    'Drones! Stomp them from above.': '无人机！从上面踩它们。',
    'Up in the trees! Jump up through the branches.': '爬到树上啦！可以从下面跳穿树枝。',
    'Lifts go up and down. Hop on!': '升降台上上下下，跳上去！',
    'Spinning star bars! Time your run.': '旋转星星棒！看准时机再跑。',
    'The Zombie King! Stomp him 3 times!': '僵尸国王！踩他 3 下！',
  };
  for (const en in TIPS) {
    const names = [];
    const src = en.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\w+)\}/g, (m, k) => (names.push(k), '(.+)'));
    if (!names.length) {
      L.add({ [en]: TIPS[en] });
      continue;
    }
    L.rule(new RegExp('^' + src + '$'), (...a) => TIPS[en].replace(/\{(\w+)\}/g, (m, k) => {
      const w = a[1 + names.indexOf(k)];
      return WORDS[w] !== undefined ? WORDS[w] : w;
    }));
  }
})();
