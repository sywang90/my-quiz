const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// 托管当前目录下的静态资源
app.use(express.static(__dirname));

// 根路由直接指向我们的前端 index.html
app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'index.html')); 
});

let users = new Map(); 
let quizStarted = false;
let hasWinner = false;
let isLocking = false; // 🔒 200人并发原子高并发安全锁

io.on('connection', (socket) => {
    // 当有新视角（特别是大屏幕）链入时，瞬间同步当前已就位的总人数和名单
    socket.emit('updateUserList', Array.from(users.values()));

    // 选手锁定身份登记
    socket.on('register', (name) => {
        const cleanName = (name || "").trim();
        if (!cleanName) return;
        
        // 允许重名，直接存入映射表
        users.set(socket.id, cleanName);
        socket.emit('registered', cleanName);
        // 全网广播：刷新所有人及大屏幕上的就位特工名单
        io.emit('updateUserList', Array.from(users.values()));
    });

    // 主持人启动抢答
    socket.on('startQuiz', () => {
        quizStarted = true;
        hasWinner = false;
        isLocking = false; // 释放原子锁
        io.emit('quizStarted'); 
    });

    // 选手拍下足球键
    socket.on('pressButton', (clientName) => {
        // 如果未开赛、已出赢家、或锁已闭合，直接拦截
        if (!quizStarted || hasWinner || isLocking) {
            socket.emit('invalidPress');
            return;
        }
        
        isLocking = true; // 毫秒级落锁，拦截慢了0.001秒的其余所有人
        hasWinner = true;
        quizStarted = false; 
        
        // 提取最终胜者名字，若前端有闪断则使用 socket 登记名兜底
        const finalWinnerName = (clientName || users.get(socket.id) || "神秘选手").trim();
        
        // 终极全网广播：触发选手端、大屏端的震动与烟雾消散特效
        io.emit('quizEnd', finalWinnerName);
    });

    // 主持人随机点将钦点回答
    socket.on('luckyDraw', () => {
        if (users.size === 0) return;
        const userArray = Array.from(users.values());
        const luckyName = userArray[Math.floor(Math.random() * userArray.length)];
        
        // 全网广播：触发所有人及大屏幕的钦点闪现特效
        io.emit('drawResult', luckyName);
    });

    // 设备断开连接（如退出浏览器）
    socket.on('disconnect', () => {
        if (users.has(socket.id)) {
            users.delete(socket.id);
            io.emit('updateUserList', Array.from(users.values()));
        }
    });
});

// 🚀 拒绝硬编码！Render要求必须使用 process.env.PORT 动态注入端口
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`🎉 MCE 大力神杯 200人全视角大屏联动服务器已就绪，正在监听端口: ${PORT}`);
});