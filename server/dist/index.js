import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { WebSocket, WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { createServer } from 'node:http';
// ゲーム状態
const rooms = {};
const clients = {};
// Honoアプリ
const app = new Hono();
// 基本的なAPI
app.get('/', (c) => {
    return c.text('CardGame Server is running!');
});
// 部屋一覧を取得するエンドポイント
app.get('/api/rooms', (c) => {
    const roomList = Object.values(rooms)
        .filter(room => room.status === 'waiting')
        .map(room => ({
        id: room.id,
        name: room.name,
        hostName: room.host.name
    }));
    return c.json(roomList);
});
// HTTPサーバー作成
const httpServer = createServer();
const port = 3000;
// WebSocketサーバー
const wss = new WebSocketServer({ server: httpServer });
wss.on('connection', (ws) => {
    console.log('Client connected');
    const clientId = uuidv4();
    // クライアント登録（初期状態）
    clients[clientId] = {
        id: clientId,
        name: `Player_${clientId.substring(0, 6)}`,
        ws,
        roomId: null
    };
    // 初期化メッセージ送信
    ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        message: 'Connected to game server'
    }));
    // メッセージ受信処理
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            handleClientMessage(clientId, data);
        }
        catch (error) {
            console.error('Invalid message format:', error);
        }
    });
    // 切断処理
    ws.on('close', () => {
        const client = clients[clientId];
        // プレイヤーが部屋にいる場合、部屋から退出
        if (client && client.roomId) {
            const room = rooms[client.roomId];
            if (room) {
                // ホストが退出した場合、部屋を削除
                if (room.host.id === clientId) {
                    // ゲストがいる場合、ゲストにも通知
                    if (room.guest) {
                        const guestClient = clients[room.guest.id];
                        if (guestClient && guestClient.ws) {
                            guestClient.ws.send(JSON.stringify({
                                type: 'roomClosed',
                                message: 'Host left the room'
                            }));
                            guestClient.roomId = null;
                        }
                    }
                    delete rooms[client.roomId];
                }
                // ゲストが退出した場合
                else if (room.guest && room.guest.id === clientId) {
                    room.guest = null;
                    room.status = 'waiting';
                    // ホストに通知
                    const hostClient = clients[room.host.id];
                    if (hostClient && hostClient.ws) {
                        hostClient.ws.send(JSON.stringify({
                            type: 'playerLeft',
                            message: 'Guest left the room'
                        }));
                    }
                }
            }
        }
        // クライアント登録削除
        delete clients[clientId];
        console.log(`Client ${clientId} disconnected`);
    });
});
// クライアントメッセージの処理
function handleClientMessage(clientId, data) {
    const client = clients[clientId];
    if (!client)
        return;
    console.log(`Received message from ${clientId}:`, data);
    switch (data.type) {
        case 'setName':
            // プレイヤー名設定
            client.name = data.name || client.name;
            client.ws.send(JSON.stringify({
                type: 'nameUpdated',
                name: client.name
            }));
            break;
        case 'createRoom':
            // 部屋作成
            const roomId = uuidv4();
            const roomName = data.roomName || `Room_${roomId.substring(0, 6)}`;
            rooms[roomId] = {
                id: roomId,
                name: roomName,
                host: {
                    id: clientId,
                    name: client.name
                },
                guest: null,
                status: 'waiting'
            };
            client.roomId = roomId;
            // 部屋作成完了通知
            client.ws.send(JSON.stringify({
                type: 'roomCreated',
                roomId,
                roomName
            }));
            break;
        case 'joinRoom':
            // 部屋に参加
            const room = rooms[data.roomId];
            if (!room) {
                client.ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Room not found'
                }));
                return;
            }
            if (room.status !== 'waiting') {
                client.ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Room is not available'
                }));
                return;
            }
            if (room.host.id === clientId) {
                client.ws.send(JSON.stringify({
                    type: 'error',
                    message: 'You are already in this room as host'
                }));
                return;
            }
            // ゲストとして参加
            room.guest = {
                id: clientId,
                name: client.name
            };
            room.status = 'playing';
            client.roomId = data.roomId;
            // ホストに通知
            const hostClient = clients[room.host.id];
            if (hostClient && hostClient.ws) {
                hostClient.ws.send(JSON.stringify({
                    type: 'playerJoined',
                    player: {
                        id: clientId,
                        name: client.name
                    }
                }));
            }
            // ゲストに通知
            client.ws.send(JSON.stringify({
                type: 'joinedRoom',
                room: {
                    id: room.id,
                    name: room.name,
                    host: {
                        id: room.host.id,
                        name: room.host.name
                    }
                }
            }));
            // ゲーム開始通知
            setTimeout(() => {
                broadcastToRoom(room.id, {
                    type: 'gameStart',
                    players: {
                        host: {
                            id: room.host.id,
                            name: room.host.name
                        },
                        guest: {
                            id: room.guest.id,
                            name: room.guest.name
                        }
                    }
                });
            }, 1000);
            break;
        case 'gameAction':
            // ゲームアクション処理
            if (!client.roomId || !rooms[client.roomId]) {
                client.ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Not in a valid room'
                }));
                return;
            }
            // 部屋の相手プレイヤーにアクションを転送
            const targetRoom = rooms[client.roomId];
            const isHost = targetRoom.host.id === clientId;
            const targetId = isHost
                ? (targetRoom.guest ? targetRoom.guest.id : null)
                : targetRoom.host.id;
            if (targetId) {
                const targetClient = clients[targetId];
                if (targetClient && targetClient.ws) {
                    targetClient.ws.send(JSON.stringify({
                        type: 'opponentAction',
                        action: data.action,
                        data: data.data
                    }));
                }
            }
            break;
    }
}
// 部屋の全プレイヤーにメッセージをブロードキャスト
function broadcastToRoom(roomId, message) {
    const room = rooms[roomId];
    if (!room)
        return;
    // ホストに送信
    const hostClient = clients[room.host.id];
    if (hostClient && hostClient.ws) {
        hostClient.ws.send(JSON.stringify(message));
    }
    // ゲストに送信
    if (room.guest) {
        const guestClient = clients[room.guest.id];
        if (guestClient && guestClient.ws) {
            guestClient.ws.send(JSON.stringify(message));
        }
    }
}
// Honoのルートハンドラーを設定
httpServer.on('request', (req, res) => {
    // Honoのfetchハンドラを呼び出し
    app.fetch(new Request(`http://${req.headers.host}${req.url}`, {
        method: req.method,
        headers: req.headers,
    })).then((honoResponse) => {
        res.statusCode = honoResponse.status;
        honoResponse.headers.forEach((value, key) => {
            res.setHeader(key, value);
        });
        return honoResponse.text();
    }).then((body) => {
        res.end(body);
    }).catch((err) => {
        console.error('Error in Hono handler:', err);
        res.statusCode = 500;
        res.end('Internal Server Error');
    });
});
// サーバー起動
httpServer.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`WebSocket server is ready`);
});
