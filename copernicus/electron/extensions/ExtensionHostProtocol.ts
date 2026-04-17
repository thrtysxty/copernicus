// Story 685 — Extension Host Process + JSON-RPC Protocol

export interface JsonRpcBase {
  jsonrpc: '2.0';
}

// Main -> Host
export interface ActivateExtensionMessage extends JsonRpcBase {
  method: 'extension/activate';
  params: { extensionPath: string };
}

export interface DeactivateExtensionMessage extends JsonRpcBase {
  method: 'extension/deactivate';
  params: { name: string };
}

export interface ApiCallRequestMessage extends JsonRpcBase {
  method: 'api/call';
  id: string;
  params: { method: string; args: unknown[] };
}

// Host -> Main
export interface ExtensionActivatedMessage extends JsonRpcBase {
  method: 'extension/activated';
  params: { name: string; version: string };
}

export interface ApiCallResultMessage extends JsonRpcBase {
  method: 'api/result';
  id: string;
  result?: unknown;
  error?: string;
}

export interface ExtensionErrorMessage extends JsonRpcBase {
  method: 'extension/error';
  params: { name: string; message: string };
}

export type ExtensionHostMessage =
  | ActivateExtensionMessage
  | DeactivateExtensionMessage
  | ApiCallRequestMessage
  | ExtensionActivatedMessage
  | ApiCallResultMessage
  | ExtensionErrorMessage;
