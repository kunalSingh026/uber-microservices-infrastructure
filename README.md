# 🚗 Mini Uber Microservices Infrastructure

A lightweight, containerized microservices ecosystem demonstrating an event-driven architecture. The project utilizes an **API Gateway** for request routing, **RabbitMQ** for event choreography and pub/sub messaging, **MongoDB** for database-per-service storage isolation, and a distributed **Saga Pattern** for transactional rollback/compensation logic.

---

## 🏗️ System Architecture

This project is built around five decoupled microservices and three infrastructure components (databases & message broker).

```mermaid
graph TD
    User([Passenger / Client]) -->|API Requests| Gateway[API Gateway :3000]
    
    Gateway -->|/api/v1/passenger/*| PS[Passenger Service :3001]
    Gateway -->|/api/v1/driver/*| DS[Driver Service :3002]
    
    PS <-->|Read/Write| PDB[(Passenger DB - MongoDB :27017)]
    DS <-->|Read/Write| DDB[(Driver DB - MongoDB :27018)]
    
    subgraph Event Broker (RabbitMQ)
        Exchange[uber_events Topic Exchange]
        NotifExchange[uber_notifications Fanout Exchange]
    end
    
    PS -->|Publish ride.requested| Exchange
    Exchange -->|Route to driver_match_queue| DS
    
    DS -->|Publish ride.matched| Exchange
    Exchange -->|Route to passenger_update_queue| PS
    
    DS -->|Publish ride.failed| Exchange
    Exchange -->|Route to passenger_failure_queue (Saga Rollback)| PS
    
    DS -->|Publish ride.completed| Exchange
    Exchange -->|Route to billing_service_queue| BS[Billing Service :3003]
    
    DS -->|Broadcast match event| NotifExchange
    NotifExchange -->|Route to notification_sms_queue| NS[Notification Service :3004]
    NotifExchange -->|Route to notification_push_queue| NS
    NotifExchange -->|Route to notification_email_queue| NS
```

### Microservices & Components
1. **API Gateway** (`port 3000`): The single entry point for clients. Routes requests dynamically to downstream services and rewrites request paths:
   - `/api/v1/passenger/*` → Passenger Service (`port 3001`)
   - `/api/v1/driver/*` → Driver Service (`port 3002`)
2. **Passenger Service** (`port 3001`): Handles ride requests, writes state to its isolated `passenger_db`, publishes matching triggers to RabbitMQ, and listens for status updates (match accepted/failed).
3. **Driver Service** (`port 3002`): Manages driver states. Listens for ride requests, matches available drivers (automatically updates database to set driver as `BUSY`), issues notifications, handles trip completion, and seeds dummy drivers (`d1`, `d2`, `d3`) on startup.
4. **Billing Service** (`port 3003`): Listens for completed trips via RabbitMQ, computes the final fare (`₹50 base fare + ₹12/km`), and issues mock invoices stored in an in-memory ledger.
5. **Notification Service** (`port 3004`): Employs a **Fanout Exchange** to route trip-match notifications to three concurrent channels: SMS, Push notifications, and Email dispatchers.
6. **Infrastructure Databases**:
   - `passenger_db` (`port 27017`): MongoDB instance storing Passenger ride requests.
   - `driver_db` (`port 27018`): MongoDB instance storing Driver profiles and real-time occupancy.

---

## ⚡ Distributed Saga Pattern (Event Choreography)

In distributed architectures, ensuring data consistency without synchronous blocking calls is crucial. This system implements an event-driven **Saga Pattern** with compensating transactions:

### 🟢 1. The Success Scenario
1. **Request Ride**: A passenger requests a ride via the API Gateway. The Passenger Service saves the request to `passenger_db` as `PENDING` and publishes a `ride.requested` event to RabbitMQ.
2. **Driver Allocation**: The Driver Service consumes `ride.requested`. It checks its DB for an `AVAILABLE` driver (e.g., `d1`), marks them `BUSY` atomically, and publishes a `ride.matched` event.
3. **Notification**: Concurrently, the Driver Service publishes a broadcast event to the `uber_notifications` fanout exchange. The SMS, Push, and Email workers in the Notification Service consume it simultaneously.
4. **State Transition**: The Passenger Service consumes `ride.matched` and updates the ride's status to `ACCEPTED` with the assigned `driverId` in `passenger_db`.
5. **Trip Completion**: Once the trip concludes, the user hits `/rides/complete`. The Driver Service marks the driver `AVAILABLE`, then publishes a `ride.completed` event containing randomized trip distance.
6. **Billing**: The Billing Service consumes `ride.completed`, runs the pricing algorithm, and records a paid invoice.

### 🔴 2. The Compensation/Failure Scenario
1. **Request Ride**: A passenger requests a ride. The Passenger Service writes `PENDING` to `passenger_db` and publishes `ride.requested`.
2. **No Drivers Available**: The Driver Service consumes the event but finds all drivers are currently `BUSY`.
3. **Emit Failure Event**: The Driver Service publishes a `ride.failed` event indicating driver allocation failed.
4. **Compensating Rollback**: The Passenger Service consumes `ride.failed` and executes a compensating transaction, updating the ride status in `passenger_db` from `PENDING` to `FAILED`. This rolls back the distributed transaction safely.

---

