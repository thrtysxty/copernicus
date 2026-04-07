# Background Services Guide

Copernicus utilizes several background services to enhance its functionality and provide a seamless development experience. These services run persistently, meaning you don't need to manually start them with each application launch.

## What are background services?

Background services are processes that run continuously in the background of your operating system, independent of the main Copernicus application window. They perform tasks such as:

-   **Jules Daemon**: Manages complex, long-running agent tasks and ensures their persistence even if the main application is closed.
-   **Flask Backend**: A local web server handling specific API calls and data processing.
-   **MCP Hub**: Manages the Codebase Memory Platform, enabling efficient code intelligence and graph-based analysis.

Persistent daemons improve your experience by ensuring features like continuous code indexing, long-running AI operations, and data synchronization are always active without requiring manual intervention upon each session startup.

## Manual Registration (AC2)

While Copernicus often attempts to register these services automatically, you can manually install them using the provided scripts:

-   **macOS / Linux**:
    ```bash
    bash scripts/install-daemon.sh
    ```
-   **Windows**:
    ```powershell
    powershell scripts/install-daemon.ps1
    ```

## Verifying Services are Running (AC3)

To check the status of the background services:

-   **macOS**:
    ```bash
    launchctl list | grep copernicus
    ```
-   **Linux**:
    ```bash
    systemctl --user status jules-daemon
    ```
-   **Windows**:
    ```powershell
    Get-ScheduledTask CopernicusJulesDaemon
    ```

## Settings Panel (AC1)

> 📌 Pending Story 524 merge — Settings → Background Services panel coming soon

A dedicated section in the Settings panel will soon provide a user-friendly interface to manage, start, stop, and configure these background services directly from within Copernicus.

## MCP Hub Client Config (AC4)

> 📌 Pending Story 527 merge

Configuration options for the MCP Hub client, including connection settings and indexing preferences, will be integrated into the application soon.

## Uninstalling (AC5)

To uninstall the background services:

-   **macOS / Linux**:
    ```bash
    bash scripts/install-daemon.sh --uninstall
    ```
-   **Windows**:
    ```powershell
    powershell scripts/install-daemon.ps1 -Uninstall
    ```
