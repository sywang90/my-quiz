const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// 1. 静态资源托管：允许加载当前目录下的所有文件（如 index.html, CSS 等）
app.use(express.static(__dirname));

// 2. 根路由路由导航：直接渲染抢答系统前端主页
app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'index.html')); 
});

// 3. 核心数据状态机
let users = new Map();       // 存储当前在线的特工选手（Socket.id -> 战队昵称）
let quizStarted = false;     // 抢答锁：是否已由主持人发令开跑
let hasWinner = false;       // 赢家锁：当前题目是否已经产生获胜者
let isLocking = false;       // 毫秒级高并发原子锁：拦截第二名及以后的所有人

// 4. Socket.io 实时通信双向链路
io.on('connection', (socket) => {
    
    // 刚链入时，将目前已就位的总名单和总人数同步给大屏幕
    socket.emit('updateUserList', Array.from(users.values()));

    // 选手端：锁定身份，登记入场
    socket.on('register', (name) => {
        const cleanName = (name || "").trim();
        if (!cleanName) return;
        
        users.set(socket.id, cleanName);
        socket.emit('registered', cleanName);
        
        // 刷新大屏幕和所有人设备上的在线选手集结名单
        io.emit('updateUserList', Array.from(users.values()));
    });

    // 主持人端：按下启动键，开始3秒极速倒计时
    socket.on('startQuiz', () => {
        quizStarted = true;
        hasWinner = false;
        isLocking = false; // 彻底释放上一题的原子锁
        
        // 全网广播：所有人设备（包括大屏）同步启动倒计时
        io.emit('quizStarted'); 
    });

    // 选手端：按下 RUSH 足球金键
    socket.on('pressButton', (clientName) => {
        // 【核心防御核心】未开赛、已有赢家、或毫秒锁闭合，直接判定非法按键
        if (!quizStarted || hasWinner || isLocking) {
            socket.emit('invalidPress');
            return;
        }
        
        // 🔒 毫秒级落锁：瞬间闭合闸门，拒绝任何后续高并发请求
        isLocking = true; 
        hasWinner = true;
        quizStarted = false; 
        
        // 提取赢家名字，优先使用前端安全外发的恒定名字，若有闪断则使用注册名兜底
        const finalWinnerName = (clientName || users.get(socket.id) || "神秘特工").trim();
        
        // 终极战果广播：触发 3秒全屏狂暴颤抖 + 漫天烟雾炸开特效
        io.emit('quizEnd', finalWinnerName);
    });

    // 主持人端：命运钦点，随机抽取幸运儿回答
    socket.on('luckyDraw', () => {
        if (users.size === 0) return;
        
        const userArray = Array.from(users.values());
        const luckyName = userArray[Math.floor(Math.random() * userArray.length)];
        
        // 全网广播：触发“命运钦点”金色跑马灯闪现特效
        io.emit('drawResult', luckyName);
    });

    // 选手断开链接（如关闭浏览器、手机锁屏、退到后台）
    socket.on('disconnect', () => {
        if (users.has(socket.id)) {
            users.delete(socket.id);
            // 实时同步剔除名单，确保大屏幕人数绝对精准
            io.emit('updateUserList', Array.from(users.values()));
        }
    });
});

// 5. 🚀 拒绝硬编码！Render 强制要求读取动态端口 process.env.PORT
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`🎉 [MCE 大力神杯] 200人全视角大屏联动商业级后端已就绪！`);
    console.log(`📡 正在监听云端高速通信端口: ${PORT}`);
});