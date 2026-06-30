const amqp = require('amqplib');

const EXCHANGE_NAME = 'uber_events';
const QUEUE_NAME = 'driver_match_queue';
let publishChannel = null;

async function listenForEvents(onMessageReceived) {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL);
        const channel = await connection.createChannel();
        publishChannel = channel;

        await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

        await channel.assertQueue(QUEUE_NAME, { durable: true });

        await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'ride.requested');

        console.log(`[Driver Service] Waiting for messages in queue: ${QUEUE_NAME}...`);

        channel.consume(QUEUE_NAME, (msg) => {
            if (msg !== null) {
                const eventData = JSON.parse(msg.content.toString());
                onMessageReceived(eventData);
                channel.ack(msg);
            }
        });
    } catch (error) {
        console.error('[Driver Service] Failed to connect or consume from RabbitMQ:', error.message );
    }
}

async function publishEvent(routingKey, message) {
    if (!publishChannel) {
        console.log('[Driver Service] Cannot publissh, channel not ready.');
        return;
    }
    const payload = Buffer.from(JSON.stringify(message));
    publishChannel.publish(EXCHANGE_NAME, routingKey, payload);
    console.log(`[Driver Service] Event Published: "${routingKey}"`);
}

module.exports = { listenForEvents, publishEvent };