// 包含完整前端页面的 HTML 模板字符串
// 注意：前端代码中的 `${}` 和反引号已被安全转义，以确保 Worker 能正确解析
const HTML_CONTENT = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>eSIM 资产与保号看板</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        body {
            background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
            background-size: 400% 400%;
            animation: gradient 15s ease infinite;
            min-height: 100vh;
        }
        @keyframes gradient {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        .glass-panel {
            background: rgba(255, 255, 255, 0.25);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.4);
            box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
        }
        .glass-card {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.5);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .glass-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 12px 24px rgba(0,0,0,0.1);
        }
        .modal-enter { opacity: 0; transform: scale(0.9); }
        .modal-enter-active { opacity: 1; transform: scale(1); transition: all 0.3s ease; }
    </style>
</head>
<body class="text-gray-800 font-sans p-4 md:p-8 relative">

    <div id="login-container" class="max-w-md mx-auto glass-panel rounded-3xl p-8 md:p-10 mt-16 md:mt-32 text-center transition-all">
        <div class="w-20 h-20 bg-white/50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <i class="fa-solid fa-shield-halved text-4xl text-blue-600"></i>
        </div>
        <h2 class="text-3xl font-extrabold text-gray-900 mb-2">安全验证</h2>
        <p class="text-gray-600 mb-8 text-sm font-medium">为保护您的卡片资产，请获取验证码登录。</p>
        
        <div class="mb-6 relative">
            <input type="text" id="authCode" placeholder="输入 6 位数验证码" maxlength="6" class="w-full px-4 py-4 rounded-xl border border-gray-300/50 text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/70 shadow-inner placeholder-gray-400 placeholder:tracking-normal placeholder:text-base">
        </div>
        
        <div class="flex flex-col gap-4 mt-8">
            <button id="loginBtn" onclick="verifyCode()" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2">
                <i class="fa-solid fa-arrow-right-to-bracket"></i> 登录面板
            </button>
            <button id="sendCodeBtn" onclick="sendAuthCode()" class="w-full bg-white/60 hover:bg-white/80 text-blue-700 font-bold py-3.5 px-4 rounded-xl border border-blue-200/50 transition-colors flex items-center justify-center gap-2">
                <i class="fa-brands fa-telegram text-xl"></i> 向 TG 机器人获取验证码
            </button>
        </div>
    </div>

    <div id="main-container" class="max-w-6xl mx-auto glass-panel rounded-3xl p-6 md:p-10 mt-4 md:mt-8 hidden">
        <div class="flex flex-col md:flex-row justify-between items-center mb-10 border-b border-white/50 pb-6 gap-4">
            <div>
                <h1 class="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                    <i class="fa-solid fa-sim-card text-blue-600"></i>
                    eSIM 保号看板
                </h1>
                <p class="text-gray-700 mt-2 font-medium">自动监控卡片有效期，15天内触发 Telegram 提醒。</p>
            </div>
            <div class="flex gap-3 items-center flex-wrap justify-center">
                <span class="text-sm bg-white/50 px-4 py-2 rounded-full font-semibold shadow-sm hidden md:inline-block">
                    今日：<span id="current-date" class="text-blue-700">...</span>
                </span>
                <button onclick="openModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-bold shadow-lg transition-colors flex items-center gap-2">
                    <i class="fa-solid fa-plus"></i> 添加号码
                </button>
                <button onclick="logout()" class="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2.5 rounded-full font-bold shadow-sm transition-colors flex items-center gap-2 border border-red-200" title="退出登录">
                    <i class="fa-solid fa-right-from-bracket"></i>
                </button>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10" id="stats-container">
            </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="esim-container">
            <div class="col-span-full text-center py-10 text-gray-700 font-medium text-lg" id="loading-text">
                <i class="fa-solid fa-spinner fa-spin mr-2"></i> 正在读取数据...
            </div>
        </div>
    </div>

    <div id="addModal" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
        <div class="glass-card w-full max-w-md rounded-2xl p-6 shadow-2xl relative transition-all duration-300 transform scale-95 opacity-0 max-h-[95vh] overflow-y-auto" id="modalContent">
            <button onclick="closeModal()" class="absolute top-4 right-4 text-gray-500 hover:text-red-500 text-xl">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <h3 class="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2" id="modalTitle">
                <i class="fa-solid fa-file-circle-plus text-blue-600"></i> 新增 eSIM
            </h3>
            
            <form id="addForm" onsubmit="submitForm(event)">
                <div class="mb-4">
                    <label class="block text-gray-700 text-sm font-bold mb-2">卡片名称 (必填)</label>
                    <input type="text" id="simName" required placeholder="例如：KnowRoaming" class="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/80">
                </div>
                <div class="mb-4">
                    <label class="block text-gray-700 text-sm font-bold mb-2">手机号码带区号 (选填)</label>
                    <input type="text" id="simNumber" placeholder="例如：+1 234 567 8900" class="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/80">
                </div>
                <div class="mb-4">
                    <label class="block text-gray-700 text-sm font-bold mb-2">保号周期 (单位：天，必填)</label>
                    <input type="number" id="simCycle" required placeholder="例如：180" class="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/80">
                </div>
                <div class="mb-4">
                    <label class="block text-gray-700 text-sm font-bold mb-2">已注册平台 (选填，用逗号或空格分隔)</label>
                    <input type="text" id="simPlatforms" placeholder="例如：Telegram, Google, ChatGPT" class="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/80">
                </div>
                <div class="mb-4">
                    <label class="block text-gray-700 text-sm font-bold mb-2">备注 / 保号要求 (选填)</label>
                    <input type="text" id="simRemark" placeholder="例如：发送短信到某号码 或 充值5元" class="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/80">
                </div>
                <div class="mb-6">
                    <label class="block text-gray-700 text-sm font-bold mb-2">本次到期日 (必填)</label>
                    <input type="date" id="simExpire" required class="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/80">
                </div>
                <button type="submit" id="submitBtn" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-colors">
                    保存并监控
                </button>
            </form>
        </div>
    </div>

    <div id="confirmModal" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
        <div class="glass-card w-full max-w-sm rounded-2xl p-6 shadow-2xl relative transition-all duration-300 transform scale-95 opacity-0 text-center" id="confirmModalContent">
            <div class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm" id="confirmIconBg">
                <i class="fa-solid fa-triangle-exclamation text-3xl" id="confirmIcon"></i>
            </div>
            <h3 class="text-xl font-bold text-gray-900 mb-2" id="confirmTitle">确认操作</h3>
            <p class="text-gray-600 mb-6 text-sm whitespace-pre-line" id="confirmMessage">确定要执行此操作吗？</p>
            
            <div class="flex gap-4 w-full">
                <button onclick="closeConfirmModal()" class="flex-1 bg-white/60 hover:bg-white/80 text-gray-700 font-bold py-3 px-4 rounded-xl border border-gray-200/50 shadow-sm transition-colors">
                    取消
                </button>
                <button id="confirmActionBtn" class="flex-1 font-bold py-3 px-4 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2">
                    确定
                </button>
            </div>
        </div>
    </div>

    <script>
        // API 路由前缀
        const WORKER_API_URL = "/api/esims";
        let esimData = []; 
        let countdownInterval;
        let editingId = null; 

        // ================= 全球极其全面的 SVG 国旗字典配置 =================
        // 涵盖亚洲、欧洲、美洲、非洲、大洋洲近 170 个国家和地区
        // 特别支持北美 (+1) 共享区号下的长前缀精细匹配
        const countryFlags = [
            // 北美及加勒比海 (NANP +1) - 长区号优先匹配
            { prefix: "+1242", iso: ["bs"] }, // 巴哈马
            { prefix: "+1246", iso: ["bb"] }, // 巴巴多斯
            { prefix: "+1264", iso: ["ai"] }, // 安圭拉
            { prefix: "+1268", iso: ["ag"] }, // 安提瓜和巴布达
            { prefix: "+1284", iso: ["vg"] }, // 英属维尔京群岛
            { prefix: "+1340", iso: ["vi"] }, // 美属维尔京群岛
            { prefix: "+1345", iso: ["ky"] }, // 开曼群岛
            { prefix: "+1441", iso: ["bm"] }, // 百慕大
            { prefix: "+1473", iso: ["gd"] }, // 格林纳达
            { prefix: "+1649", iso: ["tc"] }, // 特克斯和凯科斯群岛
            { prefix: "+1664", iso: ["ms"] }, // 蒙特塞拉特
            { prefix: "+1670", iso: ["mp"] }, // 北马里亚纳群岛
            { prefix: "+1671", iso: ["gu"] }, // 关岛
            { prefix: "+1684", iso: ["as"] }, // 美属萨摩亚
            { prefix: "+1721", iso: ["sx"] }, // 荷属圣马丁
            { prefix: "+1758", iso: ["lc"] }, // 圣卢西亚
            { prefix: "+1767", iso: ["dm"] }, // 多米尼克
            { prefix: "+1784", iso: ["vc"] }, // 圣文森特和格林纳丁斯
            { prefix: "+1787", iso: ["pr"] }, // 波多黎各
            { prefix: "+1939", iso: ["pr"] }, // 波多黎各
            { prefix: "+1809", iso: ["do"] }, // 多米尼加共和国
            { prefix: "+1829", iso: ["do"] }, // 多米尼加共和国
            { prefix: "+1849", iso: ["do"] }, // 多米尼加共和国
            { prefix: "+1868", iso: ["tt"] }, // 特立尼达和多巴哥
            { prefix: "+1876", iso: ["jm"] }, // 牙买加
            { prefix: "+1", iso: ["us", "ca"] }, // 美国/加拿大 默认兜底
            
            // 亚洲
            { prefix: "+86", iso: ["cn"] },
            { prefix: "+852", iso: ["hk"] },
            { prefix: "+853", iso: ["mo"] },
            { prefix: "+886", iso: ["tw"] },
            { prefix: "+81", iso: ["jp"] },
            { prefix: "+82", iso: ["kr"] },
            { prefix: "+850", iso: ["kp"] },
            { prefix: "+65", iso: ["sg"] },
            { prefix: "+60", iso: ["my"] },
            { prefix: "+62", iso: ["id"] },
            { prefix: "+63", iso: ["ph"] },
            { prefix: "+66", iso: ["th"] },
            { prefix: "+84", iso: ["vn"] },
            { prefix: "+91", iso: ["in"] },
            { prefix: "+92", iso: ["pk"] },
            { prefix: "+93", iso: ["af"] },
            { prefix: "+94", iso: ["lk"] },
            { prefix: "+95", iso: ["mm"] },
            { prefix: "+98", iso: ["ir"] },
            { prefix: "+971", iso: ["ae"] },
            { prefix: "+972", iso: ["il"] },
            { prefix: "+973", iso: ["bh"] },
            { prefix: "+974", iso: ["qa"] },
            { prefix: "+975", iso: ["bt"] },
            { prefix: "+976", iso: ["mn"] },
            { prefix: "+977", iso: ["np"] },
            { prefix: "+960", iso: ["mv"] },
            { prefix: "+961", iso: ["lb"] },
            { prefix: "+962", iso: ["jo"] },
            { prefix: "+963", iso: ["sy"] },
            { prefix: "+964", iso: ["iq"] },
            { prefix: "+965", iso: ["kw"] },
            { prefix: "+966", iso: ["sa"] },
            { prefix: "+968", iso: ["om"] },
            { prefix: "+992", iso: ["tj"] },
            { prefix: "+993", iso: ["tm"] },
            { prefix: "+994", iso: ["az"] },
            { prefix: "+995", iso: ["ge"] },
            { prefix: "+996", iso: ["kg"] },
            { prefix: "+998", iso: ["uz"] },
            { prefix: "+855", iso: ["kh"] },
            { prefix: "+856", iso: ["la"] },
            { prefix: "+880", iso: ["bd"] },
            { prefix: "+90", iso: ["tr"] },

            // 欧洲
            { prefix: "+44", iso: ["gb"] },
            { prefix: "+33", iso: ["fr"] },
            { prefix: "+49", iso: ["de"] },
            { prefix: "+39", iso: ["it"] },
            { prefix: "+34", iso: ["es"] },
            { prefix: "+7", iso: ["ru", "kz"] }, // 俄罗斯/哈萨克斯坦
            { prefix: "+380", iso: ["ua"] },
            { prefix: "+31", iso: ["nl"] },
            { prefix: "+32", iso: ["be"] },
            { prefix: "+41", iso: ["ch"] },
            { prefix: "+43", iso: ["at"] },
            { prefix: "+46", iso: ["se"] },
            { prefix: "+47", iso: ["no"] },
            { prefix: "+48", iso: ["pl"] },
            { prefix: "+45", iso: ["dk"] },
            { prefix: "+358", iso: ["fi"] },
            { prefix: "+351", iso: ["pt"] },
            { prefix: "+30", iso: ["gr"] },
            { prefix: "+353", iso: ["ie"] },
            { prefix: "+370", iso: ["lt"] },
            { prefix: "+371", iso: ["lv"] },
            { prefix: "+372", iso: ["ee"] },
            { prefix: "+374", iso: ["am"] },
            { prefix: "+381", iso: ["rs"] },
            { prefix: "+359", iso: ["bg"] },
            { prefix: "+357", iso: ["cy"] },
            { prefix: "+420", iso: ["cz"] },
            { prefix: "+421", iso: ["sk"] },
            { prefix: "+36", iso: ["hu"] },
            { prefix: "+40", iso: ["ro"] },
            { prefix: "+385", iso: ["hr"] },
            { prefix: "+386", iso: ["si"] },
            { prefix: "+387", iso: ["ba"] },
            { prefix: "+389", iso: ["mk"] },
            { prefix: "+355", iso: ["al"] },
            { prefix: "+352", iso: ["lu"] },
            { prefix: "+356", iso: ["mt"] },
            { prefix: "+354", iso: ["is"] },
            { prefix: "+376", iso: ["ad"] },
            { prefix: "+373", iso: ["md"] },
            { prefix: "+377", iso: ["mc"] },
            { prefix: "+378", iso: ["sm"] },
            { prefix: "+382", iso: ["me"] },
            { prefix: "+423", iso: ["li"] },
            { prefix: "+350", iso: ["gi"] },
            { prefix: "+298", iso: ["fo"] },

            // 中美洲及南美洲
            { prefix: "+55", iso: ["br"] },
            { prefix: "+54", iso: ["ar"] },
            { prefix: "+56", iso: ["cl"] },
            { prefix: "+57", iso: ["co"] },
            { prefix: "+51", iso: ["pe"] },
            { prefix: "+58", iso: ["ve"] },
            { prefix: "+591", iso: ["bo"] },
            { prefix: "+593", iso: ["ec"] },
            { prefix: "+595", iso: ["py"] },
            { prefix: "+598", iso: ["uy"] },
            { prefix: "+592", iso: ["gy"] },
            { prefix: "+597", iso: ["sr"] },
            { prefix: "+52", iso: ["mx"] },
            { prefix: "+501", iso: ["bz"] },
            { prefix: "+502", iso: ["gt"] },
            { prefix: "+503", iso: ["sv"] },
            { prefix: "+504", iso: ["hn"] },
            { prefix: "+505", iso: ["ni"] },
            { prefix: "+506", iso: ["cr"] },
            { prefix: "+507", iso: ["pa"] },

            // 大洋洲
            { prefix: "+61", iso: ["au"] },
            { prefix: "+64", iso: ["nz"] },
            { prefix: "+679", iso: ["fj"] },
            { prefix: "+675", iso: ["pg"] },
            { prefix: "+678", iso: ["vu"] },
            { prefix: "+677", iso: ["sb"] },
            { prefix: "+676", iso: ["to"] },
            { prefix: "+685", iso: ["ws"] },
            { prefix: "+686", iso: ["ki"] },
            { prefix: "+688", iso: ["tv"] },
            { prefix: "+674", iso: ["nr"] },
            { prefix: "+680", iso: ["pw"] },
            { prefix: "+692", iso: ["mh"] },
            { prefix: "+691", iso: ["fm"] },
            { prefix: "+687", iso: ["nc"] },
            { prefix: "+689", iso: ["pf"] },

            // 非洲
            { prefix: "+27", iso: ["za"] },
            { prefix: "+234", iso: ["ng"] },
            { prefix: "+20", iso: ["eg"] },
            { prefix: "+254", iso: ["ke"] },
            { prefix: "+212", iso: ["ma"] },
            { prefix: "+213", iso: ["dz"] },
            { prefix: "+216", iso: ["tn"] },
            { prefix: "+218", iso: ["ly"] },
            { prefix: "+249", iso: ["sd"] },
            { prefix: "+251", iso: ["et"] },
            { prefix: "+255", iso: ["tz"] },
            { prefix: "+256", iso: ["ug"] },
            { prefix: "+233", iso: ["gh"] },
            { prefix: "+225", iso: ["ci"] },
            { prefix: "+237", iso: ["cm"] },
            { prefix: "+221", iso: ["sn"] },
            { prefix: "+223", iso: ["ml"] },
            { prefix: "+224", iso: ["gn"] },
            { prefix: "+228", iso: ["tg"] },
            { prefix: "+229", iso: ["bj"] },
            { prefix: "+227", iso: ["ne"] },
            { prefix: "+226", iso: ["bf"] },
            { prefix: "+231", iso: ["lr"] },
            { prefix: "+232", iso: ["sl"] },
            { prefix: "+220", iso: ["gm"] },
            { prefix: "+245", iso: ["gw"] },
            { prefix: "+238", iso: ["cv"] },
            { prefix: "+239", iso: ["st"] },
            { prefix: "+240", iso: ["gq"] },
            { prefix: "+241", iso: ["ga"] },
            { prefix: "+242", iso: ["cg"] },
            { prefix: "+243", iso: ["cd"] },
            { prefix: "+244", iso: ["ao"] },
            { prefix: "+260", iso: ["zm"] },
            { prefix: "+263", iso: ["zw"] },
            { prefix: "+264", iso: ["na"] },
            { prefix: "+267", iso: ["bw"] },
            { prefix: "+268", iso: ["sz"] },
            { prefix: "+266", iso: ["ls"] },
            { prefix: "+261", iso: ["mg"] },
            { prefix: "+230", iso: ["mu"] },
            { prefix: "+248", iso: ["sc"] },
            { prefix: "+262", iso: ["re"] },
            { prefix: "+253", iso: ["dj"] },
            { prefix: "+252", iso: ["so"] },
            { prefix: "+250", iso: ["rw"] },
            { prefix: "+257", iso: ["bi"] },
            { prefix: "+258", iso: ["mz"] },
            { prefix: "+265", iso: ["mw"] }
        ];

        function getCountryFlag(numberStr) {
            // 默认兜底图标（使用 FontAwesome，完美跨平台）
            const defaultIcon = '<i class="fa-solid fa-globe text-blue-400 text-lg"></i>';
            if (!numberStr) return defaultIcon; 
            const cleanNumber = numberStr.replace(/[\\s\\-\\(\\)\\.]/g, '');
            if (!cleanNumber.startsWith("+")) return defaultIcon; 
            
            // 核心逻辑：按 prefix 长度降序排序。
            // 这样 "+1242" 会在 "+1" 之前被匹配到，实现北美长区号的精准识别。
            const sortedFlags = countryFlags.sort((a, b) => b.prefix.length - a.prefix.length);
            for (let item of sortedFlags) {
                if (cleanNumber.startsWith(item.prefix)) {
                    // 使用 FlagCDN 生成 SVG 高清图片，多国籍用 "/" 分隔
                    return item.iso.map(code => 
                        \`<img src="https://flagcdn.com/\${code}.svg" class="inline-block w-[22px] h-auto rounded-[2px] shadow-[0_0_2px_rgba(0,0,0,0.2)]" alt="\${code}" title="国家/地区代码：\${item.prefix}">\`
                    ).join('<span class="mx-0.5 text-gray-300 text-xs">/</span>');
                }
            }
            return defaultIcon; 
        }

        document.getElementById('current-date').innerText = new Date().toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
        
        window.onload = () => {
            if (localStorage.getItem('esim_auth_token')) {
                fetchEsimData();
            }
        };

        function getAuthHeaders() {
            return {
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('esim_auth_token') || ''
            };
        }

        // ================= 安全验证相关功能 =================
        async function sendAuthCode() {
            const btn = document.getElementById('sendCodeBtn');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> 发送中...';
            
            try {
                const response = await fetch('/api/auth/send', { method: 'POST' });
                const data = await response.json();
                
                if (response.ok && data.success) {
                    let timeLeft = 60;
                    btn.innerHTML = \`<i class="fa-solid fa-clock mr-2"></i> \${timeLeft} 秒后可重发\`;
                    countdownInterval = setInterval(() => {
                        timeLeft--;
                        if (timeLeft <= 0) {
                            clearInterval(countdownInterval);
                            btn.disabled = false;
                            btn.innerHTML = '<i class="fa-brands fa-telegram text-xl mr-2"></i> 向 TG 机器人获取验证码';
                        } else {
                            btn.innerHTML = \`<i class="fa-solid fa-clock mr-2"></i> \${timeLeft} 秒后可重发\`;
                        }
                    }, 1000);
                } else {
                    alert("发送失败: " + (data.message || "后端未配置机器人信息"));
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-brands fa-telegram text-xl mr-2"></i> 向 TG 机器人获取验证码';
                }
            } catch (e) {
                alert("网络错误，发送失败");
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-brands fa-telegram text-xl mr-2"></i> 向 TG 机器人获取验证码';
            }
        }

        async function verifyCode() {
            const codeInput = document.getElementById('authCode').value.trim();
            if (!codeInput || codeInput.length !== 6) return alert("请输入完整的 6 位数字验证码");
            
            const btn = document.getElementById('loginBtn');
            const originalHTML = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> 验证中...';
            
            try {
                const response = await fetch('/api/auth/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: codeInput })
                });
                const data = await response.json();
                
                if (response.ok && data.success) {
                    localStorage.setItem('esim_auth_token', data.token);
                    document.getElementById('authCode').value = '';
                    fetchEsimData();
                } else {
                    alert("登录失败: " + (data.message || "验证码错误或已过期"));
                    btn.disabled = false;
                    btn.innerHTML = originalHTML;
                }
            } catch (e) {
                alert("网络错误，验证失败");
                btn.disabled = false;
                btn.innerHTML = originalHTML;
            }
        }

        function logout() {
            localStorage.removeItem('esim_auth_token');
            document.getElementById('login-container').classList.remove('hidden');
            document.getElementById('main-container').classList.add('hidden');
        }

        // ================= 核心业务相关功能 =================
        async function fetchEsimData() {
            const container = document.getElementById('esim-container');
            container.innerHTML = \`<div class="col-span-full text-center py-10 text-gray-700 font-medium text-lg"><i class="fa-solid fa-spinner fa-spin mr-2"></i> 正在加载数据...</div>\`;
            
            try {
                const response = await fetch(WORKER_API_URL, { headers: getAuthHeaders() });
                
                if (response.status === 401) {
                    logout();
                    return;
                }

                if (!response.ok) throw new Error("网络请求失败");
                
                esimData = await response.json();
                
                document.getElementById('login-container').classList.add('hidden');
                document.getElementById('main-container').classList.remove('hidden');
                
                renderCards(esimData);
            } catch (error) {
                console.error("加载失败:", error);
                container.innerHTML = \`
                    <div class="col-span-full text-center py-10">
                        <i class="fa-solid fa-triangle-exclamation text-4xl text-red-500 mb-3"></i>
                        <h3 class="text-xl font-bold text-gray-800">获取数据失败</h3>
                        <p class="text-gray-600 mt-2">网络异常，请重试。</p>
                    </div>\`;
            }
        }

        function renderCards(esims) {
            const container = document.getElementById('esim-container');
            const statsContainer = document.getElementById('stats-container');
            container.innerHTML = ''; 

            let safeCount = 0;
            let warningCount = 0;
            let dangerCount = 0;
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if(esims.length === 0) {
                container.innerHTML = \`<div class="col-span-full text-center py-16 text-gray-500"><i class="fa-solid fa-box-open text-4xl mb-3"></i><p>还没有添加任何号码，点击右上角添加吧！</p></div>\`;
            }

            esims.sort((a, b) => new Date(a.expireDate) - new Date(b.expireDate));

            esims.forEach(sim => {
                const expDate = new Date(sim.expireDate);
                expDate.setHours(0, 0, 0, 0);
                const diffTime = expDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                let statusColor = "bg-green-500";
                let statusText = "状态安全";
                let badgeClass = "bg-green-100 text-green-800";
                let icon = "fa-check-circle text-green-500";

                if (diffDays <= 0) {
                    statusColor = "bg-gray-500";
                    statusText = diffDays === 0 ? "今日到期" : "已过期";
                    badgeClass = "bg-gray-100 text-gray-800";
                    icon = "fa-times-circle text-gray-500";
                    dangerCount++;
                } else if (diffDays <= 15) {
                    statusColor = "bg-red-500";
                    statusText = "即将过期";
                    badgeClass = "bg-red-100 text-red-800";
                    icon = "fa-triangle-exclamation text-red-500";
                    dangerCount++;
                } else if (diffDays <= 45) {
                    statusColor = "bg-yellow-400";
                    statusText = "建议关注";
                    badgeClass = "bg-yellow-100 text-yellow-800";
                    icon = "fa-bell text-yellow-500";
                    warningCount++;
                } else {
                    safeCount++;
                }

                let percent = Math.min(Math.max((diffDays / 365) * 100, 0), 100);
                const flagHTML = getCountryFlag(sim.number);
                
                // 渲染备注区域
                const remarkHTML = sim.remark ? \`<div class="bg-blue-50/60 rounded-lg p-2.5 mb-3 text-xs text-gray-700 border border-blue-100/60 break-words leading-relaxed"><i class="fa-regular fa-comment-dots mr-1.5 text-blue-400"></i>\${sim.remark}</div>\` : '';

                // 渲染已注册平台区域 (将字符串切割并转化为美观的标签)
                let platformsHTML = '';
                if (sim.platforms && sim.platforms.trim() !== '') {
                    // 支持逗号、全角逗号或空格分割
                    const pList = sim.platforms.split(/[,，\\s]+/).filter(p => p.trim() !== '');
                    if (pList.length > 0) {
                        const badges = pList.map(p => \`<span class="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm whitespace-nowrap mb-1.5 mr-1.5"><i class="fa-solid fa-hashtag mr-1 opacity-60"></i>\${p}</span>\`).join('');
                        platformsHTML = \`<div class="mb-3">
                            <div class="flex flex-wrap">\${badges}</div>
                        </div>\`;
                    }
                }

                const cardHTML = \`
                    <div class="glass-card rounded-2xl p-6 relative overflow-hidden group flex flex-col h-full">
                        
                        <div class="absolute top-4 right-4 flex gap-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-300 z-20 bg-white/80 p-1.5 rounded-full backdrop-blur-md border border-white/60 shadow-sm">
                            <button onclick="openEditModal('\${sim.id}')" class="text-green-600 hover:text-white hover:bg-green-500 bg-white w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm" title="编辑卡片资料">
                                <i class="fa-solid fa-pen text-sm"></i>
                            </button>
                            <button onclick="renewEsim('\${sim.id}', \${sim.cycle || 0})" class="text-blue-600 hover:text-white hover:bg-blue-500 bg-white w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm" title="一键续期（按周期顺延）">
                                <i class="fa-solid fa-rotate-right text-sm"></i>
                            </button>
                            <button onclick="deleteEsim('\${sim.id}')" class="text-red-500 hover:text-white hover:bg-red-500 bg-white w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm" title="删除号码">
                                <i class="fa-solid fa-trash-can text-sm"></i>
                            </button>
                        </div>

                        <div class="pr-28 mb-3">
                            <h2 class="text-xl font-bold text-gray-900 truncate" title="\${sim.name}">\${sim.name}</h2>
                        </div>
                        
                        <div class="flex justify-between items-center mb-4 gap-2">
                            <p class="text-gray-600 font-mono text-sm flex items-center gap-2 truncate">
                                <span class="flex items-center shrink-0">\${flagHTML}</span>
                                <span class="truncate">\${sim.number || '未登记号码'}</span>
                            </p>
                            <span class="px-2.5 py-1 rounded-full text-[11px] font-bold shadow-sm whitespace-nowrap flex-shrink-0 \${badgeClass}">
                                <i class="fa-solid \${icon} mr-1"></i>\${statusText}
                            </span>
                        </div>
                        
                        \${remarkHTML}

                        \${platformsHTML}
                        
                        <div class="mt-auto">
                            <div class="flex justify-between text-sm font-semibold mb-2">
                                <span class="text-gray-700">剩余时间</span>
                                <span class="text-gray-900 font-bold \${diffDays <= 15 && diffDays > 0 ? 'text-red-600 animate-pulse' : ''}">\${diffDays < 0 ? '0' : diffDays} 天</span>
                            </div>
                            <div class="w-full bg-gray-200/60 rounded-full h-3 mb-2 shadow-inner">
                                <div class="\${statusColor} h-3 rounded-full shadow-sm transition-all duration-1000" style="width: \${percent}%"></div>
                            </div>
                            <div class="flex justify-between text-xs text-gray-500 mt-2 font-medium">
                                <span><i class="fa-solid fa-arrows-rotate mr-1"></i>周期: \${sim.cycle || '-'} 天</span>
                                <span>到期日: \${sim.expireDate}</span>
                            </div>
                        </div>
                    </div>
                \`;
                container.innerHTML += cardHTML;
            });

            statsContainer.innerHTML = \`
                <div class="glass-card rounded-2xl p-5 flex items-center justify-between border-l-4 border-l-green-500">
                    <div>
                        <p class="text-gray-500 text-sm font-bold uppercase">安全卡片 (>45天)</p>
                        <p class="text-3xl font-black text-gray-800 mt-1">\${safeCount}</p>
                    </div>
                    <i class="fa-solid fa-shield-check text-4xl text-green-200"></i>
                </div>
                <div class="glass-card rounded-2xl p-5 flex items-center justify-between border-l-4 border-l-yellow-400">
                    <div>
                        <p class="text-gray-500 text-sm font-bold uppercase">建议关注 (<45天)</p>
                        <p class="text-3xl font-black text-gray-800 mt-1">\${warningCount}</p>
                    </div>
                    <i class="fa-solid fa-clock text-4xl text-yellow-200"></i>
                </div>
                <div class="glass-card rounded-2xl p-5 flex items-center justify-between border-l-4 border-l-red-500">
                    <div>
                        <p class="text-gray-500 text-sm font-bold uppercase">告警/过期 (<=15天)</p>
                        <p class="text-3xl font-black text-gray-800 mt-1">\${dangerCount}</p>
                    </div>
                    <i class="fa-solid fa-siren-on text-4xl text-red-200"></i>
                </div>
            \`;
        }

        async function submitForm(e) {
            e.preventDefault();
            const btn = document.getElementById('submitBtn');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>保存中...';
            btn.disabled = true;

            const payload = {
                name: document.getElementById('simName').value,
                number: document.getElementById('simNumber').value,
                cycle: parseInt(document.getElementById('simCycle').value) || 0,
                platforms: document.getElementById('simPlatforms').value, // 新增平台数据
                remark: document.getElementById('simRemark').value,
                expireDate: document.getElementById('simExpire').value
            };

            if (editingId) {
                payload.id = editingId;
            }

            try {
                const response = await fetch(WORKER_API_URL, {
                    method: editingId ? 'PUT' : 'POST', 
                    headers: getAuthHeaders(),
                    body: JSON.stringify(payload)
                });
                
                if (response.status === 401) { logout(); return; }
                if (response.ok) {
                    closeModal();
                    await fetchEsimData(); 
                } else {
                    alert("保存失败，请检查数据。");
                }
            } catch (error) {
                alert("网络错误，保存失败。");
            } finally {
                btn.innerHTML = '保存并监控';
                btn.disabled = false;
            }
        }

        // ================= 统一确认弹窗功能 =================
        function openConfirmModal(options) {
            document.getElementById('confirmTitle').innerText = options.title || '确认操作';
            document.getElementById('confirmMessage').innerText = options.message || '确定要执行此操作吗？';
            
            const btn = document.getElementById('confirmActionBtn');
            btn.innerHTML = options.btnText || '确定';
            btn.className = "flex-1 font-bold py-3 px-4 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 " + (options.btnClass || "bg-red-500 hover:bg-red-600 text-white shadow-red-500/30");
            
            const iconBg = document.getElementById('confirmIconBg');
            iconBg.className = "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm " + (options.iconBgClass || "bg-red-50/80 border border-red-100");
            
            const icon = document.getElementById('confirmIcon');
            icon.className = "fa-solid " + (options.iconClass || "fa-triangle-exclamation text-3xl text-red-500");

            // 绑定确认事件
            btn.onclick = async () => {
                if (options.onConfirm) {
                    await options.onConfirm();
                }
            };

            const modal = document.getElementById('confirmModal');
            const content = document.getElementById('confirmModalContent');
            
            modal.classList.remove('hidden');
            setTimeout(() => {
                content.classList.remove('scale-95', 'opacity-0');
                content.classList.add('scale-100', 'opacity-100');
            }, 10);
        }

        function closeConfirmModal() {
            const modal = document.getElementById('confirmModal');
            const content = document.getElementById('confirmModalContent');
            
            content.classList.remove('scale-100', 'opacity-100');
            content.classList.add('scale-95', 'opacity-0');
            
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300); 
        }

        // ================= 重构后的续期与删除功能 =================
        function renewEsim(id, cycle) {
            if (!cycle || cycle === 0) {
                alert("该卡片未设置保号周期，无法自动计算日期。请直接点击编辑修改。");
                return;
            }
            
            openConfirmModal({
                title: '一键续期',
                message: '确定已保号并一键续期吗？\\n\\n系统将以【今天】为基准，往后顺延 ' + cycle + ' 天作为新的到期日。',
                btnText: '<i class="fa-solid fa-rotate-right"></i> 确定续期',
                btnClass: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30',
                iconBgClass: 'bg-blue-50/80 border border-blue-100',
                iconClass: 'fa-rotate-right text-3xl text-blue-500',
                onConfirm: async () => {
                    const btn = document.getElementById('confirmActionBtn');
                    const origText = btn.innerHTML;
                    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 处理中...';
                    btn.disabled = true;

                    const newDate = new Date();
                    newDate.setDate(newDate.getDate() + parseInt(cycle));
                    const year = newDate.getFullYear();
                    const month = String(newDate.getMonth() + 1).padStart(2, '0');
                    const day = String(newDate.getDate()).padStart(2, '0');
                    const newExpireStr = year + '-' + month + '-' + day;

                    try {
                        const response = await fetch(WORKER_API_URL, {
                            method: 'PUT',
                            headers: getAuthHeaders(),
                            body: JSON.stringify({ id: id, expireDate: newExpireStr })
                        });
                        
                        if (response.status === 401) { logout(); return; }
                        if (response.ok) {
                            closeConfirmModal();
                            await fetchEsimData(); 
                        } else {
                            alert("续期失败。");
                            btn.innerHTML = origText;
                            btn.disabled = false;
                        }
                    } catch (error) {
                        alert("网络错误，续期失败。");
                        btn.innerHTML = origText;
                        btn.disabled = false;
                    }
                }
            });
        }

        function deleteEsim(id) {
            openConfirmModal({
                title: '确认删除',
                message: '确定要删除这个号码记录吗？此操作无法恢复。',
                btnText: '<i class="fa-solid fa-trash-can"></i> 确定删除',
                btnClass: 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/30',
                iconBgClass: 'bg-red-50/80 border border-red-100',
                iconClass: 'fa-trash-can text-3xl text-red-500',
                onConfirm: async () => {
                    const btn = document.getElementById('confirmActionBtn');
                    const origText = btn.innerHTML;
                    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 删除中...';
                    btn.disabled = true;
                    
                    try {
                        const response = await fetch(WORKER_API_URL, {
                            method: 'DELETE',
                            headers: getAuthHeaders(),
                            body: JSON.stringify({ id: id })
                        });
                        
                        if (response.status === 401) { logout(); return; }
                        if (response.ok) {
                            closeConfirmModal();
                            await fetchEsimData(); 
                        } else {
                            alert("删除失败。");
                            btn.innerHTML = origText;
                            btn.disabled = false;
                        }
                    } catch (error) {
                        alert("网络错误，删除失败。");
                        btn.innerHTML = origText;
                        btn.disabled = false;
                    }
                }
            });
        }

        function openModal() {
            editingId = null;
            document.getElementById('modalTitle').innerHTML = '<i class="fa-solid fa-file-circle-plus text-blue-600"></i> 新增 eSIM';
            const modal = document.getElementById('addModal');
            const content = document.getElementById('modalContent');
            document.getElementById('addForm').reset(); 
            
            modal.classList.remove('hidden');
            setTimeout(() => {
                content.classList.remove('scale-95', 'opacity-0');
                content.classList.add('scale-100', 'opacity-100');
            }, 10);
        }

        function openEditModal(id) {
            const sim = esimData.find(s => s.id === id);
            if (!sim) return;
            
            editingId = id;
            document.getElementById('modalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square text-green-600"></i> 编辑 eSIM';
            
            document.getElementById('simName').value = sim.name || '';
            document.getElementById('simNumber').value = sim.number || '';
            document.getElementById('simCycle').value = sim.cycle || '';
            document.getElementById('simPlatforms').value = sim.platforms || ''; // 填充平台数据
            document.getElementById('simRemark').value = sim.remark || '';
            document.getElementById('simExpire').value = sim.expireDate || '';

            const modal = document.getElementById('addModal');
            const content = document.getElementById('modalContent');
            
            modal.classList.remove('hidden');
            setTimeout(() => {
                content.classList.remove('scale-95', 'opacity-0');
                content.classList.add('scale-100', 'opacity-100');
            }, 10);
        }

        function closeModal() {
            const modal = document.getElementById('addModal');
            const content = document.getElementById('modalContent');
            
            content.classList.remove('scale-100', 'opacity-100');
            content.classList.add('scale-95', 'opacity-0');
            
            setTimeout(() => {
                modal.classList.add('hidden');
                editingId = null;
            }, 300); 
        }
    </script>
</body>
</html>`;

const TG_SESSION_TTL_SECONDS = 900;
const SITE_URL = "https://phone.betony.cc.cd";

function jsonResponse(data, headers = {}, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendTelegramMessage(tgToken, chatId, text, replyMarkup) {
  if (!tgToken || !chatId) return;
  const tgUrl = `https://api.telegram.org/bot${tgToken}/sendMessage`;
  const body = { chat_id: chatId, text, parse_mode: "HTML" };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(tgUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function answerTelegramCallback(tgToken, callbackId) {
  if (!tgToken || !callbackId) return;
  const tgUrl = `https://api.telegram.org/bot${tgToken}/answerCallbackQuery`;
  await fetch(tgUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackId })
  });
}

async function getEsims(env) {
  const esims = await env.ESIM_DB.get("esim_list", { type: "json" });
  return Array.isArray(esims) ? esims : [];
}

async function saveEsims(env, esims) {
  await env.ESIM_DB.put("esim_list", JSON.stringify(esims));
}

function getTelegramSessionKey(chatId) {
  return `tg_session_${chatId}`;
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function getTelegramStartText() {
  return `🤖 <b>欢迎使用 eSIM 保号机器人</b>

我可以帮你查看号码列表、逐步添加新号码，也可以显示网页看板地址。

<b>添加号码流程</b>
发送 /add 后，我会按 6 步询问：

1/6 卡片名称：必填，例如 KnowRoaming

2/6 手机号：选填，例如 +1 234 567 8900
可发送 /skip 跳过

3/6 保号周期：必填，输入大于 0 的整数，例如 180

4/6 到期日：必填，格式 YYYY-MM-DD，例如 2026-12-31

5/6 已注册平台：选填
多个平台请用空格或英文逗号分隔
例如 Telegram Google OpenAI
或 Telegram, Google, OpenAI
可发送 /skip 跳过

6/6 备注/保号要求：选填，例如 半年发一次短信
可发送 /skip 跳过

最后我会发送汇总。回复 确认 保存，回复 取消 或 /cancel 放弃。

发送 /help 查看可用命令。`;
}

function getTelegramHelpText() {
  return `🤖 <b>可用命令</b>

/start - 查看欢迎说明
/help - 查看可用命令
/list - 查看当前号码列表
/add - 按步骤添加一个新号码
/skip - 跳过当前选填字段
/site - 显示网站访问链接
/cancel - 取消当前未完成流程`;
}

function getHelpKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "添加号码", callback_data: "cmd:add" },
        { text: "查看列表", callback_data: "cmd:list" }
      ],
      [
        { text: "打开网站", callback_data: "cmd:site" },
        { text: "取消流程", callback_data: "cmd:cancel" }
      ]
    ]
  };
}

