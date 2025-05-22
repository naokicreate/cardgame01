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

const handleGameAction = require('./server/gameAction');

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
  });  // ゲームアクション
  socket.on('gameAction', (data) => {
    try {
      const { action } = data;
      const roomId = getRoomIdBySocket(socket);
      const room = rooms.get(roomId);
      
      if (!room || !room.gameState) {
        socket.emit('error', { message: 'ゲームが見つかりません。' });
        return;
      }
      
      const newGameState = { ...room.gameState };
      
      switch (action) {
        case 'playCard': {
          if (!data.card) {
            socket.emit('error', { message: '無効なデータ形式です。' });
            break;
          }
          
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
            case 'UNIT': {
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
            }
            
            // 他のカードタイプ(TRAP, RESOURCE)も同様に実装可能
            default: {
              socket.emit('error', { message: `${data.card.type}タイプのカードの処理は未実装です。` });
              return;
            }
          }
          break;
        }

        case 'attack': {
          if (!data.attacker || !data.target) {
            socket.emit('error', { message: '無効な攻撃データです。' });
            return;
          }
          
          const player = newGameState.players[socket.id];
          if (!player) {
            socket.emit('error', { message: 'プレイヤーが見つかりません。' });
            return;
          }
          
          // バトルフェーズチェック
          if (newGameState.currentPhase !== GAME_PHASES.BATTLE) {
            socket.emit('error', { message: 'バトルフェーズでのみ攻撃できます。' });
            return;
          }
          
          // 攻撃処理を実行
          handleAttack(socket, newGameState, data.attacker, data.target);
          break;
        }
        
        case 'changePhase': {
          if (!data.phase) {
            socket.emit('error', { message: '無効なフェーズデータです。' });
            return;
          }
          
          // フェーズ変更の処理
          handlePhaseChange(socket, newGameState, data.phase);
          break;
        }
        
        case 'endTurn': {
          // ターン終了処理
          handleEndTurn(socket, newGameState);
          break;
        }
        
        case 'selectCard': {
          if (!data.cardId) {
            socket.emit('error', { message: '無効なカード選択です。' });
            return;
          }
          
          // カード選択処理
          handleCardSelection(socket, newGameState, data.cardId);
          break;
        }
        
        default: {
          socket.emit('error', { message: '不明なアクションです。' });
          return;
        }
      }
      
      // 状態を更新して全員に通知
      room.gameState = newGameState;
      io.in(roomId).emit('gameStateUpdate', { gameState: newGameState });
    } catch (error) {
      console.error('Game action error:', error);
      socket.emit('error', { message: 'ゲームアクションの処理中にエラーが発生しました。' });
    }
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
        gameRooms.delete(roomId);        break;
      }
    }
  });
});

io.engine.on("connection_error", (err) => {
  console.log("接続エラー:", err.req, err.code, err.message, err.context);
});

// ビルドフォルダがある場合のみstaticフォルダとしてサーブする
if (fs.existsSync(path.join(__dirname, 'build'))) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
