const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// CORSの設定
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// 静的ファイルの提供
app.use(express.static(path.join(__dirname)));

// ゲームルームの管理
const rooms = new Map();

// WebSocket接続の管理
const clients = new Map();

// ルーム一覧の取得用のHTTPエンドポイント
app.get('/api/rooms', (req, res) => {
    try {
        console.log('Rooms API called - Current rooms:', rooms.size);
        const roomList = Array.from(rooms.values()).map(room => {
            console.log('Processing room:', room);
            return {
                id: room.id,
                name: room.name,
                players: room.players.length,
                maxPlayers: 2,
                status: room.players.length >= 2 ? 'フル' : '参加可能'
            };
        });
        console.log('Sending room list:', roomList);
        res.json(roomList);
    } catch (error) {
        console.error('Error in /api/rooms endpoint:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// ゲームルームの作成
function createRoom(roomName, creator) {
    const roomId = uuidv4();
    console.log(`Creating room: ${roomName} (ID: ${roomId}) by creator: ${creator}`);
    
    const gameState = {
        players: [],
        currentPlayerIndex: 0,
        turnCount: 1,
        gamePhase: "waiting",
        lastAction: null
    };

    rooms.set(roomId, {
        id: roomId,
        name: roomName,
        players: [creator],
        gameState: gameState
    });

    console.log(`Room created successfully. Current rooms: ${rooms.size}`);
    
    // 全クライアントにルーム作成を通知
    broadcastToAll({
        type: 'room_list_update'
    });

    return roomId;
}

// 全クライアントへのブロードキャスト
function broadcastToAll(message) {
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// クライアントへのメッセージ送信
function sendTo(client, message) {
    if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
    }
}

// ルーム内の全プレイヤーへのメッセージ送信
function broadcastToRoom(roomId, message, excludeClient = null) {
    const room = rooms.get(roomId);
    if (!room) return;

    room.players.forEach(playerId => {
        const client = clients.get(playerId);
        if (client && client !== excludeClient) {
            sendTo(client, message);
        }
    });
}

// WebSocket接続ハンドラ
wss.on('connection', (ws) => {
    const clientId = uuidv4();
    clients.set(clientId, ws);
    ws.clientId = clientId;

    console.log(`Client connected: ${clientId}`);

    // メッセージ受信ハンドラ
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, data);
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

    // 切断ハンドラ
    ws.on('close', () => {
        handleDisconnect(ws);
    });
});

// メッセージハンドラ
function handleMessage(ws, data) {
    switch (data.type) {
        case 'create_room':
            const roomId = createRoom(data.roomName, ws.clientId);
            sendTo(ws, {
                type: 'room_created',
                roomId: roomId,
                roomName: data.roomName
            });
            break;

        case 'join_room':
            handleJoinRoom(ws, data.roomId);
            break;

        case 'game_action':
            handleGameAction(ws, data);
            break;

        default:
            console.log('Unknown message type:', data.type);
    }
}

// ルーム参加ハンドラ
function handleJoinRoom(ws, roomId) {
    const room = rooms.get(roomId);
    if (!room) {
        sendTo(ws, { type: 'error', message: 'Room not found' });
        return;
    }

    if (room.players.length >= 2) {
        sendTo(ws, { type: 'error', message: 'Room is full' });
        return;
    }

    room.players.push(ws.clientId);
    
    // 両プレイヤーが揃った場合、ゲームを開始
    if (room.players.length === 2) {
        initializeGame(roomId);
    }

    broadcastToRoom(roomId, {
        type: 'player_joined',
        playerId: ws.clientId,
        playerCount: room.players.length
    });
}

// ゲーム初期化
function initializeGame(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;

    // デッキの生成とシャッフル
    const player1Deck = generateDeck();
    const player2Deck = generateDeck();

    // ゲームの初期状態を設定
    room.gameState = {
        players: room.players.map((playerId, index) => ({
            id: playerId,
            name: `プレイヤー${index + 1}`,
            lp: 10000,
            core: 5,
            deck: index === 0 ? player1Deck : player2Deck,
            hand: [],
            fieldUnits: [],
            fieldTrap: null,
            fieldResource: null,
            discardPile: [],
            isTurnPlayer: index === 0
        })),
        currentPlayerIndex: 0,
        turnCount: 1,
        gamePhase: "start",
        lastAction: null
    };

    // 各プレイヤーに3枚ずつドロー
    room.gameState.players.forEach(player => {
        for (let i = 0; i < 3; i++) {
            drawCard(player);
        }
    });

    // 全プレイヤーに初期状態を送信
    broadcastToRoom(roomId, {
        type: 'game_start',
        gameState: room.gameState
    });
}

// カードを引く処理
function drawCard(player) {
    if (player.deck.length > 0) {
        if (player.hand.length < MAX_HAND_SIZE) {
            const card = player.deck.pop();
            player.hand.push(card);
            return true;
        }
    }
    return false;
}

// ゲームアクション処理
function handleGameAction(ws, data) {
    const { roomId, action, ...actionData } = data;
    const room = rooms.get(roomId);
    if (!room) return;

    const gameState = room.gameState;
    const player = gameState.players.find(p => p.id === ws.clientId);
    if (!player) return;

    // アクションに応じた状態更新
    switch (action) {
        case 'play_card':
            const { cardId, targetId } = actionData;
            playCard(gameState, player, cardId, targetId);
            break;
        case 'attack':
            const { attackerId, targetId: attackTargetId } = actionData;
            handleAttack(gameState, player, attackerId, attackTargetId);
            break;
        case 'end_turn':
            handleEndTurn(gameState);
            break;
    }

    // 更新された状態を全プレイヤーに送信
    broadcastToRoom(roomId, {
        type: 'game_update',
        gameState: gameState
    });
}

// 各種ゲームロジック関数
function playCard(gameState, player, cardId, targetId) {
    // カードプレイのロジック
    // ...
}

function handleAttack(gameState, player, attackerId, targetId) {
    // 攻撃処理のロジック
    // ...
}

function handleEndTurn(gameState) {
    // ターン終了処理
    gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % 2;
    gameState.players.forEach(p => p.isTurnPlayer = false);
    gameState.players[gameState.currentPlayerIndex].isTurnPlayer = true;
    gameState.turnCount++;
    gameState.gamePhase = "start";
}

// 切断処理
function handleDisconnect(ws) {
    const clientId = ws.clientId;
    clients.delete(clientId);

    // ルームからプレイヤーを削除
    rooms.forEach((room, roomId) => {
        const playerIndex = room.players.indexOf(clientId);
        if (playerIndex !== -1) {
            room.players.splice(playerIndex, 1);
            if (room.players.length === 0) {
                rooms.delete(roomId);
            } else {
                broadcastToRoom(roomId, {
                    type: 'player_disconnected',
                    playerId: clientId
                });
            }
        }
    });
}

// サーバーの起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