function getTelegramCommandFromCallback(data) {
  const callbackCommands = {
    "cmd:add": "/add",
    "cmd:list": "/list",
    "cmd:site": "/site",
    "cmd:cancel": "/cancel"
  };
  return callbackCommands[data] || "";
}

function getSiteText() {
  return `🌐 <b>eSIM 保号看板地址</b>

${SITE_URL}

你可以在网页端查看、编辑、续期号码。`;
}

function getAddStepPrompt(step) {
  const prompts = {
    name: "📝 <b>第 1/6 步：卡片名称</b>\n\n请输入卡片名称，不能为空。\n\n示例：\nKnowRoaming\n\n如需取消，请发送 /cancel。",
    number: "📞 <b>第 2/6 步：手机号</b>\n\n请输入手机号，建议带国际区号。\n\n示例：\n+1 234 567 8900\n\n如果不想填写，请发送 /skip 跳过。\n\n如需取消，请发送 /cancel。",
    cycle: "🔄 <b>第 3/6 步：保号周期</b>\n\n请输入保号周期天数，必须是大于 0 的整数。\n\n示例：\n180\n\n如需取消，请发送 /cancel。",
    expireDate: "📅 <b>第 4/6 步：到期日</b>\n\n请输入本次到期日，格式必须是 YYYY-MM-DD。\n\n示例：\n2026-12-31\n\n如需取消，请发送 /cancel。",
    platforms: "🌐 <b>第 5/6 步：已注册平台</b>\n\n请输入这个号码已绑定的平台。\n\n多个平台请用空格或英文逗号分隔。\n\n示例：\nTelegram Google OpenAI\n或：\nTelegram, Google, OpenAI\n\n如果不想填写，请发送 /skip 跳过。\n\n如需取消，请发送 /cancel。",
    remark: "📝 <b>第 6/6 步：备注/保号要求</b>\n\n请输入备注或保号要求。\n\n示例：\n半年发一次短信\n\n如果不想填写，请发送 /skip 跳过。\n\n如需取消，请发送 /cancel。"
  };
  return prompts[step];
}

