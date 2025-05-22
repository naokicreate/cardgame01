// ゲームアクションハンドラ
const handleGameAction = (socket, io, gameRooms) => {
  return async ({ roomId, action, data }) => {
    try {
      console.log(`GameAction received: ${action} for room ${roomId} from ${socket.id}`, data);
      
      // 部屋の存在チェック
      const room = gameRooms.get(roomId);
      if (!room) {
        throw new Error('部屋が存在しません。');
      }
      
      // ゲーム開始状態チェック
      if (!room.isStarted) {
        throw new Error('ゲームがまだ開始されていません。');
      }

      const gameState = room.gameState;
      if (!gameState) {
        throw new Error('ゲーム状態がありません。');
      }
      
      // プレイヤーターンチェック
      if (gameState.currentPlayer !== socket.id && 
          (action !== 'changePhase' || gameState.currentPlayer !== socket.id)) {
        throw new Error('あなたのターンではありません。');
      }

      let newGameState = { ...gameState };
      
      switch (action) {
        case 'playCard': {
          if (!data?.card) {
            throw new Error('カードデータが無効です。');
          }

          const player = newGameState.players[socket.id];
          
          if (newGameState.currentPhase !== 'MAIN') {
            throw new Error('メインフェーズでのみカードをプレイできます。');
          }
          
          if (player.core < data.card.cost) {
            throw new Error(`コストが足りません (必要: ${data.card.cost}, 現在: ${player.core})`);
          }

          switch (data.card.type) {
            case 'UNIT': {
              const emptyUnitZoneIndex = player.unitZone.findIndex(unit => unit === null);
              if (emptyUnitZoneIndex === -1) {
                throw new Error('ユニットゾーンがいっぱいです。');
              }
              
              const cardIndex = player.hand.findIndex(c => c.id === data.card.id);
              if (cardIndex === -1) {
                throw new Error('そのカードは手札にありません。');
              }
              
              player.core -= data.card.cost;
              const playedCard = player.hand.splice(cardIndex, 1)[0];
              
              const hasFastAttack = playedCard.effects?.some(
                effect => effect.type === 'KEYWORD' && effect.name === '速攻'
              );
              
              player.unitZone[emptyUnitZoneIndex] = {
                ...playedCard,
                hasAttacked: false,
                summoningSickness: !hasFastAttack
              };
              
              io.in(roomId).emit('cardPlayed', {
                playerId: socket.id,
                card: playedCard,
                zone: 'unitZone',
                index: emptyUnitZoneIndex,
                nextPlayer: socket.id
              });
              break;
            }
            default:
              throw new Error(`${data.card.type}タイプのカードの処理は未実装です。`);
          }
          break;
        }
        
        case 'attack': {
          if (!data?.attacker || !data?.target) {
            throw new Error('攻撃データが無効です。');
          }

          if (newGameState.currentPhase !== 'BATTLE') {
            throw new Error('バトルフェーズでのみ攻撃できます。');
          }

          const player = newGameState.players[socket.id];
          const opponentId = Object.keys(newGameState.players).find(id => id !== socket.id);
          const opponent = newGameState.players[opponentId];

          const attackerUnit = player.unitZone.find(unit => unit && unit.id === data.attacker.id);
          
          if (!attackerUnit) {
            throw new Error('攻撃するユニットが見つかりません。');
          }
          
          if (attackerUnit.hasAttacked) {
            throw new Error('このユニットは既に攻撃しています。');
          }
          
          if (attackerUnit.summoningSickness) {
            throw new Error('このユニットは召喚酔いのため攻撃できません。');
          }

          if (data.target.type === 'PLAYER') {
            opponent.lp -= attackerUnit.attack;
            attackerUnit.hasAttacked = true;
            
            io.in(roomId).emit('attackResolved', {
              attacker: attackerUnit,
              target: { type: 'PLAYER', id: opponentId },
              damage: attackerUnit.attack,
              remainingLp: opponent.lp
            });
            
            if (opponent.lp <= 0) {
              newGameState.isGameOver = true;
              newGameState.winner = socket.id;
              io.in(roomId).emit('gameOver', {
                winner: room.players.find(p => p.id === socket.id)
              });
              return;
            }
          } 
          else if (data.target.type === 'UNIT') {
            const targetUnitIndex = opponent.unitZone.findIndex(unit => unit && unit.id === data.target.id);
            if (targetUnitIndex === -1) {
              throw new Error('攻撃対象のユニットが見つかりません。');
            }
            
            const targetUnit = opponent.unitZone[targetUnitIndex];
            const attackerDamage = attackerUnit.attack;
            const targetDamage = targetUnit.attack;
            
            targetUnit.health -= attackerDamage;
            attackerUnit.health -= targetDamage;
            attackerUnit.hasAttacked = true;
            
            io.in(roomId).emit('battleResolved', {
              attacker: {...attackerUnit, newHealth: attackerUnit.health},
              target: {...targetUnit, newHealth: targetUnit.health}
            });
            
            if (targetUnit.health <= 0) {
              opponent.unitZone[targetUnitIndex] = null;
              opponent.graveyard.push(targetUnit);
              io.in(roomId).emit('unitDestroyed', {
                unit: targetUnit,
                playerId: opponentId
              });
            }
            
            if (attackerUnit.health <= 0) {
              const attackerIndex = player.unitZone.findIndex(unit => unit && unit.id === attackerUnit.id);
              if (attackerIndex !== -1) {
                player.unitZone[attackerIndex] = null;
                player.graveyard.push(attackerUnit);
                io.in(roomId).emit('unitDestroyed', {
                  unit: attackerUnit,
                  playerId: socket.id
                });
              }
            }
          }
          break;
        }

        case 'changePhase': {
          if (!data?.phase) {
            throw new Error('フェーズデータが無効です。');
          }

          const currentPhaseIndex = Object.values(GAME_PHASES).indexOf(newGameState.currentPhase);
          const newPhaseIndex = Object.values(GAME_PHASES).indexOf(data.phase);
          
          if (newPhaseIndex <= currentPhaseIndex && 
              !(currentPhaseIndex === Object.values(GAME_PHASES).length - 1 && newPhaseIndex === 0)) {
            throw new Error(`${data.phase}フェーズに戻ることはできません。`);
          }
          
          newGameState.currentPhase = data.phase;
          
          if (data.phase === GAME_PHASES.DRAW) {
            const player = newGameState.players[socket.id];
            if (player?.deck.length > 0) {
              const drawnCard = player.deck.pop();
              if (!drawnCard.effects) {
                drawnCard.effects = [];
              }
              player.hand.push(drawnCard);
              socket.emit('cardDrawn', { card: drawnCard });
            } else {
              if (player) {
                player.lp -= GAME_CONSTANTS.DECK_OUT_DAMAGE;
                socket.emit('error', {
                  message: `デッキからカードが引けません。${GAME_CONSTANTS.DECK_OUT_DAMAGE}ダメージを受けました。`
                });
                
                if (player.lp <= 0) {
                  const opponentId = Object.keys(newGameState.players).find(id => id !== socket.id);
                  newGameState.isGameOver = true;
                  newGameState.winner = opponentId;
                  io.in(roomId).emit('gameOver', {
                    winner: room.players.find(p => p.id === opponentId)
                  });
                  return;
                }
              }
            }
          }
          break;
        }

        case 'endTurn': {
          const playerIds = room.players.map(p => p.id);
          const currentPlayerIndex = playerIds.indexOf(gameState.currentPlayer);
          const nextPlayerIndex = (currentPlayerIndex + 1) % playerIds.length;
          const nextPlayerId = playerIds[nextPlayerIndex];
          
          const nextPlayer = newGameState.players[nextPlayerId];
          nextPlayer.core = Math.min(
            nextPlayer.core + GAME_CONSTANTS.TURN_CORE_GAIN,
            GAME_CONSTANTS.MAX_CORE
          );
          
          nextPlayer.unitZone.forEach(unit => {
            if (unit) {
              unit.hasAttacked = false;
              unit.summoningSickness = false;
            }
          });
          
          newGameState.currentPlayer = nextPlayerId;
          newGameState.currentPhase = GAME_PHASES.START;
          break;
        }

        case 'selectCard': {
          if (!data?.card) {
            throw new Error('カード選択データが無効です。');
          }
          newGameState.selectedCard = data.card;
          newGameState.players[socket.id].selectedCard = data.card;
          io.in(roomId).emit('cardSelected', {
            playerId: socket.id,
            cardId: data.card.id
          });
          break;
        }

        default:
          throw new Error(`未知のアクション: ${action}`);
      }

      // 状態を更新して全員に通知
      room.gameState = newGameState;
      io.in(roomId).emit('gameStateUpdate', { gameState: newGameState });

    } catch (error) {
      console.error(`Error in gameAction ${action}:`, error);
      socket.emit('error', { message: error.message });
    }
  };
};

module.exports = handleGameAction;
