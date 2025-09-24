const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Discord API класс
class DiscordChannelAnalyzer {
    constructor() {
        this.token = null;
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
        };
    }

    async login(email, password) {
        try {
            // Получаем fingerprint
            try {
                const fingerprintResponse = await axios.get('https://discord.com/api/v9/experiments', {
                    headers: this.headers
                });
                if (fingerprintResponse.data.fingerprint) {
                    this.headers['X-Fingerprint'] = fingerprintResponse.data.fingerprint;
                }
            } catch (e) {
                // Игнорируем ошибку fingerprint
            }

            // Авторизуемся
            const loginData = {
                login: email,
                password: password,
                undelete: false,
                captcha_key: null,
                login_source: null,
                gift_code_sku_id: null
            };

            const response = await axios.post('https://discord.com/api/v9/auth/login', loginData, {
                headers: this.headers
            });

            if (response.status === 200 && response.data.token) {
                this.token = response.data.token;
                this.headers.Authorization = this.token;
                this.headers['X-Super-Properties'] = 'eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiQ2hyb21lIiwiZGV2aWNlIjoiIiwic3lzdGVtX2xvY2FsZSI6InJ1LVJVIiwiYnJvd3Nlcl91c2VyX2FnZW50IjoiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgMTAuMDsgV2luNjQ7IHg2NCkgQXBwbGVXZWJLaXQvNTM3LjM2IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzEyMC4wLjAuMCBTYWZhcmkvNTM3LjM2IiwiYnJvd3Nlcl92ZXJzaW9uIjoiMTIwLjAuMC4wIiwib3NfdmVyc2lvbiI6IjEwIiwicmVmZXJyZXIiOiIiLCJyZWZlcnJpbmdfZG9tYWluIjoiIiwicmVmZXJyZXJfY3VycmVudCI6IiIsInJlZmVycmluZ19kb21haW5fY3VycmVudCI6IiIsInJlbGVhc2VfY2hhbm5lbCI6InN0YWJsZSIsImNsaWVudF9idWlsZF9udW1iZXIiOjI2MTk3NCwiY2xpZW50X2V2ZW50X3NvdXJjZSI6bnVsbH0=';
                this.headers['X-Discord-Locale'] = 'ru';
                this.headers['X-Debug-Options'] = 'bugReporterEnabled';
                this.headers['Origin'] = 'https://discord.com';
                this.headers['Referer'] = 'https://discord.com/channels/@me';
                
                return { success: true, message: 'Успешная авторизация!' };
            } else {
                return { success: false, message: 'Неверные данные для входа' };
            }
        } catch (error) {
            return { success: false, message: `Ошибка авторизации: ${error.message}` };
        }
    }

    async getUserInfo() {
        try {
            const response = await axios.get('https://discord.com/api/v9/users/@me', {
                headers: this.headers
            });
            
            if (response.status === 200) {
                return {
                    success: true,
                    user: {
                        username: response.data.username,
                        discriminator: response.data.discriminator || '0000',
                        id: response.data.id
                    }
                };
            }
            return { success: false, message: 'Не удалось получить информацию о пользователе' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async getGuilds() {
        try {
            const response = await axios.get('https://discord.com/api/v9/users/@me/guilds', {
                headers: this.headers
            });
            
            if (response.status === 200) {
                return { success: true, guilds: response.data };
            }
            return { success: false, message: 'Не удалось получить список серверов' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async analyzeGuildChannels(guildId, guildName) {
        try {
            // Получаем список каналов
            const channelsResponse = await axios.get(`https://discord.com/api/v9/guilds/${guildId}/channels`, {
                headers: this.headers
            });

            if (channelsResponse.status !== 200) {
                return { success: false, message: 'Не удалось получить список каналов' };
            }

            const channels = channelsResponse.data;
            const accessibleChannels = [];
            const inaccessibleChannels = [];
            const voiceChannels = [];

            // Типы каналов Discord
            const channelTypes = {
                0: "📝 Текстовый",
                1: "🔊 Голосовой", 
                2: "🔊 Голосовой",
                4: "📁 Категория",
                5: "📢 Новости",
                10: "🧵 Ветка новостей",
                11: "🧵 Публичная ветка",
                12: "🧵 Приватная ветка",
                13: "🎤 Сцена",
                15: "🎪 Форум"
            };

            // Проверяем доступность каждого канала
            for (const channel of channels) {
                const channelInfo = {
                    id: channel.id,
                    name: channel.name,
                    type: channel.type,
                    typeName: channelTypes[channel.type] || `❓ Неизвестный (${channel.type})`,
                    link: `https://discord.com/channels/${guildId}/${channel.id}`,
                    parentId: channel.parent_id,
                    position: channel.position || 0
                };

                const isAccessible = await this.checkChannelAccess(channel.id, channel.type);
                
                // Если это голосовой канал, получаем дополнительную информацию
                if ([1, 2, 13].includes(channel.type)) {
                    const voiceInfo = await this.getVoiceChannelInfo(channel.id, guildId);
                    channelInfo.voiceUsers = voiceInfo.users || [];
                    channelInfo.userCount = voiceInfo.users ? voiceInfo.users.length : 0;
                    voiceChannels.push(channelInfo);
                }
                
                if (isAccessible) {
                    accessibleChannels.push(channelInfo);
                } else {
                    inaccessibleChannels.push(channelInfo);
                }

                // Небольшая задержка между запросами
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            return {
                success: true,
                guildName,
                accessible: accessibleChannels,
                inaccessible: inaccessibleChannels,
                voiceChannels: voiceChannels,
                total: channels.length
            };

        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async getVoiceChannelInfo(channelId, guildId) {
        try {
            // Получаем информацию о пользователях в голосовом канале
            const response = await axios.get(`https://discord.com/api/v9/channels/${channelId}`, {
                headers: this.headers
            });

            // Пытаемся получить список участников голосового канала
            try {
                const voiceStatesResponse = await axios.get(`https://discord.com/api/v9/guilds/${guildId}/voice-states`, {
                    headers: this.headers
                });

                const voiceStates = voiceStatesResponse.data || [];
                const channelUsers = voiceStates.filter(state => state.channel_id === channelId);

                const users = [];
                for (const state of channelUsers) {
                    try {
                        const userResponse = await axios.get(`https://discord.com/api/v9/users/${state.user_id}`, {
                            headers: this.headers
                        });
                        
                        const user = userResponse.data;
                        users.push({
                            id: user.id,
                            username: user.username,
                            discriminator: user.discriminator,
                            avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
                            muted: state.mute || state.self_mute || false,
                            deafened: state.deaf || state.self_deaf || false,
                            streaming: state.streaming || false,
                            video: state.video || false
                        });
                    } catch (userError) {
                        // Если не удалось получить информацию о пользователе
                        users.push({
                            id: state.user_id,
                            username: 'Неизвестный пользователь',
                            discriminator: '0000',
                            avatar: null,
                            muted: state.mute || state.self_mute || false,
                            deafened: state.deaf || state.self_deaf || false,
                            streaming: state.streaming || false,
                            video: state.video || false
                        });
                    }
                    
                    // Задержка между запросами пользователей
                    await new Promise(resolve => setTimeout(resolve, 200));
                }

                return { users };
            } catch (voiceError) {
                return { users: [] };
            }

        } catch (error) {
            return { users: [] };
        }
    }

    async checkChannelAccess(channelId, channelType) {
        try {
            let response;
            
            if (channelType === 4) { // Категория
                response = await axios.get(`https://discord.com/api/v9/channels/${channelId}`, {
                    headers: this.headers
                });
            } else if ([0, 5, 10, 11, 12, 15].includes(channelType)) { // Текстовые каналы
                response = await axios.get(`https://discord.com/api/v9/channels/${channelId}/messages?limit=1`, {
                    headers: this.headers
                });
            } else if ([1, 2, 13].includes(channelType)) { // Голосовые каналы
                response = await axios.get(`https://discord.com/api/v9/channels/${channelId}`, {
                    headers: this.headers
                });
            } else {
                response = await axios.get(`https://discord.com/api/v9/channels/${channelId}`, {
                    headers: this.headers
                });
            }
            
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }
}

// Создаем экземпляр анализатора
const analyzer = new DiscordChannelAnalyzer();

// Маршруты API
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email и пароль обязательны' });
    }
    
    const result = await analyzer.login(email, password);
    res.json(result);
});

app.get('/api/user', async (req, res) => {
    const result = await analyzer.getUserInfo();
    res.json(result);
});

app.get('/api/guilds', async (req, res) => {
    const result = await analyzer.getGuilds();
    res.json(result);
});

app.post('/api/analyze', async (req, res) => {
    const { guildId, guildName } = req.body;
    
    if (!guildId || !guildName) {
        return res.status(400).json({ success: false, message: 'ID сервера и название обязательны' });
    }
    
    const result = await analyzer.analyzeGuildChannels(guildId, guildName);
    res.json(result);
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📱 Discord Channel Analyzer Web готов к работе!`);
});