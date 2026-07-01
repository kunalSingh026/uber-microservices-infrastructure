const amqp = require('amqplib');

const NOTIFICATION_EXCHANGE = 'uber_notifications';

// Unique queues for each channel
const SMS_QUEUE = 'notification_sms_queue';
const PUSH_QUEUE = 'notification_push_queue';
const EMAIL_QUEUE = 'notification_email_queue';

async function connectWithRetry(url, label = 'RabbitMQ', maxRetries = 10, delayMs = 5000) {
    let retries = 0;
    while (true) {
        try {
            const connection = await amqp.connect(url);
            console.log(`[${label}] Connected successfully.`);
            return connection;
        } catch (error) {
            retries++;
            console.error(`[${label}] Connection failed (Attempt ${retries}/${maxRetries}):`, error.message);
            if (retries >= maxRetries) {
                throw new Error(`[${label}] Max retries reached. Could not connect to RabbitMQ.`);
            }
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}

async function connectNotificationBus(handlers) {
    try {
        const connection = await connectWithRetry(process.env.RABBITMQ_URL || 'amqp://localhost:5672', 'Notification Service Listener');
        const channel = await connection.createChannel();

        // 1. Assert the Fanout Exchange
        await channel.assertExchange(NOTIFICATION_EXCHANGE, 'fanout', { durable: true });

        // 2. Setup SMS Queue & Consumer
        await channel.assertQueue(SMS_QUEUE, { durable: true });
        await channel.bindQueue(SMS_QUEUE, NOTIFICATION_EXCHANGE, '');
        channel.consume(SMS_QUEUE, (msg) => {
            if (msg !== null) {
                handlers.handleSMS(JSON.parse(msg.content.toString()));
                channel.ack(msg);
            }
        });

        // 3. Setup Push Queue & Consumer
        await channel.assertQueue(PUSH_QUEUE, { durable: true });
        await channel.bindQueue(PUSH_QUEUE, NOTIFICATION_EXCHANGE, '');
        channel.consume(PUSH_QUEUE, (msg) => {
            if (msg !== null) {
                handlers.handlePush(JSON.parse(msg.content.toString()));
                channel.ack(msg);
            }
        });

        // 4. Setup Email Queue & Consumer
        await channel.assertQueue(EMAIL_QUEUE, { durable: true });
        await channel.bindQueue(EMAIL_QUEUE, NOTIFICATION_EXCHANGE, '');
        channel.consume(EMAIL_QUEUE, (msg) => {
            if (msg !== null) {
                handlers.handleEmail(JSON.parse(msg.content.toString()));
                channel.ack(msg);
            }
        });

        console.log('└─🚀 [Notification Bus] All fanout consumers are listening cleanly.');

        connection.on('close', () => {
            console.error('[Notification Bus] Connection closed. Reconnecting in 5s...');
            setTimeout(() => connectNotificationBus(handlers), 5000);
        });

    } catch (error) {
        console.error('[Notification Bus] Setup error:', error.message);
    }
}

module.exports = { connectNotificationBus };