import { GAME_CONSTANTS, GAME_PHASES } from './gameState';

// デッキをシャッフルする
export function shuffleDeck(deck) {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}

// カードをドローする
export function drawCard(playerState) {
  if (playerState.deck.length === 0) {
    return {
      ...playerState,
      lp: playerState.lp - GAME_CONSTANTS.DECK_OUT_DAMAGE
    };
  }

  const newDeck = [...playerState.deck];
  const drawnCard = newDeck.pop();
  
  return {
    ...playerState,
    deck: newDeck,
    hand: [...playerState.hand, drawnCard]
  };
}

// 初期手札を配る
export function dealInitialHands(gameState) {
  let newGameState = { ...gameState };
  
  for (let i = 0; i < GAME_CONSTANTS.INITIAL_HAND_SIZE; i++) {
    newGameState.players.player1 = drawCard(newGameState.players.player1);
    newGameState.players.player2 = drawCard(newGameState.players.player2);
  }
  
  return newGameState;
}

// カードをプレイできるかチェック
export function canPlayCard(card, playerState) {
  // コストチェック
  if (card.cost > playerState.core) {
    return false;
  }

  // ゾーンの空きチェック
  switch (card.type) {
    case 'unit':
      return playerState.unitZone.includes(null);
    case 'trap':
      return playerState.trapZone.includes(null);
    case 'resource':
      return playerState.resourceZone.includes(null);
    default:
      return false;
  }
}

// カードをプレイする（コスト支払いと場への配置）
export function playCard(card, zoneIndex, playerState) {
  if (!canPlayCard(card, playerState)) {
    return playerState;
  }

  const handIndex = playerState.hand.findIndex(c => c.id === card.id);
  if (handIndex === -1) return playerState;

  const newHand = [...playerState.hand];
  newHand.splice(handIndex, 1);

  const newPlayerState = {
    ...playerState,
    hand: newHand,
    core: playerState.core - card.cost
  };

  switch (card.type) {
    case 'unit':
      const newUnitZone = [...playerState.unitZone];
      newUnitZone[zoneIndex] = card;
      return { ...newPlayerState, unitZone: newUnitZone };
    case 'trap':
      const newTrapZone = [...playerState.trapZone];
      newTrapZone[zoneIndex] = card;
      return { ...newPlayerState, trapZone: newTrapZone };
    case 'resource':
      const newResourceZone = [...playerState.resourceZone];
      newResourceZone[zoneIndex] = card;
      return { ...newPlayerState, resourceZone: newResourceZone };
    default:
      return newPlayerState;
  }
}

// ダメージ計算
export function calculateDamage(attacker, defender) {
  if (!defender) {
    return { attackerDamage: 0, defenderDamage: 0 };
  }

  return {
    attackerDamage: defender.attack || 0,
    defenderDamage: attacker.attack || 0
  };
}

// ユニットの破壊判定
export function checkDestruction(unit) {
  return unit.currentHealth <= 0;
}

// 次のフェーズに進む
export function nextPhase(currentPhase) {
  const phases = Object.values(GAME_PHASES);
  const currentIndex = phases.indexOf(currentPhase);
  return phases[(currentIndex + 1) % phases.length];
}

// キーワード効果のチェック
export function hasKeyword(card, keyword) {
  return card.effects?.some(effect => 
    effect.type === 'keyword' && effect.name === keyword
  ) || false;
}

// 攻撃可能かチェック
export function canAttack(unit, playerState) {
  return unit.canAttack && !unit.isTapped;
}

// ブロック可能かチェック
export function canBlock(blocker, attacker) {
  if (hasKeyword(attacker, '飛行')) {
    return hasKeyword(blocker, '飛行');
  }
  return true;
}

// 挑発持ちユニットの存在チェック
export function hasTauntUnit(playerState) {
  return playerState.unitZone.some(unit => 
    unit && hasKeyword(unit, '挑発')
  );
}

// 勝利条件チェック
export function checkWinCondition(gameState) {
  const { player1, player2 } = gameState.players;
  
  if (player1.lp <= 0 && player2.lp <= 0) {
    return { isGameOver: true, winner: null }; // 引き分け
  } else if (player1.lp <= 0) {
    return { isGameOver: true, winner: 'player2' };
  } else if (player2.lp <= 0) {
    return { isGameOver: true, winner: 'player1' };
  }
  
  return { isGameOver: false, winner: null };
};