function isSkipCommand(value) {
  return value.toLowerCase() === "/skip";
}

function formatSimSummary(data) {
  return `📱 卡名：${escapeHtml(data.name)}
📞 号码：${escapeHtml(data.number || "未填写")}
🔄 周期：${escapeHtml(data.cycle)} 天
📅 到期：${escapeHtml(data.expireDate)}
🌐 平台：${escapeHtml(data.platforms || "未填写")}
📝 备注：${escapeHtml(data.remark || "未填写")}`;
}

async function saveTelegramSession(env, chatId, session) {
  await env.ESIM_DB.put(getTelegramSessionKey(chatId), JSON.stringify(session), { expirationTtl: TG_SESSION_TTL_SECONDS });
}

async function handleTelegramAddStep(env, tgToken, chatId, text, session) {
  const value = text.trim();
  const sessionKey = getTelegramSessionKey(chatId);

  if (value === "取消") {
    await env.ESIM_DB.delete(sessionKey);
    await sendTelegramMessage(tgToken, chatId, "已取消当前添加流程。如需重新添加，请发送 /add。");
    return;
  }

  if (session.step === "name") {
    if (!value || value === "-") {
      await sendTelegramMessage(tgToken, chatId, "卡片名称不能为空，请输入名称，例如 KnowRoaming。如需取消，请发送 /cancel。");
      return;
    }
    session.data.name = value;
    session.step = "number";
    session.updatedAt = Date.now();
    await saveTelegramSession(env, chatId, session);
    await sendTelegramMessage(tgToken, chatId, getAddStepPrompt("number"));
    return;
  }

  if (session.step === "number") {
    session.data.number = isSkipCommand(value) ? "" : value;
    session.step = "cycle";
    session.updatedAt = Date.now();
    await saveTelegramSession(env, chatId, session);
    await sendTelegramMessage(tgToken, chatId, getAddStepPrompt("cycle"));
    return;
  }

  if (session.step === "cycle") {
    const cycle = Number(value);
    if (!Number.isInteger(cycle) || cycle <= 0) {
      await sendTelegramMessage(tgToken, chatId, "周期格式不正确，请输入大于 0 的整数，例如 180。如需取消，请发送 /cancel。");
      return;
    }
    session.data.cycle = cycle;
    session.step = "expireDate";
    session.updatedAt = Date.now();
    await saveTelegramSession(env, chatId, session);
    await sendTelegramMessage(tgToken, chatId, getAddStepPrompt("expireDate"));
    return;
  }

  if (session.step === "expireDate") {
    if (!isValidDateString(value)) {
      await sendTelegramMessage(tgToken, chatId, "日期格式不正确，请使用 YYYY-MM-DD，例如 2026-12-31。如需取消，请发送 /cancel。");
      return;
    }
    session.data.expireDate = value;
    session.step = "platforms";
    session.updatedAt = Date.now();
    await saveTelegramSession(env, chatId, session);
    await sendTelegramMessage(tgToken, chatId, getAddStepPrompt("platforms"));
    return;
  }

  if (session.step === "platforms") {
    session.data.platforms = isSkipCommand(value) ? "" : value;
    session.step = "remark";
    session.updatedAt = Date.now();
    await saveTelegramSession(env, chatId, session);
    await sendTelegramMessage(tgToken, chatId, getAddStepPrompt("remark"));
    return;
  }

  if (session.step === "remark") {
    session.data.remark = isSkipCommand(value) ? "" : value;
    session.step = "confirm";
    session.updatedAt = Date.now();
    await saveTelegramSession(env, chatId, session);
    await sendTelegramMessage(tgToken, chatId, `✅ <b>请确认新增号码信息</b>\n\n${formatSimSummary(session.data)}\n\n回复 确认 保存，回复 取消 放弃。`);
    return;
  }

  if (session.step === "confirm") {
    if (value !== "确认") {
      await sendTelegramMessage(tgToken, chatId, "请回复 确认 保存，或回复 取消 放弃当前添加流程。");
      return;
    }

    const esims = await getEsims(env);
    esims.push({
      id: Date.now().toString(),
      name: session.data.name,
      number: session.data.number || "",
      cycle: session.data.cycle,
      expireDate: session.data.expireDate,
      platforms: session.data.platforms || "",
      remark: session.data.remark || ""
    });
    await saveEsims(env, esims);
    await env.ESIM_DB.delete(sessionKey);
    await sendTelegramMessage(tgToken, chatId, `✅ 已保存新号码。\n\n${formatSimSummary(session.data)}`);
  }
}

