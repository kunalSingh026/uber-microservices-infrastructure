const amqp = require('amqplib');

let channel = null;
const EXCHANGE_NAME = 'uber_events';
const QUEUE_NAME = 'passenger_update_queue';



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

async function connectQueue() {
    try {
        const connection = await connectWithRetry(process.env.RABBITMQ_URL, 'Passenger Service Publisher');
        channel = await connection.createChannel();

        await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
        
        connection.on('close', () => {
            console.error('[Passenger Service Publisher] Connection closed. Reconnecting in 5s...');
            channel = null;
            setTimeout(connectQueue, 5000);
        });
        connection.on('error', (err) => {
            console.error('[Passenger Service Publisher] Connection error:', err.message);
        });
    } catch (error) {
        console.error('[Passenger Service Publisher] Failed to initialize:', error.message);
    }
}

async function publishEvent(routingKey, message) {
    if (!channel) {
        console.error('[Passenger Service] Cannot publish, channel not initiallized.');
        return;
    }
    const payload = Buffer.from(JSON.stringify(message));
    channel.publish(EXCHANGE_NAME, routingKey, payload);
    console.log(`[Passenger Service] Event Published: "${routingKey}"`);
}

async function listenForMatches(onMatchReceived) {
    try {
        const connection = await connectWithRetry(process.env.RABBITMQ_URL, 'Passenger Service Matches Listener');
        const channel = await connection.createChannel();

        await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.matched');

        channel.consume(QUEUE_NAME, (msg) => {
            if (msg !== null) {
                const eventData = JSON.parse(msg.content.toString());
                onMatchReceived(eventData);
                channel.ack(msg);
            }
        });

        connection.on('close', () => {
            console.error('[Passenger Service Matches Listener] Connection closed. Reconnecting in 5s...');
            setTimeout(() => listenForMatches(onMatchReceived), 5000);
        });
    } catch (error) {
        console.error('[Passenger Service Matches Listener] Failed to initialize:', error.message);
    }
}

async function listenForFailures(onFailureReceived) {
    try {
        const connection = await connectWithRetry(process.env.RABBITMQ_URL, 'Passenger Service Failures Listener');
        const channel = await connection.createChannel();
        const FAILURE_QUEUE = 'passenger_failure_queue';

        await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
        await channel.assertQueue(FAILURE_QUEUE, { durable: true });

        await channel.bindQueue(FAILURE_QUEUE, EXCHANGE_NAME, 'ride.failed');

        channel.consume(FAILURE_QUEUE, (msg) => {
            if (msg !== null) {
                const eventData = JSON.parse(msg.content.toString());
                onFailureReceived(eventData);
                channel.ack(msg);
            }
        });

        connection.on('close', () => {
            console.error('[Passenger Service Failures Listener] Connection closed. Reconnecting in 5s...');
            setTimeout(() => listenForFailures(onFailureReceived), 5000);
        });
    } catch (error) {
        console.error('[Passenger Service Failures Listener] Failed to initialize:', error.message);
    }
}
module.exports = { connectQueue, publishEvent, listenForMatches, listenForFailures };