// server.js (대화 내용 기억 버전)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ★ 방별로 대화 내용을 임시 저장할 객체 변수 추가
const msgHistory = {}; 

io.on('connection', (socket) => {
    console.log('새로운 유저가 접속했습니다.');

    socket.on('join room', ({ room, username }) => {
        socket.join(room);
        socket.username = username;
        socket.room = room;

        // ★ 해당 방의 대화 기록이 없다면 새로 만들어줌
        if (!msgHistory[room]) {
            msgHistory[room] = [];
        }

        // ★ 새로 들어온 사람에게 이전 대화 기록들을 전부 보내줌
        msgHistory[room].forEach((pastMsg) => {
            socket.emit('chat message', pastMsg);
        });

        // 시스템 입장 메시지
        const welcomeMsg = { username: '시스템', message: `${username}님이 입장하셨습니다.` };
        msgHistory[room].push(welcomeMsg); // 기록에 저장
        socket.to(room).emit('chat message', welcomeMsg);
    });

    socket.on('chat message', (msg) => {
        const newMsg = { username: socket.username, message: msg };
        
        // ★ 대화 내용을 방별 기록에 저장
        if (socket.room && msgHistory[socket.room]) {
            msgHistory[socket.room].push(newMsg);
        }

        io.to(socket.room).emit('chat message', newMsg);
    });

    socket.on('disconnect', () => {
        if (socket.room) {
            const exitMsg = { username: '시스템', message: `${socket.username}님이 퇴장하셨습니다.` };
            msgHistory[socket.room].push(exitMsg); // 기록에 저장
            io.to(socket.room).emit('chat message', exitMsg);
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 달리고 있습니다!`);
});