const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// 방별 대화 내용 및 메시지 ID 관리를 위한 변수
const msgHistory = {};
let messageIdCounter = 0;

io.on('connection', (socket) => {
    console.log('새로운 유저가 접속했습니다.');

    socket.on('join room', ({ room, username }) => {
        socket.join(room);
        socket.username = username;
        socket.room = room;

        if (!msgHistory[room]) {
            msgHistory[room] = [];
        }

        // 현재 방에 참여 중인 사람 수 계산
        const roomUsers = io.sockets.adapter.rooms.get(room);
        const userCount = roomUsers ? roomUsers.size : 1;

        // 사용자가 들어왔으므로, 기존에 있던 메시지 중 자기가 안 읽은 메시지들을 읽음 처리
        msgHistory[room].forEach((msg) => {
            // 보낸 사람이 내가 아니고, 아직 안 읽은 메시지라면 읽음 수 감소
            if (msg.username !== username && msg.unreadCount > 0) {
                msg.unreadCount = 0; // 단둘이 하는 채팅이므로 0으로 만듦
            }
        });

        // 방 전체에 어떤 메시지들이 읽음 처리되었는지 새로고침 신호 전송
        io.to(room).emit('update history', msgHistory[room]);

        // 시스템 입장 메시지
        const welcomeMsg = { 
            id: 'sys-' + Date.now(), 
            username: '시스템', 
            message: `${username}님이 입장하셨습니다.`,
            unreadCount: 0 
        };
        msgHistory[room].push(welcomeMsg);
        io.to(room).emit('chat message', welcomeMsg);
    });

    // 메시지를 받았을 때
    socket.on('chat message', (msg) => {
        const room = socket.room;
        const roomUsers = io.sockets.adapter.rooms.get(room);
        const userCount = roomUsers ? roomUsers.size : 1;

        // 상대방이 방에 있으면 unreadCount는 0, 나 혼자 있으면 1
        const unreadCount = userCount === 2 ? 0 : 1;

        messageIdCounter++;
        const newMsg = {
            id: 'msg-' + messageIdCounter,
            username: socket.username,
            message: msg,
            unreadCount: unreadCount
        };
        
        if (room && msgHistory[room]) {
            msgHistory[room].push(newMsg);
        }

        // 방 안의 모든 사람에게 메시지 전송 (숫자 포함)
        io.to(room).emit('chat message', newMsg);
    });

    // 상대방이 메시지를 실시간으로 읽었다고 신호를 보낼 때
    socket.on('read message', (msgId) => {
        const room = socket.room;
        if (room && msgHistory[room]) {
            const targetMsg = msgHistory[room].find(m => m.id === msgId);
            if (targetMsg && targetMsg.username !== socket.username) {
                targetMsg.unreadCount = 0;
                io.to(room).emit('msg read updated', { id: msgId, unreadCount: 0 });
            }
        }
    });

    socket.on('disconnect', () => {
        if (socket.room) {
            const exitMsg = { 
                id: 'sys-' + Date.now(), 
                username: '시스템', 
                message: `${socket.username}님이 퇴장하셨습니다.`,
                unreadCount: 0 
            };
            if (msgHistory[socket.room]) msgHistory[socket.room].push(exitMsg);
            io.to(socket.room).emit('chat message', exitMsg);
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`서버가 가동 중입니다.`);
});