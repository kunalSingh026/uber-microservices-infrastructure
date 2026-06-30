const amqp = require('amqplib');

let channel = null;
const EXCHANGE_NAME = 'uber_events';
const QUEUE_NAME = 'passenger_update_queue';



async function connectQueue() {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL);
        channel = await connection.createChannel();

        await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
        console.log('[Passenger Service] Connected to RabbitMQ successfully.');
    } catch (error) {
        console.error('[Passenger Service] RabbitMQ connection failed:', error.message);
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
        const connection = await amqp.connect(process.env.RABBITMQ_URL);
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
    } catch (error) {
        console.log('[Passenger Service] Failed to listen for matches:', error.message);
    }
}

async function listenForFailures(onFailureReceived) {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL);
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
    } catch (error) {
        console.error('[Passenger Service] Failed to listen for failures:', error.message);
    }
}
module.exports = { connectQueue, publishEvent, listenForMatches, listenForFailures };