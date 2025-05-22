const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { 
  GAME_PHASES,
  GAME_CONSTANTS,
  createGameState,
  shuffleArray,
  dealInitialCards
} = require('./server/gameState');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'build')));

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000
});

// ゲームルームを管理するオブジェクト
const gameRooms = new Map();
// プレイヤーのデッキを一時的に保存するオブジェクト
const playerDecks = new Map();

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  // プレイヤーがデッキを準備（簡易版として省略可能に）
  socket.on('prepareDeck', ({ deck }) => {
    // デッキが省略された場合は、ダミーデッキを生成
    if (!deck || !Array.isArray(deck)) {
      const dummyDeck = Array(GAME_CONSTANTS.DECK_SIZE).fill().map((_, i) => ({
        id: `card-${i}`,
        name: `カード${i}`,
        type: 'UNIT',
        attack: Math.floor(Math.random() * 5) + 1,
        health: Math.floor(Math.random() * 5) + 1,
        cost: Math.floor(Math.random() * 3) + 1
      }));
      
      playerDecks.set(socket.id, shuffleArray(dummyDeck));
      socket.emit('deckPrepared', { success: true });
      return;
    }
    
    if (deck.length === GAME_CONSTANTS.DECK_SIZE) {
      playerDecks.set(socket.id, shuffleArray(deck));
      socket.emit('deckPrepared', { success: true });
    } else {
      socket.emit('deckPrepared', { 
        success: false, 
        error: `デッキは${GAME_CONSTANTS.DECK_SIZE}枚である必要があります。` 
      });
    }
  });  // 部屋を作成
  socket.on('createRoom', (username) => {
    console.log(`Creating room for user: ${username}`);
    
    // 自動的にダミーデッキを作成（まだデッキが準備されていない場合）
    if (!playerDecks.has(socket.id)) {
      const dummyDeck = Array(GAME_CONSTANTS.DECK_SIZE).fill().map((_, i) => ({
        id: `card-${i}`,
        name: `カード${i}`,
        type: 'UNIT',
        attack: Math.floor(Math.random() * 5) + 1,
        health: Math.floor(Math.random() * 5) + 1,
        cost: Math.floor(Math.random() * 3) + 1
      }));
      
      playerDecks.set(socket.id, shuffleArray(dummyDeck));
    }

    const roomId = Math.random().toString(36).substring(2, 8);
    socket.join(roomId);
    
    gameRooms.set(roomId, {
      id: roomId,
      players: [{
        id: socket.id,
        username,
        hand: []
      }],
      gameState: null,
      isStarted: false
    });
    
    socket.emit('roomCreated', { roomId, playerId: socket.id });
    console.log(`Room created: ${roomId} by ${username}`);
  });
  // 部屋に参加
  socket.on('joinRoom', ({ roomId, username }) => {
    if (!playerDecks.has(socket.id)) {
      // 自動的にダミーデッキを作成
      const dummyDeck = Array(GAME_CONSTANTS.DECK_SIZE).fill().map((_, i) => ({
        id: `card-${i}`,
        name: `カード${i}`,
        type: 'UNIT',
        attack: Math.floor(Math.random() * 5) + 1,
        health: Math.floor(Math.random() * 5) + 1,
        cost: Math.floor(Math.random() * 3) + 1
      }));
      
      playerDecks.set(socket.id, shuffleArray(dummyDeck));
    }

    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: '部屋が見つかりません。' });
      return;
    }
    
    if (room.players.length >= 2) {
      socket.emit('error', { message: '部屋が満員です。' });
      return;
    }    socket.join(roomId);
    room.players.push({
      id: socket.id,
      username,
      hand: []
    });

    socket.emit('roomJoined', { roomId, playerId: socket.id });
    io.in(roomId).emit('playerJoined', { 
      players: room.players
    });
    
    // プレイヤーが2人になったらゲームを開始可能（readyToStart）にする
    if (room.players.length === 2) {
      console.log(`Room ${roomId} now has 2 players, sending readyToStart`);
      io.in(roomId).emit('readyToStart', { roomId });
    }
    
    console.log(`${username} joined room: ${roomId}`);
  });// ゲームアクション
  socket.on('gameAction', ({ roomId, action, data }) => {
    const room = gameRooms.get(roomId);
    if (!room || !room.isStarted) {
      socket.emit('error', { message: 'ゲームがまだ開始されていないか、部屋が存在しません。' });
      return;
    }

    const gameState = room.gameState;
    // アクションによって条件を変える（フェーズ変更はカレントプレイヤーだけができる）
    if (gameState.currentPlayer !== socket.id && (action !== 'changePhase' || gameState.currentPlayer !== socket.id)) {
      socket.emit('error', { message: 'あなたのターンではありません。' });
      return;
    }

    let newGameState = { ...gameState };
    console.log(`Game action received: ${action}`, data);

    switch (action) {      case 'playCard':
        // カードプレイの処理
        if (data && data.card) {
          console.log(`Card played by ${socket.id}:`, data.card);
          
          // プレイヤーの状態を取得
          const player = newGameState.players[socket.id];
          
          // メインフェーズでのみカードプレイを許可
          if (newGameState.currentPhase !== GAME_PHASES.MAIN) {
            socket.emit('error', { message: 'メインフェーズでのみカードをプレイできます。' });
            return;
          }
          
          // コストチェック
          if (player.core < data.card.cost) {
            socket.emit('error', { message: `このカードをプレイするには${data.card.cost}コアが必要です。` });
            return;
          }
          
          // カード種類に応じた処理
          switch (data.card.type) {
            case 'UNIT':
              // ユニット召喚処理
              const emptyUnitZoneIndex = player.unitZone.findIndex(unit => unit === null);
              if (emptyUnitZoneIndex === -1) {
                socket.emit('error', { message: 'ユニットゾーンがいっぱいです。' });
                return;
              }
              
              // カードを手札から除く
              const cardIndex = player.hand.findIndex(c => c.id === data.card.id);
              if (cardIndex === -1) {
                socket.emit('error', { message: 'そのカードは手札にありません。' });
                return;
              }
              
              // コストを支払い、カードをフィールドに出す
              player.core -= data.card.cost;
              const playedCard = player.hand.splice(cardIndex, 1)[0];
              
              // 召喚酔いを設定(速攻持ちは除く)
              const hasFastAttack = playedCard.effects && playedCard.effects.some(
                effect => effect.type === 'KEYWORD' && effect.name === '速攻'
              );
              
              player.unitZone[emptyUnitZoneIndex] = {
                ...playedCard,
                hasAttacked: false,
                summoningSickness: !hasFastAttack
              };
              
              // カードプレイイベントを通知
              io.in(roomId).emit('cardPlayed', {
                playerId: socket.id,
                card: playedCard,
                zone: 'unitZone',
                index: emptyUnitZoneIndex,
                nextPlayer: socket.id  // 現在のプレイヤーはまだ変わらない
              });
              break;
              
            // 他のカードタイプ(TRAP, RESOURCE)も同様に実装可能
            default:
              socket.emit('error', { message: `${data.card.type}タイプのカードの処理は未実装です。` });
              return;
          }
        }
        break;
          case 'attack':
        // 攻撃の処理
        if (data && data.attacker && data.target) {
          console.log(`Attack from ${socket.id}:`, data);
            // バトルフェーズでのみ攻撃を許可
          if (newGameState.currentPhase !== GAME_PHASES.BATTLE) {
            socket.emit('error', { message: 'バトルフェーズでのみ攻撃できます。' });
            return;
          }
          
          const player = newGameState.players[socket.id];
          const opponentId = Object.keys(newGameState.players).find(id => id !== socket.id);
          const opponent = newGameState.players[opponentId];
          
          // ユニットが攻撃可能か確認
          const attackerUnit = player.unitZone.find(unit => unit && unit.id === data.attacker.id);
          if (!attackerUnit) {
            socket.emit('error', { message: '攻撃するユニットが見つかりません。' });
            return;
          }
          
          if (attackerUnit.hasAttacked) {
            socket.emit('error', { message: 'このユニットは既に攻撃しています。' });
            return;
          }
          
          if (attackerUnit.summoningSickness) {
            socket.emit('error', { message: 'このユニットは召喚酔いのため攻撃できません。' });
            return;
          }
          
          // 攻撃処理 - プレイヤー攻撃の場合
          if (data.target.type === 'PLAYER') {
            // 相手プレイヤーへのダメージ
            opponent.lp -= attackerUnit.attack;
            console.log(`Player ${opponentId} takes ${attackerUnit.attack} damage from unit ${attackerUnit.name}`);
            
            // 攻撃済みマーク
            attackerUnit.hasAttacked = true;
            
            // 攻撃イベント送信
            io.in(roomId).emit('attackResolved', {
              attacker: attackerUnit,
              target: { type: 'PLAYER', id: opponentId },
              damage: attackerUnit.attack,
              remainingLp: opponent.lp
            });
            
            // 勝敗判定
            if (opponent.lp <= 0) {
              newGameState.isGameOver = true;
              newGameState.winner = socket.id;
              io.in(roomId).emit('gameOver', { 
                winner: room.players.find(p => p.id === socket.id)
              });
              return;
            }
          } 
          // ユニット攻撃の場合
          else if (data.target.type === 'UNIT') {
            // 相手ユニットを見つける
            const targetUnitIndex = opponent.unitZone.findIndex(unit => unit && unit.id === data.target.id);
            if (targetUnitIndex === -1) {
              socket.emit('error', { message: '攻撃対象のユニットが見つかりません。' });
              return;
            }
            
            const targetUnit = opponent.unitZone[targetUnitIndex];
            
            // 戦闘処理
            const attackerDamage = attackerUnit.attack;
            const targetDamage = targetUnit.attack;
            
            // 相互ダメージ
            targetUnit.health -= attackerDamage;
            attackerUnit.health -= targetDamage;
            
            // 攻撃済みマーク
            attackerUnit.hasAttacked = true;
            
            // 戦闘結果送信
            io.in(roomId).emit('battleResolved', {
              attacker: {...attackerUnit, newHealth: attackerUnit.health},
              target: {...targetUnit, newHealth: targetUnit.health}
            });
            
            // ユニット破壊判定
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
        }
        break;
          case 'changePhase':
        // フェーズ変更の処理
        if (data && data.phase) {
          // フェーズの順序チェック - 一方通行のみ許可
          const currentPhaseIndex = Object.values(GAME_PHASES).indexOf(newGameState.currentPhase);
          const newPhaseIndex = Object.values(GAME_PHASES).indexOf(data.phase);
          
          // 正しいフェーズ順序かチェック (currentPhase → newPhase が一方通行)
          if (newPhaseIndex <= currentPhaseIndex && !(currentPhaseIndex === Object.values(GAME_PHASES).length - 1 && newPhaseIndex === 0)) {
            console.log(`Invalid phase change from ${newGameState.currentPhase} to ${data.phase}`);
            socket.emit('error', { message: `${data.phase}フェーズに戻ることはできません。` });
            return;
          }
          
          newGameState.currentPhase = data.phase;
          console.log(`Phase changed to ${data.phase} by ${socket.id}`);
            // ドローフェーズの場合、カードを自動で引く
          if (data.phase === GAME_PHASES.DRAW) {
            const player = newGameState.players[socket.id];
            if (player && player.deck.length > 0) {
              const drawnCard = player.deck.pop();
              // effects配列が存在しなければ初期化
              if (!drawnCard.effects) {
                drawnCard.effects = [];
              }
              player.hand.push(drawnCard);
              console.log(`Player ${socket.id} drew a card:`, drawnCard);
              
              // 個別にカード情報を送信
              socket.emit('cardDrawn', { card: drawnCard });
            } else {
              // デッキ切れの処理
              if (player) {
                player.lp -= GAME_CONSTANTS.DECK_OUT_DAMAGE;
                console.log(`Player ${socket.id} deck out damage: ${GAME_CONSTANTS.DECK_OUT_DAMAGE}`);
                socket.emit('error', { message: `デッキからカードが引けません。${GAME_CONSTANTS.DECK_OUT_DAMAGE}ダメージを受けました。` });
                
                // 勝敗判定
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
        }
        break;
          case 'endTurn':
        // ターン終了の処理
        const playerIds = room.players.map(p => p.id);
        const currentPlayerIndex = playerIds.indexOf(gameState.currentPlayer);
        const nextPlayerIndex = (currentPlayerIndex + 1) % playerIds.length;
        const nextPlayerId = playerIds[nextPlayerIndex];
        
        // 次のプレイヤーのターン開始処理
        
        // スタートフェーズでコアを獲得
        const nextPlayer = newGameState.players[nextPlayerId];
        nextPlayer.core = Math.min(nextPlayer.core + GAME_CONSTANTS.TURN_CORE_GAIN, GAME_CONSTANTS.MAX_CORE);
        
        // 召喚酔いをリセット
        nextPlayer.unitZone.forEach(unit => {
          if (unit) {
            unit.hasAttacked = false;
            unit.summoningSickness = false;
          }
        });
        
        // 新しい現在プレイヤーとフェーズを設定
        newGameState.currentPlayer = nextPlayerId;
        newGameState.currentPhase = GAME_PHASES.START;
        
        console.log(`Turn ended by ${socket.id}. Next player: ${newGameState.currentPlayer}`);
        console.log(`Next player core: ${nextPlayer.core}`);
        
        break;
        
      case 'selectCard':
        // カード選択の処理
        if (data && data.card) {
          newGameState.selectedCard = data.card;
          console.log(`Card selected by ${socket.id}:`, data.card);
        }
        break;
    }

    // 状態を更新して全員に通知
    room.gameState = newGameState;
    io.in(roomId).emit('gameStateUpdate', { gameState: newGameState });
  });
  // ゲーム開始リクエストに応答
  socket.on('startGame', (roomId) => {
    console.log(`Start game requested for room: ${roomId} by ${socket.id}`);
    const room = gameRooms.get(roomId);
    
    if (!room) {
      console.log(`Error: Room ${roomId} not found`);
      socket.emit('error', { message: '部屋が見つかりません。' });
      return;
    }
    
    console.log(`Room found: ${roomId}, players: ${room.players.length}`);
    
    if (room.players.length < 2) {
      console.log(`Error: Room ${roomId} needs 2 players, has ${room.players.length}`);
      socket.emit('error', { message: 'ゲームを開始するには2人のプレイヤーが必要です。' });
      return;
    }
    
    if (room.isStarted) {
      console.log(`Room ${roomId} already started, resending game state`);
      // すでにゲームが開始されている場合は、ゲーム状態を再送信
      io.in(roomId).emit('gameStart', {
        gameState: room.gameState,
        players: room.players
      });
      return;
    }
    
    // ゲーム状態を初期化
    const [player1, player2] = room.players;
    const gameState = createGameState(player1.id, player2.id);
    
    // 各プレイヤーのデッキを設定（すでにデッキがあるかを確認）
    if (playerDecks.has(player1.id)) {
      gameState.players[player1.id].deck = playerDecks.get(player1.id);
    } else {      // ダミーデッキを作成（テスト用）
      gameState.players[player1.id].deck = Array(GAME_CONSTANTS.DECK_SIZE).fill().map((_, i) => ({
        id: `card-p1-${i}`,
        name: `カード${i}`,
        type: 'UNIT',
        attack: Math.floor(Math.random() * 5) + 1,
        health: Math.floor(Math.random() * 5) + 1,
        cost: Math.floor(Math.random() * 3) + 1,
        effects: [
          {
            type: 'KEYWORD',
            name: i % 4 === 0 ? '速攻' : i % 4 === 1 ? '飛行' : i % 4 === 2 ? '挑発' : '毒'
          }
        ],
        description: `効果テキスト: カード${i}の効果説明`,
        illust_url: `https://placehold.co/100x140?text=Card${i}`
      }));
    }
    
    if (playerDecks.has(player2.id)) {
      gameState.players[player2.id].deck = playerDecks.get(player2.id);
    } else {      // ダミーデッキを作成（テスト用）
      gameState.players[player2.id].deck = Array(GAME_CONSTANTS.DECK_SIZE).fill().map((_, i) => ({
        id: `card-p2-${i}`,
        name: `カード${i}`,
        type: 'UNIT',
        attack: Math.floor(Math.random() * 5) + 1,
        health: Math.floor(Math.random() * 5) + 1,
        cost: Math.floor(Math.random() * 3) + 1,
        effects: [
          {
            type: 'KEYWORD',
            name: i % 4 === 0 ? '速攻' : i % 4 === 1 ? '飛行' : i % 4 === 2 ? '挑発' : '毒'
          }
        ],
        description: `効果テキスト: カード${i}の効果説明`,
        illust_url: `https://placehold.co/100x140?text=Card${i}`
      }));
    }
      // 初期手札を配る
    room.gameState = dealInitialCards(gameState);
    room.isStarted = true;

    console.log(`Game initialization complete for room: ${roomId}`);
    console.log(`Player 1: ${player1.id}, Player 2: ${player2.id}`);
    console.log(`Current player: ${room.gameState.currentPlayer}`);

    // 各プレイヤーに初期状態を送信
    io.in(roomId).emit('gameStart', {
      gameState: room.gameState,
      players: room.players
    });
    
    console.log(`Game started in room: ${roomId}, gameStart event emitted`);
  });

  // 切断時の処理
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    playerDecks.delete(socket.id);

    // プレイヤーが参加していた部屋を検索して更新
    for (const [roomId, room] of gameRooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        io.in(roomId).emit('playerLeft', { 
          playerId: socket.id,
          username: room.players[playerIndex].username
        });
        gameRooms.delete(roomId);
        break;
      }
    }  });
});
io.engine.on("connection_error", (err) => {  console.log("接続エラー:", err.req, err.code, err.message, err.context);
});

// ビルドフォルダがある場合のみstaticフォルダとしてサーブする
if (fs.existsSync(path.join(__dirname, 'build'))) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
