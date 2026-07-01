const amqp = require('amqplib');

const EXCHANGE_NAME = 'uber_events';
const QUEUE_NAME = 'billing_service_queue';

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

async function listenForCompletedRides(onRideCompleted) {
    try {
        const connection = await connectWithRetry(process.env.RABBITMQ_URL || 'amqp://localhost:5672', 'Billing Service Listener');
        const channel = await connection.createChannel();

        await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.completed');

        console.log(`[Billing Service] Listening for completed rides on queue: ${QUEUE_NAME}...`);

        channel.consume(QUEUE_NAME, (msg) => {
            if (msg !== null) {
                const eventData = JSON.parse(msg.content.toString());
                onRideCompleted(eventData);
                channel.ack(msg);
            }
        });

        connection.on('close', () => {
            console.error('[Billing Service Listener] Connection closed. Reconnecting in 5s...');
            setTimeout(() => listenForCompletedRides(onRideCompleted), 5000);
        });
    } catch (error) {
        console.error('[Billing Service] RabbitMQ initialization failed:', error.message);
    }
}

module.exports = { listenForCompletedRides };