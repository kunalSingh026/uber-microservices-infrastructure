const amqp = require('amqplib');

const EXCHANGE_NAME = 'uber_events';
const QUEUE_NAME = 'billing_service_queue';

async function listenForCompletedRides(onRideCompleted) {
    try {
        // Change line 7 to use process.env:
        const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
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
    } catch (error) {
        console.error('[Billing Service] RabbitMQ initialization failed:', error.message );
    }
}

module.exports = { listenForCompletedRides };