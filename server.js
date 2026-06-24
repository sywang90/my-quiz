const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'index.html')); 
});

let users = new Map(); 
let quizStarted = false;
let hasWinner = false;
let isLocking = false; // 🔒 商业高并发分布式安全锁

io.on('connection', (socket) => {
    socket.on('register', (name) => {
        users.set(socket.id, name);
        socket.emit('registered', name);
        io.emit('updateUserList', Array.from(users.values()));
    });

    socket.on('startQuiz', () => {
        quizStarted = true;
        hasWinner = false;
        isLocking = false; // 重置锁
        io.emit('quizStarted'); 
    });

    // 🚀 核心安全升级：确保 200 人高并发下绝对唯一的绝对绝杀
    socket.on('pressButton', () => {
        if (!quizStarted || hasWinner || isLocking) {
            socket.emit('invalidPress');
            return;
        }
        
        isLocking = true; // 瞬间原子锁闭，拦截后面慢了0.001秒的其余200人
        hasWinner = true;
        quizStarted = false; 
        
        const winnerName = users.get(socket.id) || "未知特工";
        io.emit('quizEnd', winnerName);
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
    console.log(`🎉 200人级商业抢答服务器已就绪，正在监听: ${PORT}`);
});