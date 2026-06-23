const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

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
        const luckyName = userArray[Math.floor(Math.random() * userArray.size)];
        io.emit('drawResult', luckyName);
    });

    socket.on('disconnect', () => {
        if (users.has(socket.id)) {
            users.delete(socket.id);
            io.emit('updateUserList', Array.from(users.values()));
        }
    });
});

// 📢 【超级重要：云端自适应端口修改】
// 如果云端有分配端口就用云端的（process.env.PORT），没有就默认用本地的 3000
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`🎉 团建安全抢答服务器已成功启动，正在监听端口: ${PORT}`);
});