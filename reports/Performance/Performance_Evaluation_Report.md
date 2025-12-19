### **Performance and Load Testing Evaluation Report: CanvasIligan System**

**Date:** November 16, 2025
**Prepared For:** Project Stakeholders
**Prepared By:** Gemini Systems Analyst

---

#### **1.0 Executive Summary**

This report details the results of a performance and load testing evaluation conducted on the CanvasIligan semantic search API. Using Apache JMeter, the system was subjected to three distinct load scenarios to measure its responsiveness, throughput, and stability. The evaluation tested two primary query types: complex "Project Based Queries" and simpler "Specific Queries."

The key finding is that the system exhibits excellent performance and stability under low-concurrency and high-volume, steady-state loads, with average response times remaining under 120ms. However, under a high-concurrency stress test (100 users over 10 seconds), the system experienced severe performance degradation, with average response times increasing to over 7,000ms (7 seconds). This indicates a significant bottleneck related to handling concurrent requests rather than total request volume. The system remained stable across all tests, with a 0% error rate. Recommendations include deploying the Python service with a production-grade WSGI server and investigating resource utilization to address the concurrency bottleneck.

---

#### **2.0 Introduction and Objectives**

The primary objective of this evaluation was to quantitatively assess the performance characteristics of the CanvasIligan API backend. The tests were designed to simulate real-world user interaction and determine the system's operational limits, focusing on:

*   **Responsiveness:** Measuring the average response time for different query types under varying loads.
*   **Scalability:** Assessing how system performance degrades as the number of concurrent users increases.
*   **Stability:** Verifying the system's ability to handle load without generating errors.
*   **Throughput:** Determining the maximum number of requests the system can process per unit of time.

---

#### **3.0 Methodology**

**3.1 Testing Tool**
All tests were executed using **Apache JMeter**, an open-source load testing tool, to simulate concurrent user requests against the API endpoints.

**3.2 Test Environment**
The tests were conducted on a locally deployed instance of the application, comprising the Node.js/Express.js API gateway and the Python/Flask machine learning microservice.

**3.3 Test Scenarios**
Three distinct load profiles were simulated:

1.  **Low-Concurrency Baseline:** 10 total users with a 10-second ramp-up period (1 user/second). This test establishes a baseline performance metric under light load.
2.  **High-Concurrency Stress Test:** 100 total users with a 10-second ramp-up period (10 users/second). This test simulates a sudden, high-intensity burst of traffic to identify concurrency bottlenecks.
3.  **High-Volume Throughput Test:** 1,000 total users with a 1,000-second ramp-up period (1 user/second). This test assesses the system's endurance and ability to handle a sustained, steady flow of requests over a longer duration.

**3.4 Query Types**
Two categories of search queries were tested to evaluate the performance of the semantic search pipeline under different levels of complexity:
*   **Project Based Query:** A semantically complex, natural language query (e.g., "materials to build a DIY drone").
*   **Specific Query:** A semantically simple, keyword-based query (e.g., "soldering tool").

---

#### **4.0 Results and Analysis**

The aggregated results from the three test scenarios are summarized below. All times are in milliseconds (ms).

| Scenario | # Samples | Avg. Response Time (ms) | Max Response Time (ms) | Throughput (req/sec) | Error % |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Low Concurrency** | 20 | 87 | 161 | 2.18 | 0.00% |
| **High Concurrency** | 200 | 7,183 | 14,666 | 7.49 | 0.00% |
| **High Volume** | 2,000 | 85 | 201 | 2.00 | 0.00% |

**4.1 Analysis of Low-Concurrency Baseline**
Under a light load of 10 users, the system performed exceptionally well. The overall average response time was 87ms, with "Specific Queries" (60ms avg) being significantly faster than "Project Based Queries" (115ms avg). This performance differential is expected, as project-based queries likely require more computational resources for semantic interpretation in the Python microservice. The throughput of 2.18 requests/second easily handled the incoming load, and the 0% error rate confirms system stability.

**4.2 Analysis of High-Concurrency Stress Test**
This test revealed a critical performance bottleneck. When subjected to a burst of 10 users per second, the average response time skyrocketed to **7,183ms**, an 82-fold increase from the baseline. The maximum response time reached nearly 15 seconds, which is unacceptable for a user-facing application.

The throughput of 7.49 requests/second was significantly lower than the incoming request rate, indicating that the server was unable to process requests as fast as they were arriving. This led to request queuing, which is the primary cause of the dramatic increase in latency. The high standard deviation in response times (3950ms) further illustrates erratic and unpredictable performance under this load. The likely cause is the single-threaded nature of the default Flask development server, which cannot handle simultaneous requests and processes them sequentially, creating a severe bottleneck.

**4.3 Analysis of High-Volume Throughput Test**
In contrast to the stress test, the system demonstrated remarkable efficiency and endurance under a sustained, high-volume load. Over a test duration of more than 15 minutes with 1,000 total users, the average response time was **85ms**, nearly identical to the low-concurrency baseline.

This result is highly significant: it proves that the system's bottleneck is not related to data volume, database performance, or memory leaks over time, but is specifically tied to **request concurrency**. As long as requests arrive at a steady, non-bursty rate (1 user/second), the system can efficiently process a large volume of traffic.

---

#### **5.0 Conclusion and Recommendations**

**5.1 Conclusion**
The CanvasIligan API is stable and highly performant under expected and sustained traffic loads. However, it suffers from a severe concurrency bottleneck that makes it vulnerable to performance degradation during traffic bursts. The root cause is almost certainly the architecture's inability to handle multiple simultaneous requests at the machine learning microservice layer.

**5.2 Recommendations**

1.  **Deploy Python Service with a WSGI Server:** The default Flask development server is not designed for production and is single-threaded. The Python microservice **must be deployed using a production-grade WSGI (Web Server Gateway Interface) server like Gunicorn or uWSGI.**
    *   **Action:** Configure Gunicorn with multiple worker processes (e.g., `gunicorn --workers 4 semantic_search_server:app`). The number of workers is typically `(2 * number_of_cpu_cores) + 1`. This single change will allow the Python service to handle multiple requests in parallel and is expected to resolve the primary bottleneck.

2.  **Implement API Rate Limiting:** To protect the system from future degradation and ensure a baseline level of service, a rate limiter should be implemented in the Node.js API gateway. This will gracefully reject excessive requests (with an HTTP `429 Too Many Requests` status) rather than allowing the entire system to slow down.

3.  **Conduct Further Profiling:** After implementing the WSGI server, the high-concurrency stress test should be re-run. If performance issues persist, further profiling of the Node.js and Python services is needed to identify remaining bottlenecks (e.g., CPU-bound computations, I/O wait times).