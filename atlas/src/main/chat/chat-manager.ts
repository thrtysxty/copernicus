import { ipcMain, BrowserWindow } from 'electron';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { join } from 'path';
import { app } from 'electron';
import { AuthManager } from '../auth/auth-manager';
import { mcpManager } from '../mcp/mcp-manager';

let Database: any;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.warn('[Chat] better-sqlite3 not found');
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ChatManager {
  private db: any;
  private auth: AuthManager;

  constructor(auth: AuthManager) {
    this.auth = auth;
    if (Database) {
      try {
        const userDataPath = app.getPath('userData');
        this.db = new Database(join(userDataPath, 'chat_history.db'));
        this.initDb();
      } catch (e) {
        console.error('[Chat] Init error', e);
      }
    }
    this.setupIpc();
  }

  private initDb() {
    if (!this.db) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        role TEXT,
        content TEXT,
        tokens_in INTEGER,
        tokens_out INTEGER,
        cost_usd REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
      );
    `);
  }

  private setupIpc() {
    ipcMain.handle('chat:send', async (event, { messages, model }) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) return;

      try {
        if (model.startsWith('claude')) {
          return await this.handleAnthropic(messages, model, window);
        } else if (model.startsWith('gemini')) {
          return await this.handleGoogle(messages, model, window);
        }
      } catch (error: any) {
        console.error('Chat error:', error);
        window.webContents.send('chat:error', error.message);
      }
    });
  }

  private async handleAnthropic(messages: any[], model: string, window: BrowserWindow) {
    const apiKey = await this.auth.getToken('anthropic');
    const anthropic = new Anthropic({ apiKey });

    const tools = mcpManager.getTools().map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema
    }));

    let currentMessages = [...messages];

    const runLoop = async (): Promise<any> => {
      const stream = await anthropic.messages.create({
        model: model === 'claude-sonnet-4-6' ? 'claude-3-5-sonnet-20241022' : 'claude-3-opus-20240229',
        max_tokens: 4096,
        messages: currentMessages,
        tools: tools.length > 0 ? tools : undefined,
        stream: true,
      });

      let responseText = '';
      let toolCalls: any[] = [];

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          responseText += chunk.delta.text;
          window.webContents.send('chat:stream', chunk.delta.text);
        } else if (chunk.type === 'content_block_start' && chunk.content_block.type === 'tool_use') {
          toolCalls.push(chunk.content_block);
        }
      }

      if (toolCalls.length > 0) {
        currentMessages.push({ role: 'assistant', content: responseText || '[Thinking...]', tool_use: toolCalls });
        
        for (const tc of toolCalls) {
          window.webContents.send('chat:stream', `\n[Using tool: ${tc.name}...]\n`);
          const result = await mcpManager.callTool(tc.name, tc.input);
          currentMessages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: tc.id,
                content: JSON.stringify(result)
              }
            ]
          });
        }
        
        return await runLoop();
      }

      return { content: responseText };
    };

    return await runLoop();
  }

  private async handleGoogle(messages: ChatMessage[], model: string, window: BrowserWindow) {
    const token = await this.auth.getToken('google');
    const genAI = new GoogleGenerativeAI(token);
    const googleModel = genAI.getGenerativeModel({ 
      model: model === 'gemini-2.0-pro' ? 'gemini-2.0-pro-exp-02-05' : 'gemini-2.0-flash' 
    });

    const chat = googleModel.startChat({
      history: messages.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
    });

    const lastMessage = messages[messages.length - 1].content;
    const result = await chat.sendMessageStream(lastMessage);

    let fullContent = '';
    for await (const chunk of result.stream) {
      const text = chunk.text();
      fullContent += text;
      window.webContents.send('chat:stream', text);
    }

    return {
      content: fullContent
    };
  }
}
