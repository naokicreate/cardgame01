import { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';

const INITIAL_STATE = {
  phase: 'WAITING',
  players: {},
  currentPlayer: null,
  gameField: {
    player1: {
      hand: [],
      field: [],
      deck: [],
      graveyard: []
    },
    player2: {
      hand: [],
      field: [],
      deck: [],
      graveyard: []
    }
  }
};

export const useGameState = (roomId) => {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(INITIAL_STATE);
  const [playerId, setPlayerId] = useState(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    
    newSocket.emit('joinRoom', { roomId });
    
    newSocket.on('connect', () => {
      setSocket(newSocket);
      setPlayerId(newSocket.id);
    });

    newSocket.on('gameState', (newGameState) => {
      setGameState(newGameState);
    });

    newSocket.on('error', (error) => {
      console.error('Game error:', error);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [roomId]);

  const playCard = useCallback((card, zone) => {
    if (socket) {
      socket.emit('playCard', { card, zone });
    }
  }, [socket]);

  const attack = useCallback((attacker, target) => {
    if (socket) {
      socket.emit('attack', { attacker, target });
    }
  }, [socket]);

  const changePhase = useCallback((phase) => {
    if (socket) {
      socket.emit('changePhase', { phase });
    }
  }, [socket]);

  const endTurn = useCallback(() => {
    if (socket) {
      socket.emit('endTurn');
    }
  }, [socket]);

  return {
    gameState,
    playerId,
    actions: {
      playCard,
      attack,
      changePhase,
      endTurn
    }
  };
};
