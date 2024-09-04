const TelegramApi = require('node-telegram-bot-api');
const axios = require('axios');
const cron = require('node-cron');
const moment = require('moment-timezone');

// Конфигурация
const TELEGRAM_BOT_TOKEN = '7077776403:AAFebX4iZhKY26r8FVpsRjj9OhjBxZL75cU';
const WEATHER_API_KEY = 'dd11a63b3c2b7165eb36ac8ad79e9ecf';

const bot = new TelegramApi(TELEGRAM_BOT_TOKEN, { polling: true });

// Словарь для хранения данных пользователей
const userData = {};

// Функция для получения прогноза погоды
async function getWeather(lat, lon) {
    const url = `http://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric&lang=ru`;
    const response = await axios.get(url);
    const data = response.data;
    const weather = data.weather[0].description;
    const temperature = data.main.temp;
    return `Погода: ${weather}, Температура: ${temperature}°C`;
}

// Команда /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const options = {
        reply_markup: {
            keyboard: [
                [{ text: 'Поделиться локацией', request_location: true }]
            ],
            one_time_keyboard: true
        }
    };
    bot.sendMessage(chatId, 'Привет! Поделитесь своей локацией, чтобы я мог отправлять вам прогноз погоды.', options);
});

// Команда /now
bot.onText(/\/now/, async (msg) => {
    const chatId = msg.chat.id;
    const { lat, lon } = userData[chatId] || {};
    if (lat && lon) {
        const weather = await getWeather(lat, lon);
        bot.sendMessage(chatId, `Ваш текущий прогноз погоды:\n${weather}`);
    } else {
        bot.sendMessage(chatId, 'Сначала поделитесь своей локацией, используя команду /start.');
    }
});

// Обработка сообщения с локацией
bot.on('location', async (msg) => {
    const chatId = msg.chat.id;
    const { latitude, longitude } = msg.location;

    userData[chatId] = { lat: latitude, lon: longitude };
    bot.sendMessage(chatId, 'Локация сохранена! Я настрою ежедневное отправление прогноза погоды на 08:00.');

    // Настройка задания на отправку прогноза погоды ежедневно в 20:16
    cron.schedule('16 20 * * *', async () => {
        const weather = await getWeather(latitude, longitude);
        bot.sendMessage(chatId, `Ваш прогноз погоды на сегодня:\n${weather}`);
    }, {
        scheduled: true,
        timezone: "Asia/Almaty" // Almaty timezone
    });

    // Calculate delay and next run time
    const now = moment().tz('Asia/Almaty');
    const scheduledTime = moment().set({ hour: 8, minute: 0, second: 0, millisecond: 0 }).tz('Asia/Almaty');

    let nextRun;

    if (now.isAfter(scheduledTime)) {
        // If current time is after scheduled time, set nextRun to the next day
        nextRun = scheduledTime.add(1, 'day');
    } else {
        // Otherwise, set nextRun to today
        nextRun = scheduledTime;
    }

    // Calculate the delay in milliseconds until the next run
    const delay = nextRun.diff(now, 'milliseconds');

    // Schedule the message to be sent at the next run time
    setTimeout(async () => {
        const weather = await getWeather(latitude, longitude);
        bot.sendMessage(chatId, `Ваш прогноз погоды на сегодня:\n${weather}`);
    }, delay);

    console.log(`Delay in milliseconds: ${delay}`);
    console.log(`Current time: ${now.format()}`);
    console.log(`Next run time: ${nextRun.format()}`);
});
