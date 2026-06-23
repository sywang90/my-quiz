const express = require('express');
const app = express();
const http = require('http').Server(app);
const path = require('path');
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});

// 路由：所有人（包括扫码的员工）默认访问只展示签到和抢答
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 允许加载静态文件
app.use(express.static(__dirname));

let users = new Map(); 
let isQuizActive = false; // 抢答池状态锁：默认关闭
let winner = null; 

io.on('connection', (socket) => {
    
    // 1. 员工签到
    socket.on('register', (username) => {
        users.set(socket.id, username);
        // 通知所有人（特别同步给大屏幕）更新名单
        io.emit('updateUserList', Array.from(users.values())); 
        socket.emit('registered', username);
    });

    // 2. 主持人发令：开启抢答池
    socket.on('startQuiz', () => {
        isQuizActive = true; // 激活抢答池
        winner = null;
        io.emit('quizStarted'); // 广播给所有员工：按钮变红亮起
    });

    // 3. 核心安全机制：员工按下抢答键
    socket.on('pressButton', () => {
        // 【防作弊核心】必须同时满足：抢答池已开启、且当前还没有产生赢家
        if (isQuizActive && !winner) {
            isQuizActive = false; // 立刻关闭抢答池，后续所有人的抢答变为“无效”
            winner = users.get(socket.id) || "未知同仁";
            io.emit('quizEnd', winner); // 广播谁抢到了
        } else {
            // 如果抢答池没开，或者已经有人抢到了，此socket的请求直接被服务器无视，不进入有效池
            socket.emit('invalidPress'); 
        }
    });

    // 4. 主持人发令：随机抽签
    socket.on('luckyDraw', () => {
        const userArray = Array.from(users.values());
        if (userArray.length > 0) {
            const luckyOne = userArray[Math.floor(Math.random() * userArray.length)];
            io.emit('drawResult', luckyOne);
        }
    });

    socket.on('disconnect', () => {
        users.delete(socket.id);
        io.emit('updateUserList', Array.from(users.values()));
    });
});

const PORT = 3000;
http.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🎉 团建安全抢答服务器已成功启动！`);
    console.log(`👉 1. 主持人控制大屏请访问: http://localhost:3000?role=admin`);
    console.log(`👉 2. 员工扫码/抢答基础网址: http://localhost:3000`);
    console.log(`==================================================\n`);
});