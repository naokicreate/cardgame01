export const GAME_PHASES = {
  START: 'start',
  DRAW: 'draw',
  MAIN: 'main',
  ATTACK: 'attack',
  END: 'end'
};

export const GAME_ZONES = {
  DECK: 'deck',
  HAND: 'hand',
  UNIT: 'unit',
  TRAP: 'trap',
  RESOURCE: 'resource',
  GRAVEYARD: 'graveyard'
};

// ゲームの定数
export const GAME_CONSTANTS = {
  INITIAL_HAND_SIZE: 3,
  MAX_HAND_SIZE: 7,
  INITIAL_LP: 10000,
  INITIAL_CORE: 5,
  TURN_CORE_GAIN: 3,
  MAX_CORE: 10,
  DECK_SIZE: 20,
  MAX_UNIT_ZONE: 5,
  MAX_TRAP_ZONE: 1,
  MAX_RESOURCE_ZONE: 1,
  DECK_OUT_DAMAGE: 1000
};

// ゲームの初期状態を生成する関数
export function createInitialGameState(player1Deck, player2Deck) {
  return {
    players: {
      player1: createPlayerState(player1Deck, true),
      player2: createPlayerState(player2Deck, false)
    },
    currentPhase: GAME_PHASES.START,
    currentPlayer: 'player1',
    turnNumber: 1,
    isGameOver: false,
    winner: null,
    effectStack: [],
    lastAction: null
  };
}

// プレイヤーの初期状態を生成する関数
function createPlayerState(deck, isFirstPlayer) {
  return {
    deck: [...deck], // デッキをコピー
    hand: [],
    unitZone: Array(GAME_CONSTANTS.MAX_UNIT_ZONE).fill(null),
    trapZone: Array(GAME_CONSTANTS.MAX_TRAP_ZONE).fill(null),
    resourceZone: Array(GAME_CONSTANTS.MAX_RESOURCE_ZONE).fill(null),
    graveyard: [],
    lp: GAME_CONSTANTS.INITIAL_LP,
    core: GAME_CONSTANTS.INITIAL_CORE,
    isFirstPlayer
  };
}

// カードの状態を作成する関数
export function createCardState(cardData) {
  return {
    ...cardData,
    currentAttack: cardData.attack,
    currentHealth: cardData.health,
    canAttack: cardData.effects?.some(effect => 
      effect.type === 'keyword' && effect.name === '速攻'
    ) || false,
    isTapped: false,
    effects: [...(cardData.effects || [])]
  };
}
