import fs from 'fs';
import path from 'path';
import os from 'os';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

const DEFAULT_MAX_ITERATIONS = 10;

function resolveProvider(providerName, model) {
  const home = os.homedir();
  const providersPath = path.join(home, '.copernicus', 'providers.json');

  let providers = [];
  if (fs.existsSync(providersPath)) {
    try {
      providers = JSON.parse(fs.readFileSync(providersPath, 'utf8'));
    } catch (e) {
      console.warn(`Failed to parse providers.json: ${e.message}`);
    }
  }

  // 1. Explicit provider
  if (providerName) {
    const p = providers.find(p => p.id === providerName);
    if (p) return p;
  }

  // 2. Model prefix
  if (model && model.includes('/')) {
    const prefix = model.split('/')[0];
    const p = providers.find(p => p.id === prefix);
    if (p) return p;
  }

  // 3. First provider with apiKey
  const firstWithKey = providers.find(p => p.apiKey);
  if (firstWithKey) return firstWithKey;

  // 4. Env vars
  if (process.env.OPENROUTER_API_KEY) {
    return { id: 'openrouter', api: 'openai', baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY };
  }
  if (process.env.OPENAI_API_KEY) {
    return { id: 'openai', api: 'openai', baseURL: 'https://api.openai.com/v1', apiKey: process.env.OPENAI_API_KEY };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { id: 'anthropic', api: 'anthropic-messages', baseURL: 'https://api.anthropic.com/v1', apiKey: process.env.ANTHROPIC_API_KEY };
  }
  if (process.env.GEMINI_API_KEY) {
    return { id: 'google', api: 'google-generative-ai', baseURL: 'https://generativelanguage.googleapis.com/v1beta', apiKey: process.env.GEMINI_API_KEY };
  }

  throw new Error("No provider configured and no API key environment variables found.");
}

function getOpenRouterCacheHeaders(model) {
    const home = os.homedir();
    const cachePath = path.join(home, '.copernicus', 'models-cache.json');
    if (!fs.existsSync(cachePath)) return undefined;

    try {
        const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        const modelInfo = cache.find(m => m.id === model);
        if (modelInfo && modelInfo.supported_parameters && modelInfo.supported_parameters.includes('caching')) {
            // Usually caching implies sending certain headers or the platform handles it natively.
            // In openrouter, caching is often automatic or requires 'HTTP-Referer', which is standard.
            // Let's add a dummy header here to represent the requirement.
            return {
                'X-OpenRouter-Cache-Enable': 'true' // this is an example, adjust if there's a specific header required by openrouter for explicit cache control
            };
        }
    } catch(e) {
        // ignore
    }
    return undefined;
}

function createClient(provider, model) {
  if (provider.api === 'anthropic-messages') {
      return new Anthropic({
          apiKey: provider.apiKey,
          baseURL: provider.baseURL
      });
  }

  if (provider.api === 'google-generative-ai') {
      return new GoogleGenerativeAI(provider.apiKey);
  }

  let defaultHeaders = undefined;
  if (provider.id === 'openrouter') {
      defaultHeaders = {
        'HTTP-Referer': 'https://github.com/JMThiessen/Copernicus',
        'X-Title': 'Copernicus Agent Daemon',
      };

      const cacheHeaders = getOpenRouterCacheHeaders(model);
      if (cacheHeaders) {
          defaultHeaders = { ...defaultHeaders, ...cacheHeaders };
      }
  }

  return new OpenAI({
    baseURL: provider.baseURL,
    apiKey: provider.apiKey,
    defaultHeaders
  });
}

export async function call({ model, messages, provider, temperature, maxTokens }) {
  const resolvedProvider = resolveProvider(provider, model);
  const client = createClient(resolvedProvider, model);

  if (resolvedProvider.api === 'anthropic-messages') {
      const systemMessage = messages.find(m => m.role === 'system');
      const otherMessages = messages.filter(m => m.role !== 'system');

      const response = await client.messages.create({
          model: model,
          system: systemMessage ? systemMessage.content : undefined,
          messages: otherMessages,
          max_tokens: maxTokens || 4096,
          temperature: temperature
      });
      return response.content[0].text;
  }

  if (resolvedProvider.api === 'google-generative-ai') {
      const gmodel = client.getGenerativeModel({ model: model.replace('google/', '') }); // strip prefix if present
      const systemMessage = messages.find(m => m.role === 'system');
      const otherMessages = messages.filter(m => m.role !== 'system');

      const chat = gmodel.startChat({
          systemInstruction: systemMessage ? systemMessage.content : undefined,
          history: otherMessages.slice(0, -1).map(m => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }]
          }))
      });

      const response = await chat.sendMessage(otherMessages[otherMessages.length - 1].content);
      return response.response.text();
  }

  const response = await client.chat.completions.create({
    model: model,
    messages: messages,
    temperature: temperature,
    max_tokens: maxTokens,
  });

  return response.choices[0].message.content;
}

