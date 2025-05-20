import React, { createContext, useContext, useReducer } from 'react';

export const PHASES = {
  START: 'START',
  DRAW: 'DRAW',
  MAIN: 'MAIN',
  BATTLE: 'BATTLE',
  END: 'END'
};

const initialState = {
  phase: PHASES.START,
  players: {
    player1: {
      deck: [],
      hand: [],
      field: [],
      graveyard: [],
      lifePoints: 10000,
      cores: 5,
      resourceCard: null,
      trapCard: null
    },
    player2: {
      deck: [],
      hand: [],
      field: [],
      graveyard: [],
      lifePoints: 10000,
      cores: 5,
      resourceCard: null,
      trapCard: null
    }
  },
  currentPlayer: 'player1',
  selectedCard: null,
  selectedTarget: null,
  canAttack: false
};

function gameReducer(state, action) {
  switch (action.type) {
    case 'START_TURN':
      const currentPlayer = state.players[state.currentPlayer];
      return {
        ...state,
        phase: PHASES.START,
        players: {
          ...state.players,
          [state.currentPlayer]: {
            ...currentPlayer,
            cores: Math.min(currentPlayer.cores + 3, 10) // 最大10コアまで
          }
        }
      };

    case 'DRAW_CARD':
      const player = state.players[state.currentPlayer];
      if (player.deck.length === 0) {
        return {
          ...state,
          players: {
            ...state.players,
            [state.currentPlayer]: {
              ...player,
              lifePoints: player.lifePoints - 1000
            }
          }
        };
      }
      const [drawnCard, ...remainingDeck] = player.deck;
      return {
        ...state,
        players: {
          ...state.players,
          [state.currentPlayer]: {
            ...player,
            deck: remainingDeck,
            hand: [...player.hand, drawnCard]
          }
        },
        phase: PHASES.MAIN
      };

    case 'PLAY_CARD':
      const { card, position } = action.payload;
      const currentPlayerState = state.players[state.currentPlayer];
      
      if (currentPlayerState.cores < card.cost) {
        return state;
      }

      // カードタイプに応じた配置処理
      let updatedPlayer = {
        ...currentPlayerState,
        cores: currentPlayerState.cores - card.cost,
        hand: currentPlayerState.hand.filter(c => c.id !== card.id)
      };

      switch (card.type) {
        case 'UNIT':
          if (currentPlayerState.field.length < 5) {
            updatedPlayer.field = [...updatedPlayer.field, { ...card, canAttack: false }];
          }
          break;
        case 'TRAP':
          if (!currentPlayerState.trapCard) {
            updatedPlayer.trapCard = card;
          }
          break;
        case 'RESOURCE':
          if (!currentPlayerState.resourceCard) {
            updatedPlayer.resourceCard = card;
          }
          break;
      }

      return {
        ...state,
        players: {
          ...state.players,
          [state.currentPlayer]: updatedPlayer
        }
      };

    case 'CHANGE_PHASE':
      const newPhase = action.payload;
      return {
        ...state,
        phase: newPhase,
        canAttack: newPhase === PHASES.BATTLE
      };

    case 'END_TURN':
      return {
        ...state,
        currentPlayer: state.currentPlayer === 'player1' ? 'player2' : 'player1',
        phase: PHASES.START,
        selectedCard: null,
        selectedTarget: null,
        canAttack: false
      };

    case 'SELECT_CARD':
      return {
        ...state,
        selectedCard: action.payload
      };

    case 'SELECT_TARGET':
      return {
        ...state,
        selectedTarget: action.payload
      };

    case 'ATTACK':
      // 戦闘処理のロジック
      const { attacker, target } = action.payload;
      // ... 戦闘の詳細な実装

    default:
      return state;
  }
}

export const GameContext = createContext();

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
