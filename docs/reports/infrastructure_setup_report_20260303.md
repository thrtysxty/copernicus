# Infrastructure Report: Dell R210ii Core (`192.168.1.185`)
**Date:** Tuesday, March 3, 2026
**Status:** `OLLAMA_SERVER_READY` | `STORAGE_OPTIMIZED` | `VISION_MODELS_LIVE`

---

## 1. Executive Summary
The deployment target was successfully migrated from the Raspberry Pi baseline to the Dell R210ii server. The primary objective was to establish a high-performance local inference engine (Ollama) while managing the server's specific hardware constraints (8GB RAM and a small 80GB OS drive).

## 2. Infrastructure Optimizations

### 💾 Storage Management (OS Drive Protection)
The OS drive (`/dev/sda`) was at **70% capacity**. To prevent a system crash, the following storage strategy was implemented:
*   **External Volume Binding:** The Ollama model storage was redirected from the default Docker internal volume to the **1TB data partition** at `/mnt/data/ollama`.
*   **Capacity:** This move preserved ~60GB of space on the OS drive and provides ~900GB of headroom for future models.

### 🧠 Memory Governance
To ensure the Dell server remains stable while running both the **High Plains Hipster** backend and the **Ollama** inference engine:
*   **Memory Cap:** The `copernicus-ollama` container is strictly limited to **6GB of RAM** (via `docker-compose.ollama.yml`).
*   **Swap Buffer:** Confirmed 4GB of swap availability on the host to handle peak model loading without kernel panics.

---

## 3. Ollama Configuration & Model Inventory

The server is now reachable at `http://192.168.1.185:11434`.

### 👁️ Vision & Multimodal
Added to support the inventory system (OCR, item identification, and listing automation):
*   **`moondream` (1.6GB):** Optimized for high-speed CPU vision tasks (captions/OCR).
*   **`llava` (4.7GB):** Full-featured multimodal model for complex visual analysis.

### 🛠️ Agentic Personas
Six specialized "Persona Models" were created within the container using custom `Modelfiles`:
1.  **`architect`**: Based on `deepseek-r1:8b`
2.  **`senior-dev`**: Based on `qwen2.5-coder:7b`
3.  **`product-owner`**: Based on `llama3.1:8b`
4.  **`ci-cd`**: Based on `llama3.1:8b`
5.  **`junior-dev`**: Based on `qwen2.5-coder:1.5b`
6.  **`scribe`**: Based on `qwen2.5-coder:1.5b`

---

## 4. Local Environment Connectivity

Your local development environment has been synchronized to point to the Dell server:
*   **`.env`**: Created local `.env` with `OLLAMA_BASE_URL=http://192.168.1.185:11434`.
*   **`Makefile`**: Updated `CORE_SERVER_IP` to `.185` and fixed the `ollama-status` target.

---

## 5. Pending Recommendations (Docker Root Migration)

To fully safeguard the OS drive, it is recommended to move the entire Docker data root to the large drive.

**Execution Steps (to be run on the server):**
1.  **Stop Docker:** `sudo systemctl stop docker`
2.  **Update Config:** Edit `/etc/docker/daemon.json`:
    ```json
    {
      "data-root": "/mnt/data/docker"
    }
    ```
3.  **Transfer Data:** `sudo rsync -aP /var/lib/docker/ /mnt/data/docker`
4.  **Restart:** `sudo systemctl start docker`
