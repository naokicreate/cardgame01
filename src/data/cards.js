export const CARD_TYPES = {
  UNIT: 'unit',
  TRAP: 'trap',
  RESOURCE: 'resource'
};

export const EFFECT_TYPES = {
  ON_PLAY: 'onPlay',
  ON_ATTACK: 'onAttack',
  ON_DESTROYED: 'onDestroyed',
  KEYWORD: 'keyword',
  CONTINUOUS: 'continuous'
};

export const EFFECT_ACTIONS = {
  DRAW: 'draw',
  DAMAGE_UNIT: 'damageUnit',
  DAMAGE_PLAYER: 'damagePlayer',
  HEAL_PLAYER: 'healPlayer',
  DESTROY_UNIT: 'destroyUnit',
  BUFF_ATTACK: 'buffAttack',
  ADD_CORE: 'addCore'
};

export const EFFECT_TARGETS = {
  SELF: 'self',
  OPPONENT_UNIT: 'opponentUnit',
  OPPONENT_PLAYER: 'opponentPlayer',
  ALL_PLAYER_UNITS: 'allPlayerUnits'
};

export const KEYWORDS = {
  CHARGE: '速攻',
  FLYING: '飛行',
  TAUNT: '挑発',
  POISON: '毒'
};

// カードデータ
export const cards = [
  // 低コストユニット
  {
    id: 'unit001',
    name: '見習い剣士',
    type: CARD_TYPES.UNIT,
    cost: 1,
    attack: 1,
    health: 2,
    effects: [],
    description: '戦場で経験を積む若き剣士。',
    illust_url: 'https://placehold.co/100x140?text=Trainee'
  },  {
    id: 'unit002',
    name: '熟練剣士',
    type: CARD_TYPES.UNIT,
    cost: 2,
    attack: 2,
    health: 2,
    effects: [
      { type: EFFECT_TYPES.ON_PLAY, action: EFFECT_ACTIONS.BUFF_ATTACK, value: 1, target: EFFECT_TARGETS.SELF }
    ],
    description: '場に出た時、自身の攻撃力が1上がる。',
    illust_url: 'https://placehold.co/100x140?text=Skilled'
  },  {
    id: 'unit003',
    name: '帝国の盾持ち',
    type: CARD_TYPES.UNIT,
    cost: 3,
    attack: 1,
    health: 4,
    effects: [
      { type: EFFECT_TYPES.KEYWORD, name: KEYWORDS.TAUNT },
      { type: EFFECT_TYPES.ON_PLAY, action: EFFECT_ACTIONS.HEAL_PLAYER, value: 500, target: EFFECT_TARGETS.SELF }
    ],
    description: '挑発持ち。場に出た時、自分のLPを500回復する。',
    illust_url: 'https://placehold.co/100x140?text=Shield'
  },  {
    id: 'unit004',
    name: '空の傭兵',
    type: CARD_TYPES.UNIT,
    cost: 3,
    attack: 2,
    health: 2,
    effects: [
      { type: EFFECT_TYPES.KEYWORD, name: KEYWORDS.FLYING },
      { type: EFFECT_TYPES.ON_ATTACK, action: EFFECT_ACTIONS.DAMAGE_PLAYER, value: 300, target: EFFECT_TARGETS.OPPONENT_PLAYER }
    ],
    description: '飛行持ち。攻撃時、相手に300ダメージを与える。',
    illust_url: 'https://placehold.co/100x140?text=Mercenary'
  },  {
    id: 'unit005',
    name: '雷撃の剣士',
    type: CARD_TYPES.UNIT,
    cost: 3,
    attack: 3,
    health: 2,
    effects: [
      { type: EFFECT_TYPES.KEYWORD, name: KEYWORDS.CHARGE },
      { type: EFFECT_TYPES.ON_ATTACK, action: EFFECT_ACTIONS.DAMAGE_UNIT, value: 1, target: EFFECT_TARGETS.OPPONENT_UNIT }
    ],
    description: '速攻持ち。攻撃時、対象ユニットに1ダメージを与える。',
    illust_url: 'https://placehold.co/100x140?text=Thunder'
  },
  {
    id: 'unit006',
    name: '聖域の癒し手',
    type: CARD_TYPES.UNIT,
    cost: 4,
    attack: 1,
    health: 3,
    effects: [
      { type: EFFECT_TYPES.ON_PLAY, action: EFFECT_ACTIONS.HEAL_PLAYER, value: 1000, target: EFFECT_TARGETS.SELF },
      { type: EFFECT_TYPES.ON_DESTROYED, action: EFFECT_ACTIONS.HEAL_PLAYER, value: 500, target: EFFECT_TARGETS.SELF }
    ],
    description: '場に出た時、自分のLPを1000回復する。破壊された時、自分のLPを500回復する。',
    illust_url: 'https://placehold.co/100x140?text=Healer'
  },

  // トラップカード
  {
    id: 'trap001',
    name: '反射の結界',
    type: CARD_TYPES.TRAP,
    cost: 2,
    effects: [
      {
        type: EFFECT_TYPES.ON_PLAY,
        action: EFFECT_ACTIONS.DAMAGE_UNIT,
        value: 2,
        target: EFFECT_TARGETS.OPPONENT_UNIT
      }
    ],
    description: '相手ユニットが攻撃宣言した時、そのユニットに2ダメージを与える。',
    illust_url: 'https://placehold.co/100x140?text=Barrier'
  },  {
    id: 'trap002',
    name: '稲妻の裁き',
    type: CARD_TYPES.TRAP,
    cost: 3,
    effects: [
      {
        type: EFFECT_TYPES.ON_PLAY,
        action: EFFECT_ACTIONS.DAMAGE_UNIT,
        value: 3,
        target: EFFECT_TARGETS.OPPONENT_UNIT
      },
      {
        type: EFFECT_TYPES.ON_PLAY,
        action: EFFECT_ACTIONS.DAMAGE_PLAYER,
        value: 500,
        target: EFFECT_TARGETS.OPPONENT_PLAYER
      }
    ],
    description: '相手ユニットが攻撃宣言した時、そのユニットに3ダメージを与え、相手プレイヤーに500ダメージを与える。',
    illust_url: 'https://placehold.co/100x140?text=Lightning'
  },
  // リソースカード
  {
    id: 'resource001',
    name: '戦場の旗印',
    type: CARD_TYPES.RESOURCE,
    cost: 2,
    effects: [
      {
        type: EFFECT_TYPES.CONTINUOUS,
        action: EFFECT_ACTIONS.BUFF_ATTACK,
        value: 1,
        target: EFFECT_TARGETS.ALL_PLAYER_UNITS
      },
      {
        type: EFFECT_TYPES.ON_PLAY,
        action: EFFECT_ACTIONS.ADD_CORE,
        value: 2,
        target: EFFECT_TARGETS.SELF
      }
    ],
    description: '自分のユニット全ての攻撃力を+1し、場に出た時2コアを得る。',
    illust_url: 'https://placehold.co/100x140?text=Banner'
  },  {
    id: 'resource002',
    name: '英雄の遺物',
    type: CARD_TYPES.RESOURCE,
    cost: 3,
    effects: [
      {
        type: EFFECT_TYPES.ON_PLAY,
        action: EFFECT_ACTIONS.DRAW,
        value: 1,
        target: EFFECT_TARGETS.SELF
      },
      {
        type: EFFECT_TYPES.CONTINUOUS,
        action: EFFECT_ACTIONS.HEAL_PLAYER,
        value: 200,
        target: EFFECT_TARGETS.SELF
      }
    ],
    description: '場に出た時カードを1枚引く。各ターン終了時、自分のLPを200回復する。',
    illust_url: 'https://placehold.co/100x140?text=Relic'
  },
  
  // 高コストユニット
  {
    id: 'unit007',
    name: '炎竜',
    type: CARD_TYPES.UNIT,
    cost: 6,
    attack: 5,
    health: 5,
    effects: [
      { type: EFFECT_TYPES.KEYWORD, name: KEYWORDS.FLYING },
      { type: EFFECT_TYPES.ON_PLAY, action: EFFECT_ACTIONS.DAMAGE_PLAYER, value: 1000, target: EFFECT_TARGETS.OPPONENT_PLAYER },
      { type: EFFECT_TYPES.ON_ATTACK, action: EFFECT_ACTIONS.DAMAGE_UNIT, value: 2, target: EFFECT_TARGETS.OPPONENT_UNIT }
    ],
    description: '飛行持ち。場に出た時、相手に1000ダメージを与える。攻撃時、対象ユニットに2ダメージを与える。',
    illust_url: 'https://placehold.co/100x140?text=Dragon'
  },
  
  {
    id: 'unit008',
    name: '神聖騎士',
    type: CARD_TYPES.UNIT,
    cost: 5,
    attack: 3,
    health: 6,
    effects: [
      { type: EFFECT_TYPES.KEYWORD, name: KEYWORDS.TAUNT },
      { type: EFFECT_TYPES.ON_PLAY, action: EFFECT_ACTIONS.HEAL_PLAYER, value: 1000, target: EFFECT_TARGETS.SELF },
      { type: EFFECT_TYPES.KEYWORD, name: KEYWORDS.CHARGE }
    ],
    description: '挑発と速攻持ち。場に出た時、自分のLPを1000回復する。',
    illust_url: 'https://placehold.co/100x140?text=Knight'
  }
];
];
