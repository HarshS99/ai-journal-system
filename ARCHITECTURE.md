# Architecture Answers

## 1. How would you scale this to 100k users?
To scale to 100k users, the architecture must transition from a monolithic SQLite setup to a distributed set of stateless microservices backed by a scalable relational database:
- **Database Scalability:** Migrate from SQLite to PostgreSQL (e.g., AWS RDS or Aurora). We should implement read-replicas for `GET /api/journal/:userId` and Insights queries to separate analytical workloads from the transactional inserts (`POST /api/journal`).
- **Stateless Backend:** Containerize the Node.js API and deploy it with an orchestrator like Kubernetes (EKS) or AWS ECS behind a Load Balancer. Since our JWT authentication or API rate limiting might rely on memory, we shift session state or rate limits to Redis.
- **Asynchronous LLM Processing:** The most significant bottleneck is the slow LLM generation endpoint. Instead of making synchronous calls, Journal Entries requiring analysis should be pushed to a Message Broker (RabbitMQ, Kafka, or AWS SQS). A dedicated fleet of background workers then consumes messages and runs the LLM inference independently, pushing the result back to the DB and updating the frontend through WebSockets or Server-Sent Events (SSE).

## 2. How would you reduce LLM cost?
LLM generation is an expensive recurring cost. We can reduce it through several strategies:
- **Batch Processing & Few-Shot Prompts:** Instead of sending entries 1-by-1, we can batch 5-10 journal entries into a single prompt for analysis, leveraging fixed system prompt tokens efficiently.
- **Model Tiers:** We are currently using `gemini-1.5-flash` which is fast and inexpensive. We can route obvious/simple entries to even cheaper local/small models (like locally hosted Llama-3 8B via vLLM) and only trigger larger remote API models (GPT-4o / Gemini 1.5 Pro) for highly complex or ambiguous texts.
- **Aggressive Caching:** Implemented in this project is a mechanism to hash input text and memorize the LLM output.

## 3. How would you cache repeated analysis?
This project demonstrates exactly how to cache analysis.
- **Text Hashing:** For every incoming journal entry, we compute a `SHA-256` hash of the raw user text.
- **Database Deduplication:** We maintain a table `llm_cache` where `textHash` is the primary key and the result (`emotion, summary, keywords`) are stored.
- **Lookup flow:** When `POST /analyze` occurs, we compute the hash. If that hash exists in the cache table, we return it instantly for 0ms latency and $0 cost. If it's a cache-miss, we fetch from the LLM and INSERT it into the cache table.

## 4. How would you protect sensitive journal data?
Journal data is highly sensitive and requires strict data protections:
- **Data At-Rest Encryption:** The database disk (EBS volume) must be strictly encrypted. Additionally, the `text` field inside the database itself should be field-level encrypted (e.g., AES-GCM) with key rotation using AWS KMS before insertion, and only decrypted in-memory inside the Node API.
- **Anonymization for LLM:** We should strip Personally Identifiable Information (PII) like names, phone numbers, or locations from the text before transmitting it to any external API provider. We can use a fast local NER (Named Entity Recognition) model like Microsoft Presidio to replace PII with `<PERSON>` or `<LOCATION>` tags prior to hitting Gemini or OpenAI APIs.
- **Data In-Transit Encryption:** Force TLS 1.3 across all services (Frontend to Backend, Backend to DB).
- **Access Control:** Enforce JWT token authentication and exact-match User ID authorization. No user can request GET `/journal/:userId` without matching their signed JWT subject payload.