## 🛠️ Tech Stack
- **Runtime**: Node.js (Express framework)
- **Database**: MongoDB (Mongoose ODM)
- **Message Broker**: RabbitMQ (`amqplib`)
- **Containerization**: Docker & Docker Compose

---

## 🚀 Getting Started

### Prerequisites
Make sure you have the following installed on your host:
- [Docker](https://www.docker.com/products/docker-desktop)
- [Node.js](https://nodejs.org/) (Optional, for local service execution)

### Running with Docker Compose
To boot up the entire infrastructure with a single command:

1. Clone the repository and navigate to the project directory.
2. Enter the `infrastructure` folder:
   ```bash
   cd infrastructure
   ```
3. Boot the environment:
   ```bash
   docker-compose up --build
   ```
4. Verification:
   - **RabbitMQ Admin Console**: Access [http://localhost:15672](http://localhost:15672) (User: `guest`, Pass: `guest`) to view exchanges, routing keys, and live queues.
   - **API Gateway**: Running on [http://localhost:3000](http://localhost:3000).

---

## 📖 API & Testing Guide

You can simulate the entire workflow using `curl` or any API client (e.g., Postman).

### 1. Check Gateway and Service Health
Verify the gateway and downstream services are active.
```bash
# Gateway Health
curl http://localhost:3000/gateway-health

# Passenger Service Health (via Gateway)
curl http://localhost:3000/api/v1/passenger/health

# Driver Service Health (via Gateway)
curl http://localhost:3000/api/v1/driver/health
```

### 2. Simulate the Happy Path (Success)
On startup, the system seeds two drivers as `AVAILABLE` (`d1` and `d3`) and one as `BUSY` (`d2`).

**Step 2a: Request a Ride**
```bash
curl -X POST http://localhost:3000/api/v1/passenger/rides/request \
-H "Content-Type: application/json" \
-d '{
  "passengerId": "p1",
  "pickup": "120 Main St",
  "dropoff": "999 Broadway"
}'
```
*Expected Response:*
```json
{
  "message": "Your ride request has been submitted! Finding available drivers near you...",
  "requestId": "req-171987xxxxxxx",
  "status": "PENDING"
}
```
*Logs Output:*
- Passenger Service saves the request as `PENDING` and publishes `ride.requested`.
- Driver Service matches driver `d1` (John Doe), sets status to `BUSY`, and publishes `ride.matched`.
- Notification Service SMS, Push, and Email workers output logs confirming notifications were sent.
- Passenger Service receives `ride.matched` and updates status in `passenger_db` to `ACCEPTED`.

---

**Step 2b: Complete the Ride**
To finish the ride (which makes the driver available again and triggers billing), send a POST request with the `requestId` from the previous step and the matched driver ID (`d1`):
```bash
curl -X POST http://localhost:3000/api/v1/driver/rides/complete \
-H "Content-Type: application/json" \
-d '{
  "requestId": "req-171987xxxxxxx",
  "driverId": "d1"
}';
```
*Expected Response:*
```json
{
  "message": "Trip completed successfully! Processing fare calculation...",
  "tripDetails": {
    "requestId": "req-171987xxxxxxx",
    "driverId": "d1",
    "passengerId": "p1",
    "distanceInKm": 7.42,
    "completedAt": "2026-07-01T..."
  }
}
```
*Logs Output:*
- Driver Service updates driver `d1` back to `AVAILABLE`.
- Billing Service consumes `ride.completed`, calculates the fare (`₹50 + 7.42 * ₹12 = ₹139.04`), and prints the invoice confirmation log.

---

### 3. Simulate the Saga Rollback (Failure)
Because we have only 2 available drivers initially (`d1`, `d3`), if we request 3 rides concurrently without completing any, the 3rd request will fail driver allocation, triggering the Saga compensating transaction.

1. **Request Ride 1**: Driver `d1` is matched (becomes `BUSY`).
2. **Request Ride 2**: Driver `d3` is matched (becomes `BUSY`).
3. **Request Ride 3**: No available drivers!
   - Driver Service publishes `ride.failed`.
   - Passenger Service processes `ride.failed` and updates the 3rd ride status to `FAILED` in the database.

**Trigger Request 3:**
```bash
curl -X POST http://localhost:3000/api/v1/passenger/rides/request \
-H "Content-Type: application/json" \
-d '{
  "passengerId": "p3",
  "pickup": "456 Oak Ave",
  "dropoff": "789 Pine Rd"
}'
```
*Docker Logs output:*
```text
[Driver Service Logic] Allocation failed: No drivers available for request req-171987xxxxxx
[Driver Service] Event Published: "ride.failed"
[Saga Compensating Transaction] Reverting state for request req-171987xxxxxx due to: NO_DRIVERS_AVAILABLE
[Passenger DB Rolled Back] Request req-171987xxxxxx status is now hard-marked as FAILED.
```

---

## 📂 Project Directory Structure

```text
mini-uber-microservice/
├── services/
│   ├── api-gateway/            # Express proxy server acting as entry point
│   ├── passenger-service/      # API for ride requests & DB status tracking
│   ├── driver-service/         # Algorithm for matching drivers & completing trips
│   ├── billing-service/        # Event handler calculating trip fares
│   └── notification-service/   # Multi-channel notification workers (fanout)
├── infrastructure/
│   └── docker-compose.yml      # Orchestration definition for containers, DBs, RabbitMQ
└── SystemDesign.excalidraw     # Open with excalidraw.com to view diagram
```
