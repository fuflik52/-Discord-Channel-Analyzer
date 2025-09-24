// Основной класс для управления приложением
class DiscordAnalyzerApp {
    constructor() {
        this.isLoggedIn = false;
        this.currentUser = null;
        this.guilds = [];
        this.isAnalyzing = false; // блокировка параллельного анализа
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkSavedCredentials();
        this.showSection('login-section');
    }

    // Проверка сохраненных данных при загрузке
    checkSavedCredentials() {
        const savedCredentials = localStorage.getItem('discord_credentials');
        if (savedCredentials) {
            try {
                const { email, password } = JSON.parse(savedCredentials);
                document.getElementById('email').value = email;
                document.getElementById('password').value = password;
                
                // Показываем кнопку для автоматического входа
                this.showAutoLoginButton();
            } catch (error) {
                console.error('Ошибка загрузки сохраненных данных:', error);
                localStorage.removeItem('discord_credentials');
            }
        }
    }

    // Показать кнопку автоматического входа
    showAutoLoginButton() {
        const loginForm = document.getElementById('login-form');
        const existingBtn = document.getElementById('auto-login-btn');
        
        if (!existingBtn) {
            const autoLoginBtn = document.createElement('button');
            autoLoginBtn.id = 'auto-login-btn';
            autoLoginBtn.type = 'button';
            autoLoginBtn.className = 'btn btn-secondary';
            autoLoginBtn.innerHTML = '<i class="fas fa-user-check"></i> Войти с сохраненными данными';
            autoLoginBtn.style.marginTop = '10px';
            
            autoLoginBtn.addEventListener('click', () => {
                this.handleLogin(true);
            });
            
            loginForm.appendChild(autoLoginBtn);
        }
    }

    bindEvents() {
        // Форма авторизации
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Кнопка выхода
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Кнопка "Назад к серверам"
        document.getElementById('back-to-guilds').addEventListener('click', () => {
            this.showSection('guilds-section');
        });
    }

