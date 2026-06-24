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
let isLocking = false; // 🔒 200人并发原子安全锁

io.on('connection', (socket) => {
    socket.on('register', (name) => {
        // 🚀 修正：允许重复名称进入系统。只做空值和空格的基本清洗
        const cleanName = (name || "").trim();
        if (!cleanName) return;
        
        users.set(socket.id, cleanName);
        socket.emit('registered', cleanName);
        io.emit('updateUserList', Array.from(users.values()));
    });

    socket.on('startQuiz', () => {
        quizStarted = true;
        hasWinner = false;
        isLocking = false; 
        io.emit('quizStarted'); 
    });

    socket.on('pressButton', (clientName) => {
        if (!quizStarted || hasWinner || isLocking) {
            socket.emit('invalidPress');
            return;
        }
        
        const finalWinnerName = (clientName || users.get(socket.id) || "神秘选手").trim();
        
        isLocking = true; // 瞬间落锁
        hasWinner = true;
        quizStarted = false; 
        
        io.emit('quizEnd', finalWinnerName);
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
    console.log(`🎉 200人战队级别抢答服务器已就绪，正在监听: ${PORT}`);
});