async function handleTelegramWebhook(request, env, tgToken, tgChat, corsHeaders) {
  let update;
  try {
    update = await request.json();
  } catch (err) {
    return jsonResponse({ ok: true }, corsHeaders);
  }

  const callbackQuery = update.callback_query;
  const message = update.message || update.edited_message || (callbackQuery && callbackQuery.message);
  const chatId = message && message.chat && message.chat.id ? String(message.chat.id) : "";
  const callbackText = callbackQuery && typeof callbackQuery.data === "string" ? getTelegramCommandFromCallback(callbackQuery.data) : "";
  const text = callbackText || (message && typeof message.text === "string" ? message.text.trim() : "");

  if (!chatId || !text || String(tgChat) !== chatId) {
    return jsonResponse({ ok: true }, corsHeaders);
  }

  if (!tgToken || !tgChat) {
    return jsonResponse({ ok: true }, corsHeaders);
  }

  if (callbackQuery) {
    await answerTelegramCallback(tgToken, callbackQuery.id);
  }

  const command = text.split(/\s+/)[0].split("@")[0].toLowerCase();
  const sessionKey = getTelegramSessionKey(chatId);
  const session = await env.ESIM_DB.get(sessionKey, { type: "json" });

  if (command === "/start") {
    await sendTelegramMessage(tgToken, chatId, getTelegramStartText());
    return jsonResponse({ ok: true }, corsHeaders);
  }

  if (command === "/help") {
    await sendTelegramMessage(tgToken, chatId, getTelegramHelpText(), getHelpKeyboard());
    return jsonResponse({ ok: true }, corsHeaders);
  }

  if (command === "/site") {
    await sendTelegramMessage(tgToken, chatId, getSiteText());
    return jsonResponse({ ok: true }, corsHeaders);
  }

  if (command === "/cancel" || text === "取消") {
    await env.ESIM_DB.delete(sessionKey);
    await sendTelegramMessage(tgToken, chatId, "已取消当前流程。发送 /help 可以查看完整说明。");
    return jsonResponse({ ok: true }, corsHeaders);
  }

  if (command === "/list") {
    const esims = await getEsims(env);
    if (esims.length === 0) {
      await sendTelegramMessage(tgToken, chatId, "当前还没有号码记录。发送 /add 可以添加第一个号码。");
      return jsonResponse({ ok: true }, corsHeaders);
    }
    const textList = esims.map((sim, index) => `${index + 1}. ${escapeHtml(sim.name)}\n📞 ${escapeHtml(sim.number || "未填写")}\n📅 ${escapeHtml(sim.expireDate || "未填写")}｜🔄 ${escapeHtml(sim.cycle || "未设置")} 天${sim.platforms ? `\n🌐 ${escapeHtml(sim.platforms)}` : ""}${sim.remark ? `\n📝 ${escapeHtml(sim.remark)}` : ""}`).join("\n\n");
    await sendTelegramMessage(tgToken, chatId, `📋 <b>当前号码列表</b>\n\n${textList}`);
    return jsonResponse({ ok: true }, corsHeaders);
  }

  if (command === "/add") {
    if (session && session.action === "add") {
      await sendTelegramMessage(tgToken, chatId, "你已有一个未完成的添加流程。请继续填写，或发送 /cancel 取消后重新开始。");
      return jsonResponse({ ok: true }, corsHeaders);
    }
    const newSession = {
      action: "add",
      step: "name",
      data: { name: "", number: "", cycle: 0, expireDate: "", platforms: "", remark: "" },
      updatedAt: Date.now()
    };
    await saveTelegramSession(env, chatId, newSession);
    await sendTelegramMessage(tgToken, chatId, getAddStepPrompt("name"));
    return jsonResponse({ ok: true }, corsHeaders);
  }

  if (session && session.action === "add") {
    await handleTelegramAddStep(env, tgToken, chatId, text, session);
    return jsonResponse({ ok: true }, corsHeaders);
  }

  await sendTelegramMessage(tgToken, chatId, "未识别的命令。发送 /help 查看完整使用说明。");
  return jsonResponse({ ok: true }, corsHeaders);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (path === "/" || path === "/index.html") {
      return new Response(HTML_CONTENT, {
        headers: { "Content-Type": "text/html;charset=UTF-8" }
      });
    }

    let tgToken = env.TG_BOT_TOKEN;
    let tgChat = env.TG_CHAT_ID;
    
    try {
      if (!tgToken) tgToken = await env.ESIM_DB.get("TG_BOT_TOKEN");
      if (!tgChat) tgChat = await env.ESIM_DB.get("TG_CHAT_ID");
    } catch (e) {}

    if (path === "/api/telegram/webhook" && request.method === "POST") {
      return await handleTelegramWebhook(request, env, tgToken, tgChat, corsHeaders);
    }

    if (path === "/api/auth/send" && request.method === "POST") {
      try {
        if (!tgToken || !tgChat) {
          let missingVars = [];
          if (!tgToken) missingVars.push("TG_BOT_TOKEN");
          if (!tgChat) missingVars.push("TG_CHAT_ID");
          return new Response(JSON.stringify({ 
              success: false, 
              message: `环境缺失：缺少 ${missingVars.join(' 和 ')}。请前往 Cloudflare 的 KV 数据库中手动添加这两个键值对即可彻底解决！` 
          }), { status: 500, headers: corsHeaders });
        }
        
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        await env.ESIM_DB.put("admin_auth_code", code, { expirationTtl: 300 });
        await env.ESIM_DB.put("admin_auth_attempts", "0", { expirationTtl: 300 }); 

        const text = `🔐 <b>【eSIM 看板安全验证】</b>\n\n有人正在尝试登录您的网页版数据面板。\n\n您的动态登录验证码是：<code>${code}</code>\n\n<i>(该验证码 5 分钟内有效。如非本人操作，请忽略，系统已开启防爆破保护)</i>`;
        const tgUrl = `https://api.telegram.org/bot${tgToken}/sendMessage`;
        const tgRes = await fetch(tgUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: tgChat, text: text, parse_mode: "HTML" })
        });

        if (tgRes.ok) {
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        } else {
          return new Response(JSON.stringify({ success: false, message: "TG 消息发送失败，可能 Bot 被拉黑或未激活" }), { status: 500, headers: corsHeaders });
        }
      } catch (err) {
        return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    if (path === "/api/auth/verify" && request.method === "POST") {
      try {
        const { code } = await request.json();
        const storedCode = await env.ESIM_DB.get("admin_auth_code");
        
        let attempts = parseInt(await env.ESIM_DB.get("admin_auth_attempts")) || 0;
        if (attempts >= 5) {
            await env.ESIM_DB.delete("admin_auth_code"); 
            return new Response(JSON.stringify({ success: false, message: "错误次数过多，为保障安全，验证码已强制作废。请重新获取！" }), { status: 403, headers: corsHeaders });
        }

        if (!storedCode) {
            return new Response(JSON.stringify({ success: false, message: "请先获取验证码或验证码已过期" }), { status: 400, headers: corsHeaders });
        }
        
        if (code && storedCode === code.toString()) {
          const token = crypto.randomUUID();
          await env.ESIM_DB.put("session_token_" + token, "valid", { expirationTtl: 2592000 });
          await env.ESIM_DB.delete("admin_auth_code");
          await env.ESIM_DB.delete("admin_auth_attempts"); 
          
          return new Response(JSON.stringify({ success: true, token: token }), { headers: corsHeaders });
        } else {
          attempts++;
          await env.ESIM_DB.put("admin_auth_attempts", attempts.toString(), { expirationTtl: 300 });
          await new Promise(resolve => setTimeout(resolve, 1000)); 
          
          return new Response(JSON.stringify({ success: false, message: `验证码错误！剩余尝试次数: ${5 - attempts} 次` }), { status: 401, headers: corsHeaders });
        }
      } catch (err) {
        return new Response(JSON.stringify({ success: false, message: "校验失败" }), { status: 500, headers: corsHeaders });
      }
    }

    if (path === "/api/esims") {
      const reqToken = request.headers.get("Authorization");
      if (!reqToken) {
        return new Response(JSON.stringify({ error: "Unauthorized: Missing Token" }), { status: 401, headers: corsHeaders });
      }
      
      const isValidSession = await env.ESIM_DB.get("session_token_" + reqToken);
      if (!isValidSession) {
        return new Response(JSON.stringify({ error: "Unauthorized: Invalid or Expired Token" }), { status: 401, headers: corsHeaders });
      }

      let esims;
      try {
        esims = await env.ESIM_DB.get("esim_list", { type: "json" });
        if (!esims) esims = []; 
      } catch (err) {
        return new Response(JSON.stringify({ error: "KV 未绑定" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }

      if (request.method === "GET") {
        return new Response(JSON.stringify(esims), { headers: { "Content-Type": "application/json", ...corsHeaders } });
      }

      if (request.method === "POST") {
        try {
          const newSim = await request.json();
          if (!newSim.name || !newSim.expireDate) return new Response(JSON.stringify({ success: false, message: "参数错误" }), { status: 400, headers: corsHeaders });
          newSim.id = Date.now().toString(); 
          esims.push(newSim);
          await env.ESIM_DB.put("esim_list", JSON.stringify(esims)); 
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        } catch (err) { return new Response(JSON.stringify({ success: false }), { status: 400, headers: corsHeaders }); }
      }

      if (request.method === "PUT") {
        try {
          const { id, expireDate, name, number, cycle, remark, platforms } = await request.json();
          let found = false;
          esims = esims.map(sim => {
            if (sim.id === id) { 
                found = true; 
                if (expireDate !== undefined) sim.expireDate = expireDate;
                if (name !== undefined) sim.name = name;
                if (number !== undefined) sim.number = number;
                if (cycle !== undefined) sim.cycle = cycle;
                if (remark !== undefined) sim.remark = remark;
                if (platforms !== undefined) sim.platforms = platforms; // 更新平台数据
                return sim; 
            }
            return sim;
          });
          if (!found) return new Response(JSON.stringify({ success: false, message: "未找到记录" }), { status: 404, headers: corsHeaders });
          await env.ESIM_DB.put("esim_list", JSON.stringify(esims)); 
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        } catch (err) { return new Response(JSON.stringify({ success: false }), { status: 400, headers: corsHeaders }); }
      }

      if (request.method === "DELETE") {
        try {
          const { id } = await request.json();
          esims = esims.filter(sim => sim.id !== id);
          await env.ESIM_DB.put("esim_list", JSON.stringify(esims)); 
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        } catch (err) { return new Response(JSON.stringify({ success: false }), { status: 400, headers: corsHeaders }); }
      }
    }

    return new Response("404 Not Found", { status: 404 });
  },

  async scheduled(event, env, ctx) {
    let tgToken = env.TG_BOT_TOKEN;
    let tgChat = env.TG_CHAT_ID;
    try {
      if (!tgToken) tgToken = await env.ESIM_DB.get("TG_BOT_TOKEN");
      if (!tgChat) tgChat = await env.ESIM_DB.get("TG_CHAT_ID");
    } catch (e) {}

    const esims = await env.ESIM_DB.get("esim_list", { type: "json" });
    if (!esims || esims.length === 0) return; 

    const today = new Date();
    const offset = 8; 
    const localToday = new Date(today.getTime() + offset * 3600 * 1000);
    localToday.setUTCHours(0, 0, 0, 0);

    let messages = [];

    esims.forEach(sim => {
      const expDate = new Date(sim.expireDate);
      expDate.setUTCHours(0, 0, 0, 0); 
      
      const diffTime = expDate - localToday;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const cycleText = sim.cycle ? `${sim.cycle}天` : '未设置';
      const remarkText = sim.remark ? `\n📝 备注: ${sim.remark}` : ''; 
      const platformsText = sim.platforms ? `\n🌐 平台: ${sim.platforms}` : ''; // 推送消息中加入平台

      if (diffDays <= 15 && diffDays > 0) {
        messages.push(`⚠️ 【eSIM 保号提醒】\n📱 卡名: ${sim.name}\n📞 号码: ${sim.number || '未填写'}\n🔄 周期: ${cycleText}\n📅 到期: ${sim.expireDate}${remarkText}${platformsText}\n⏳ 剩余: ${diffDays} 天！\n👉 请尽快处理续期！`);
      } else if (diffDays === 0) {
        messages.push(`🚨 【eSIM 紧急提醒】\n📱 卡名: ${sim.name} 今天到期！${remarkText}${platformsText}`);
      } else if (diffDays < 0 && Math.abs(diffDays) % 7 === 0) {
        messages.push(`❌ 【eSIM 停机警告】\n📱 卡名: ${sim.name} 已过期 ${Math.abs(diffDays)} 天。${remarkText}${platformsText}`);
      }
    });

    if (messages.length > 0 && tgToken && tgChat) {
      const text = messages.join("\n\n---\n\n");
      const tgUrl = `https://api.telegram.org/bot${tgToken}/sendMessage`;
      await fetch(tgUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          chat_id: tgChat, 
          text: text, 
          parse_mode: "HTML" 
        })
      });
    }
  }
};
