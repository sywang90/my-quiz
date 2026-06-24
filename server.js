const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const path = require('path');

// 托管静态资源
app.use(express.static(__dirname));

// 根路由指向
app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'index.html')); 
});

let users = new Map(); 
let quizStarted = false;
let hasWinner = false;
let isLocking = false; // 🔒 200人高并发原子安全锁

io.on('connection', (socket) => {
    // 同步给新连入的设备（如大屏幕）最新的在线名单
    socket.emit('updateUserList', Array.from(users.values()));

    socket.on('register', (name) => {
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
        
        isLocking = true; // 瞬间落锁
        hasWinner = true;
        quizStarted = false; 
        
        const finalWinnerName = (clientName || users.get(socket.id) || "神秘选手").trim();
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

// 🚀 Render云端必须的动态端口自适应，并强制监听 0.0.0.0
const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`🎉 MCE 大力神杯系统已成功启动，正在监听端口: ${PORT}`);
});