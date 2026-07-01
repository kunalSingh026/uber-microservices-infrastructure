const amqp = require('amqplib');

const EXCHANGE_NAME = 'uber_events';
const QUEUE_NAME = 'driver_match_queue';
let publishChannel = null;

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

async function listenForEvents(onMessageReceived) {
    try {
        const connection = await connectWithRetry(process.env.RABBITMQ_URL, 'Driver Service Listener');
        const channel = await connection.createChannel();
        publishChannel = channel;

        await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

        await channel.assertQueue(QUEUE_NAME, { durable: true });

        await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.requested');

        await channel.prefetch(1);

        console.log(`[Driver Service] Waiting for messages in queue: ${QUEUE_NAME}...`);

        channel.consume(QUEUE_NAME, (msg) => {
            if (msg !== null) {
                const eventData = JSON.parse(msg.content.toString());
                onMessageReceived(eventData);
                channel.ack(msg);
            }
        });

        connection.on('close', () => {
            console.error('[Driver Service Listener] Connection closed. Reconnecting in 5s...');
            publishChannel = null;
            setTimeout(() => listenForEvents(onMessageReceived), 5000);
        });
    } catch (error) {
        console.error('[Driver Service] Failed to connect or consume from RabbitMQ:', error.message);
    }
}

async function publishEvent(routingKey, message) {
    if (!publishChannel) {
        console.log('[Driver Service] Cannot publish, channel not ready.');
        return;
    }
    const payload = Buffer.from(JSON.stringify(message));
    publishChannel.publish(EXCHANGE_NAME, routingKey, payload);
    console.log(`[Driver Service] Event Published: "${routingKey}"`);
}

module.exports = { listenForEvents, publishEvent };