    // Управление секциями
    showSection(sectionId) {
        const sections = document.querySelectorAll('.section');
        sections.forEach(section => section.classList.add('hidden'));
        
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.remove('hidden');
        }
    }

    // Показать/скрыть загрузку с этапами
    showLoading(show = true, stage = 'Загрузка...') {
        const loading = document.getElementById('loading');
        const loadingText = document.getElementById('loading-text');
        
        if (show) {
            loading.classList.remove('hidden');
            if (loadingText) {
                loadingText.textContent = stage;
            }
        } else {
            loading.classList.add('hidden');
        }
    }

    // Обновить этап загрузки
    updateLoadingStage(stage) {
        const loadingText = document.getElementById('loading-text');
        if (loadingText) {
            loadingText.textContent = stage;
        }
    }

    // Показать уведомление
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        // Анимация появления
        setTimeout(() => notification.classList.add('show'), 100);

        // Автоматическое скрытие
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    // Обработка авторизации
    async handleLogin(useAutoLogin = false) {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if (!email || !password) {
            this.showNotification('Пожалуйста, заполните все поля', 'error');
            return;
        }

        this.showLoading(true, 'Подключение к Discord...');

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (result.success) {
                // Сохраняем данные в localStorage при успешной авторизации
                if (!useAutoLogin) {
                    const saveCredentials = confirm('Сохранить данные для автоматического входа?');
                    if (saveCredentials) {
                        localStorage.setItem('discord_credentials', JSON.stringify({ email, password }));
                    }
                }
                
                this.showNotification('Успешная авторизация!', 'success');
                this.isLoggedIn = true;
                
                this.updateLoadingStage('Загрузка информации о пользователе...');
                await this.loadUserInfo();
                
                this.updateLoadingStage('Загрузка списка серверов...');
                await this.loadGuilds();
            } else {
                this.showNotification(result.message || 'Ошибка авторизации', 'error');
            }
        } catch (error) {
            this.showNotification('Ошибка подключения к серверу', 'error');
            console.error('Login error:', error);
        } finally {
            this.showLoading(false);
        }
    }

    // Загрузка информации о пользователе
    async loadUserInfo() {
        try {
            const response = await fetch('/api/user');
            const result = await response.json();

            if (result.success) {
                this.currentUser = result.user;
                this.displayUserInfo();
                this.showSection('user-section');
            } else {
                this.showNotification('Не удалось загрузить информацию о пользователе', 'error');
            }
        } catch (error) {
            this.showNotification('Ошибка загрузки пользователя', 'error');
            console.error('User info error:', error);
        }
    }

    // Отображение информации о пользователе
    displayUserInfo() {
        const userInfo = document.getElementById('user-info');
        const user = this.currentUser;
        
        userInfo.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="width: 50px; height: 50px; background: var(--gradient); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem;">
                    ${user.username.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h3>${user.username}#${user.discriminator}</h3>
                    <p style="color: var(--text-muted);">ID: ${user.id}</p>
                </div>
            </div>
        `;
    }

    // Загрузка списка серверов
    async loadGuilds() {
        try {
            const response = await fetch('/api/guilds');
            const result = await response.json();

            if (result.success) {
                this.guilds = result.guilds;
                this.displayGuilds();
                this.showSection('guilds-section');
            } else {
                this.showNotification('Не удалось загрузить серверы', 'error');
            }
        } catch (error) {
            this.showNotification('Ошибка загрузки серверов', 'error');
            console.error('Guilds error:', error);
        }
    }

    // Отображение списка серверов
    displayGuilds() {
        const guildsList = document.getElementById('guilds-list');
        
        guildsList.innerHTML = this.guilds.map(guild => `
            <div class="guild-item" onclick="app.analyzeGuild('${guild.id}', '${guild.name.replace(/'/g, "\\'")}')">
                <div class="guild-icon">
                    ${guild.icon ? 
                        `<img src="https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png" alt="${guild.name}" onerror="this.parentElement.innerHTML='<div class=\\"guild-icon-placeholder\\">${guild.name.charAt(0).toUpperCase()}</div>'">` :
                        `<div class="guild-icon-placeholder">${guild.name.charAt(0).toUpperCase()}</div>`
                    }
                </div>
                <div class="guild-info">
                    <h3>${guild.name}</h3>
                    <div class="guild-stats">
                        <p><i class="fas fa-hashtag"></i> ID: ${guild.id}</p>
                        <p><i class="fas fa-users"></i> Участников: ${guild.member_count || 'Неизвестно'}</p>
                    </div>
                </div>
                <div class="guild-arrow">
                    <i class="fas fa-chevron-right"></i>
                </div>
            </div>
        `).join('');
    }

    // Анализ сервера
    async analyzeGuild(guildId, guildName) {
        // если уже идет анализ — не запускаем новый
        if (this.isAnalyzing) {
            this.showNotification('Уже идет анализ. Дождитесь завершения текущего.', 'warning');
            return;
        }
        this.isAnalyzing = true;
        const guildsList = document.getElementById('guilds-list');
        if (guildsList) guildsList.classList.add('disabled');

        this.showLoading(true, 'Подготовка к анализу...');
        this.showNotification(`Начинаем анализ сервера "${guildName}"`, 'info');

        try {
            this.updateLoadingStage('Получение списка каналов...');
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guildId, guildName })
            });

            // Симулируем этапы анализа
            this.updateLoadingStage('Проверка доступности каналов...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.updateLoadingStage('Анализ прав доступа...');
            await new Promise(resolve => setTimeout(resolve, 800));
            this.updateLoadingStage('Формирование отчета...');
            await new Promise(resolve => setTimeout(resolve, 500));

            const result = await response.json();

            if (result.success) {
                this.displayAnalysisResults(result);
                this.showSection('results-section');
                this.showNotification('Анализ завершен успешно!', 'success');
            } else {
                this.showNotification(result.message || 'Ошибка анализа', 'error');
            }
        } catch (error) {
            this.showNotification('Ошибка анализа сервера', 'error');
            console.error('Analysis error:', error);
        } finally {
            this.isAnalyzing = false;
            if (guildsList) guildsList.classList.remove('disabled');
            this.showLoading(false);
        }
    }

    // Отображение результатов анализа
    displayAnalysisResults(data) {
        const resultsContainer = document.getElementById('analysis-results');
        
        const accessibleCount = data.accessible.length;
        const inaccessibleCount = data.inaccessible.length;
        const totalCount = data.total;
        const voiceChannelsCount = data.voiceChannels ? data.voiceChannels.length : 0;

        resultsContainer.innerHTML = `
            <div class="analysis-header" style="margin-bottom: 2rem;">
                <h3 style="color: var(--accent-primary); margin-bottom: 0.5rem;">
                    <i class="fas fa-server"></i> ${data.guildName}
                </h3>
                <p style="color: var(--text-secondary);">Результаты анализа каналов</p>
            </div>

            <div class="analysis-summary">
                <div class="stat-card">
                    <span class="stat-number">${totalCount}</span>
                    <div class="stat-label">Всего каналов</div>
                </div>
                <div class="stat-card">
                    <span class="stat-number" style="color: var(--success);">${accessibleCount}</span>
                    <div class="stat-label">Доступные</div>
                </div>
                <div class="stat-card">
                    <span class="stat-number" style="color: var(--error);">${inaccessibleCount}</span>
                    <div class="stat-label">Недоступные</div>
                </div>
                <div class="stat-card">
                    <span class="stat-number" style="color: var(--accent-primary);">${voiceChannelsCount}</span>
                    <div class="stat-label">Голосовые каналы</div>
                </div>
            </div>

            ${data.voiceChannels && data.voiceChannels.length > 0 ? `
                <div class="channels-section">
                    <h3><i class="fas fa-microphone" style="color: var(--accent-primary);"></i> Голосовые каналы (${voiceChannelsCount})</h3>
                    <div class="channels-list">
                        ${this.renderVoiceChannels(data.voiceChannels)}
                    </div>
                </div>
            ` : ''}

            ${inaccessibleCount > 0 ? `
                <div class="channels-section">
                    <h3><i class="fas fa-lock" style="color: var(--error);"></i> Недоступные каналы (${inaccessibleCount})</h3>
                    <div class="channels-list">
                        ${this.renderChannels(data.inaccessible, 'inaccessible')}
                    </div>
                </div>
            ` : '<div style="text-align: center; padding: 2rem; color: var(--success);"><i class="fas fa-check-circle" style="font-size: 3rem; margin-bottom: 1rem;"></i><h3>Все каналы доступны!</h3></div>'}

            ${accessibleCount > 0 ? `
                <div class="channels-section">
                    <h3><i class="fas fa-unlock" style="color: var(--success);"></i> Доступные каналы (${accessibleCount})</h3>
                    <div class="channels-list">
                        ${this.renderChannels(data.accessible, 'accessible')}
                    </div>
                </div>
            ` : ''}
        `;
    }

    // Рендеринг голосовых каналов с пользователями
    renderVoiceChannels(voiceChannels) {
        if (voiceChannels.length === 0) {
            return '<p style="text-align: center; color: var(--text-muted); padding: 1rem;">Голосовые каналы не найдены</p>';
        }

        const sortedChannels = voiceChannels.sort((a, b) => {
            if (a.position !== b.position) {
                return a.position - b.position;
            }
            return a.name.localeCompare(b.name);
        });

        return sortedChannels.map(channel => `
            <div class="voice-channel-item">
                <div class="voice-channel-header">
                    <div class="channel-info">
                        <div class="channel-name">
                            ${channel.typeName} ${channel.name}
                        </div>
                        <div class="channel-type">
                            ID: ${channel.id} | Пользователей: ${channel.userCount || 0}
                        </div>
                    </div>
                    <div class="channel-actions">
                        <a href="${channel.link}" target="_blank" class="channel-link" title="Открыть канал">
                            <i class="fas fa-external-link-alt"></i>
                        </a>
                        <button onclick="app.copyToClipboard('${channel.link}')" class="btn btn-secondary" style="padding: 0.5rem;" title="Копировать ссылку">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
                ${channel.voiceUsers && channel.voiceUsers.length > 0 ? `
                    <div class="voice-users">
                        <h4 style="margin: 1rem 0 0.5rem 0; color: var(--text-secondary); font-size: 0.9rem;">
                            <i class="fas fa-users"></i> Пользователи в канале:
                        </h4>
                        <div class="users-list">
                            ${this.renderVoiceUsers(channel.voiceUsers)}
                        </div>
                    </div>
                ` : `
                    <div class="voice-users">
                        <p style="color: var(--text-muted); font-style: italic; margin: 0.5rem 0;">Канал пуст</p>
                    </div>
                `}
            </div>
        `).join('');
    }

    // Рендеринг пользователей в голосовом канале
    renderVoiceUsers(users) {
        if (!users || users.length === 0) {
            return '<p class="no-users">Нет пользователей в голосовом канале</p>';
        }

        return users.map(user => `
            <div class="voice-user">
                <div class="user-avatar">
                    ${user.avatar ? 
                        `<img src="${user.avatar}" alt="${user.username}" onerror="this.parentElement.innerHTML='<div class=\\"avatar-placeholder\\">${user.username.charAt(0).toUpperCase()}</div>'">` :
                        `<div class="avatar-placeholder">${user.username.charAt(0).toUpperCase()}</div>`
                    }
                </div>
                <div class="user-info">
                    <div class="user-name">${user.username}</div>
                    <div class="user-status">
                        ${user.mute ? '<i class="fas fa-microphone-slash" style="color: #f04747;" title="Микрофон выключен"></i>' : '<i class="fas fa-microphone" style="color: #43b581;" title="Микрофон включен"></i>'}
                        ${user.deaf ? '<i class="fas fa-volume-mute" style="color: #f04747;" title="Звук выключен"></i>' : '<i class="fas fa-volume-up" style="color: #43b581;" title="Звук включен"></i>'}
                        ${user.streaming ? '<i class="fas fa-tv" style="color: #593695;" title="Демонстрация экрана"></i>' : ''}
                        ${user.video ? '<i class="fas fa-video" style="color: #43b581;" title="Камера включена"></i>' : ''}
                    </div>
                </div>
                ${user.streaming ? `
                    <div class="stream-preview">
                        <button class="preview-btn" onclick="app.showStreamPreview('${user.id}', '${user.username}')">
                            <i class="fas fa-eye"></i> Предпросмотр
                        </button>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    showStreamPreview(userId, username) {
        // Создаем модальное окно для предпросмотра стрима
        const modal = document.createElement('div');
        modal.className = 'stream-modal';
        modal.innerHTML = `
            <div class="stream-modal-content">
                <div class="stream-modal-header">
                    <h3>Предпросмотр стрима - ${username}</h3>
                    <button class="close-modal" onclick="this.parentElement.parentElement.parentElement.remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="stream-preview-container">
                    <div class="stream-placeholder">
                        <i class="fas fa-tv"></i>
                        <p>Предпросмотр демонстрации экрана</p>
                        <p class="stream-note">Примечание: Для полного просмотра используйте Discord клиент</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Рендеринг списка каналов
    renderChannels(channels, type) {
        if (channels.length === 0) {
            return '<p style="text-align: center; color: var(--text-muted); padding: 1rem;">Каналы не найдены</p>';
        }

        // Сортируем каналы по позиции и имени
        const sortedChannels = channels.sort((a, b) => {
            if (a.position !== b.position) {
                return a.position - b.position;
            }
            return a.name.localeCompare(b.name);
        });

        return sortedChannels.map(channel => `
            <div class="channel-item ${type}">
                <div class="channel-info">
                    <div class="channel-name">
                        ${channel.typeName} ${channel.name}
                    </div>
                    <div class="channel-type">
                        ID: ${channel.id}
                    </div>
                </div>
                <div class="channel-actions">
                    <a href="${channel.link}" target="_blank" class="channel-link" title="Открыть канал">
                        <i class="fas fa-external-link-alt"></i>
                    </a>
                    <button onclick="app.copyToClipboard('${channel.link}')" class="btn btn-secondary" style="padding: 0.5rem;" title="Копировать ссылку">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Копирование в буфер обмена
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showNotification('Ссылка скопирована!', 'success');
        } catch (error) {
            // Fallback для старых браузеров
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showNotification('Ссылка скопирована!', 'success');
        }
    }

    // Выход из системы
    handleLogout() {
        this.isLoggedIn = false;
        this.currentUser = null;
        this.guilds = [];
        
        // Очищаем сохраненные данные
        localStorage.removeItem('discord_credentials');
        
        // Очищаем форму
        document.getElementById('login-form').reset();
        
        // Удаляем кнопку автоматического входа
        const autoLoginBtn = document.getElementById('auto-login-btn');
        if (autoLoginBtn) {
            autoLoginBtn.remove();
        }
        
        this.showSection('login-section');
        this.showNotification('Вы вышли из системы', 'info');
    }
}

// Инициализация приложения
const app = new DiscordAnalyzerApp();

// Обработка ошибок
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    app.showNotification('Произошла ошибка в приложении', 'error');
});

// Обработка необработанных промисов
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    app.showNotification('Ошибка выполнения запроса', 'error');
});

// Дополнительные утилиты
const utils = {
    // Форматирование времени
    formatTime(date) {
        return new Intl.DateTimeFormat('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(date);
    },

    // Дебаунс функция
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Проверка валидности email
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
};