export async function callStructured({ model, messages, schema, provider, temperature }) {
  const resolvedProvider = resolveProvider(provider, model);
  const client = createClient(resolvedProvider, model);

  if (resolvedProvider.api === 'openai' || !resolvedProvider.api) {
      const response = await client.chat.completions.create({
        model: model,
        messages: messages,
        temperature: temperature || 0,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'structured_output',
            strict: true,
            schema: schema
          }
        }
      });

      const content = response.choices[0].message.content;
      return JSON.parse(content);
  } else {
      // System prompt injection for providers that don't support response_format: { type: 'json_schema' } natively.
      const schemaString = JSON.stringify(schema, null, 2);
      const injectionPrompt = `You must respond with a JSON object matching this schema exactly. Output ONLY JSON, no markdown, no backticks:\n${schemaString}`;

      const injectedMessages = [...messages];
      const systemIndex = injectedMessages.findIndex(m => m.role === 'system');
      if (systemIndex !== -1) {
          injectedMessages[systemIndex] = {
              ...injectedMessages[systemIndex],
              content: injectedMessages[systemIndex].content + `\n\n${injectionPrompt}`
          };
      } else {
          injectedMessages.unshift({ role: 'system', content: injectionPrompt });
      }

      const content = await call({
          model,
          messages: injectedMessages,
          provider: resolvedProvider.id,
          temperature: temperature || 0
      });

      try {
          const match = content.match(/\{[\s\S]*\}/);
          const cleanJson = match ? match[0] : content;
          return JSON.parse(cleanJson);
      } catch (e) {
          throw new Error(`Failed to parse structured output from model ${model}: ${e.message}\nRaw output: ${content}`);
      }
  }
}

function convertToolsToAnthropic(tools) {
    return tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters
    }));
}

export async function callWithTools({ model, messages, tools, maxIterations = DEFAULT_MAX_ITERATIONS, provider }) {
  const resolvedProvider = resolveProvider(provider, model);
  const client = createClient(resolvedProvider, model);

  let currentMessages = [...messages];
  let iterations = 0;

  if (resolvedProvider.api === 'anthropic-messages') {
      const systemMessage = currentMessages.find(m => m.role === 'system');
      let otherMessages = currentMessages.filter(m => m.role !== 'system');

      const anthropicTools = convertToolsToAnthropic(tools);

      while (iterations < maxIterations) {
          iterations++;

          const response = await client.messages.create({
              model: model,
              system: systemMessage ? systemMessage.content : undefined,
              messages: otherMessages,
              tools: anthropicTools,
              max_tokens: 4096
          });

          otherMessages.push({ role: 'assistant', content: response.content });

          const toolCalls = response.content.filter(c => c.type === 'tool_use');
          if (toolCalls.length === 0) {
              return response.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
          }

          const toolResults = [];
          for (const toolCall of toolCalls) {
              const tool = tools.find(t => t.name === toolCall.name);
              let result;
              if (tool) {
                  try {
                      result = await tool.execute(toolCall.input);
                  } catch (e) {
                      result = `Error executing tool: ${e.message}`;
                  }
              } else {
                  result = `Tool ${toolCall.name} not found.`;
              }

              toolResults.push({
                  type: 'tool_result',
                  tool_use_id: toolCall.id,
                  content: typeof result === 'string' ? result : JSON.stringify(result)
              });
          }

          otherMessages.push({
              role: 'user',
              content: toolResults
          });
      }
      return otherMessages[otherMessages.length - 1].content;
  }

  if (resolvedProvider.api === 'google-generative-ai') {
      throw new Error("Tool calling with Gemini API not fully implemented yet.");
  }

  const openaiTools = tools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }
  }));

  while (iterations < maxIterations) {
    iterations++;

    const response = await client.chat.completions.create({
      model: model,
      messages: currentMessages,
      tools: openaiTools,
      tool_choice: 'auto'
    });

    const responseMessage = response.choices[0].message;
    currentMessages.push(responseMessage);

    if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
      return responseMessage.content;
    }

    for (const toolCall of responseMessage.tool_calls) {
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);

      const tool = tools.find(t => t.name === toolName);
      let toolResult;
      if (tool) {
        try {
          toolResult = await tool.execute(toolArgs);
        } catch (e) {
          toolResult = `Error executing tool: ${e.message}`;
        }
      } else {
        toolResult = `Tool ${toolName} not found.`;
      }

      currentMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolName,
        content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult)
      });
    }
  }

  return currentMessages[currentMessages.length - 1].content;
}

export const ReviewVerdictSchema = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["APPROVED", "BLOCKED", "REQUEST_CHANGES"] },
    acs_met: { type: "array", items: { type: "string" } },
    acs_missing: { type: "array", items: { type: "string" } },
    summary: { type: "string" }
  },
  required: ["verdict", "acs_met", "acs_missing", "summary"],
  additionalProperties: false
};
