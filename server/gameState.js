const GAME_PHASES = {
  START: 'start',
  DRAW: 'draw',
  MAIN: 'main',
  ATTACK: 'attack',
  END: 'end'
};

const GAME_CONSTANTS = {
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

function createGameState(player1Id, player2Id) {
  return {
    players: {
      [player1Id]: createPlayerState(true),
      [player2Id]: createPlayerState(false)
    },
    currentPhase: GAME_PHASES.START,
    currentPlayer: player1Id,
    turnNumber: 1,
    isGameOver: false,
    winner: null,
    effectStack: [],
    lastAction: null
  };
}

function createPlayerState(isFirstPlayer) {
  return {
    deck: [],
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

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function dealInitialCards(gameState) {
  const playerIds = Object.keys(gameState.players);
  for (const playerId of playerIds) {
    const player = gameState.players[playerId];
    for (let i = 0; i < GAME_CONSTANTS.INITIAL_HAND_SIZE; i++) {
      const card = player.deck.pop();
      if (card) {
        player.hand.push(card);
      }
    }
  }
  return gameState;
}

module.exports = {
  GAME_PHASES,
  GAME_CONSTANTS,
  createGameState,
  shuffleArray,
  dealInitialCards
};
