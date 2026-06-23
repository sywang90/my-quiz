const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path'); // 新增

app.use(express.static(__dirname));

// 📢 核心修复：强行让根目录返回 index.html 网页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let users = new Map(); 
let quizStarted = false;
let hasWinner = false;

io.on('connection', (socket) => {
    socket.on('register', (name) => {
        users.set(socket.id, name);
        socket.emit('registered', name);
        io.emit('updateUserList', Array.from(users.values()));
    });

    socket.on('startQuiz', () => {
        quizStarted = true;
        hasWinner = false;
        io.emit('quizStarted'); 
    });

    socket.on('pressButton', () => {
        if (!quizStarted) {
            socket.emit('invalidPress');
            return;
        }
        if (!hasWinner) {
            hasWinner = true;
            quizStarted = false; 
            const winnerName = users.get(socket.id) || "未知选手";
            io.emit('quizEnd', winnerName);
        }
    });

    socket.on('luckyDraw', () => {
        if (users.size === 0) return;
        const userArray = Array.from(users.values());
        const luckyName = userArray[Math.floor(Math.random() * userArray.length)];
        io.emit('drawResult', luckyName);
    });

    socket.on('disconnect', () => {
        if (users.has(socket.id)) {
            users.delete(socket.id);
            io.emit('updateUserList', Array.from(users.values()));
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`🎉 团建安全抢答服务器已成功启动，正在监听端口: ${PORT}`);
});