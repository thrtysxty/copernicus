# Provider Setup Guide

Copernicus integrates with various AI model providers. This guide explains how to set up each provider.

Your API keys for cloud providers should generally be stored securely in `~/.secrets` to prevent accidental exposure.

## Anthropic

Anthropic offers powerful models like Claude.

-   **Key Tiers**: Access to different models (Opus, Sonnet, Haiku) depends on your subscription tier or API usage.
-   **Model Comparison**:
    -   **Opus**: Anthropic's most intelligent model, best for complex tasks.
    -   **Sonnet**: A balance of intelligence and speed, suitable for a wide range of applications.
    -   **Haiku**: Fastest and most compact model, ideal for immediate responses and high-throughput tasks.
-   **Vision**: Many Anthropic models support multimodal inputs, including vision capabilities.

**API Key**: Your Anthropic API key should be stored as `ANTHROPIC_API_KEY` in your `~/.secrets` file.

### Troubleshooting Anthropic

-   **`401 Unauthorized`**: Ensure your `ANTHROPIC_API_KEY` in `~/.secrets` is correct and hasn't expired.
-   **`Rate Limit Exceeded`**: You might be sending too many requests too quickly. Review Anthropic's rate limit documentation for your tier, or consider using a different model for high-volume tasks.
-   **`Model Not Found`**: The model you are trying to use (e.g., `claude-3-opus-20240229`) might not be available in your current API key's tier or region.

## Google / Gemini

Google provides access to Gemini models and other AI services.

-   **API Key vs. OAuth**:
    -   **API Key**: Sufficient for most Gemini model interactions.
    -   **OAuth**: Required for services that need access to user-specific data, such as Google Drive integration.
-   **Drive Integration**: When a feature requires access to your Google Drive, you will be prompted for OAuth authentication through your browser.

**API Key**: Your Google API key should be stored as `GOOGLE_API_KEY` in your `~/.secrets` file.

### Troubleshooting Google / Gemini

-   **`403 Permission Denied`**:
    -   Check if the API key has the necessary permissions enabled in your Google Cloud project.
    -   For OAuth-dependent features, ensure you have granted the correct permissions when prompted.
-   **`Invalid API Key`**: Verify `GOOGLE_API_KEY` in `~/.secrets` is accurate and active.
-   **`Quota Exceeded`**: Your project might have hit its API usage limits. Check your Google Cloud console for quota details.

## OpenAI

OpenAI offers a range of GPT models, including the latest GPT-4o.

-   **Tiers**: Access to models like GPT-3.5 and GPT-4 (including vision-enabled versions) depends on your OpenAI subscription and usage.
-   **GPT-4o Vision**: Supports multimodal input, allowing you to include images in your prompts.

**API Key**: Your OpenAI API key should be stored as `OPENAI_API_KEY` in your `~/.secrets` file.

### Troubleshooting OpenAI

-   **`Authentication Error`**: Confirm your `OPENAI_API_KEY` in `~/.secrets` is correct and valid.
-   **`Context Window Exceeded`**: Your prompt or conversation history might be too long for the selected model's context window. Try to shorten your input or use a model with a larger context.
-   **`Model Not Available`**: The specific GPT model you requested may not be available for your account or region.

## OpenRouter

OpenRouter acts as a unified API for multiple language models, often providing access to a wider catalog and managing credits.

-   **Credits**: OpenRouter uses a credit system. Ensure you have sufficient credits for your desired model usage.
-   **Model Catalogue**: OpenRouter provides access to a diverse range of models from various providers.

**API Key**: Your OpenRouter API key should be stored as `OPENROUTER_API_KEY` in your `~/.secrets` file.

### Troubleshooting OpenRouter

-   **`Insufficient Credits`**: Top up your OpenRouter account with more credits.
-   **`Invalid Model Name`**: The model name you're trying to use might be incorrect or not supported by OpenRouter. Check their model catalogue for exact names.
-   **`API Key Invalid`**: Double-check your `OPENROUTER_API_KEY` in `~/.secrets`.

## DeepInfra

DeepInfra provides access to various open-source models with a focus on fast inference.

-   **Setup**: DeepInfra's setup is straightforward, primarily requiring an API key.
-   **When to Prefer**: Often preferred for cost-effective access to a wide range of open-source models and for scenarios requiring high-speed inference.

**API Key**: Your DeepInfra API key should be stored as `DEEPINFRA_API_KEY` in your `~/.secrets` file.

### Troubleshooting DeepInfra

-   **`Authentication Failed`**: Verify your `DEEPINFRA_API_KEY` in `~/.secrets` is correct.
-   **`Model Unavailable`**: The specific model might be temporarily down or not available through DeepInfra. Check their status page.
-   **`Rate Limit`**: DeepInfra has rate limits. If you encounter issues, consider optimizing your request frequency.

## Ollama (Local)

Ollama allows you to run large language models locally on your machine.

-   **Installation**:
    1.  Download and install Ollama from [ollama.com](https://ollama.com/).
    2.  Pull the desired models using the Ollama CLI (e.g., `ollama pull llama2`).
-   **Remote Ollama**: If you have an Ollama server running on a different machine or port, you can set the `OLLAMA_BASE_URL` environment variable to point to it (e.g., `export OLLAMA_BASE_URL="http://localhost:11434"`).

**API Key**: No API key is required for local Ollama instances.

### Troubleshooting Ollama

-   **`Connection Refused`**:
    -   Ensure the Ollama application is running on your machine.
    -   Verify the `OLLAMA_BASE_URL` (if set) points to the correct address and port.
    -   Check firewall settings.
-   **`Model Not Found`**: Make sure you have pulled the model using `ollama pull <model_name>` and that the model name is correct.
-   **`Resource Exhaustion`**: Running large models locally can consume significant CPU/GPU and RAM. If models are slow or fail, check your system resources.

## NotebookLM

> 📌 Pending Stories 432–433: Integration with NotebookLM is coming soon.
