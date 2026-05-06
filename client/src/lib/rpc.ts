/**
 * RPC method alias map for version compatibility.
 * When the primary method name is not supported by the backend,
 * the adapter will try each alias in order.
 */
const RPC_ALIASES: Record<string, string[]> = {
  'sessions.reset': ['sessions.patch'],
  'sessions.compact': ['sessions.patch'],
  'sessions.delete': ['sessions.patch'],
  'node.list': ['nodes.list'],
  'node.invoke': ['nodes.action'],
  'config.schema.lookup': ['config.schema'],
  'skills.patch': ['skills.enable', 'skills.disable'],
};

/**
 * Get all method name variants to try for a given method.
 * Returns the primary method first, then any aliases.
 */
export function getRpcAliases(method: string): string[] {
  const aliases = RPC_ALIASES[method];
  if (aliases) {
    return [method, ...aliases];
  }
  return [method];
}

/**
 * Build an RPC request object.
 */
export function buildRpcRequest(
  method: string,
  params?: Record<string, unknown>,
  id?: number
): { jsonrpc: '2.0'; id: number; method: string; params?: Record<string, unknown> } {
  return {
    jsonrpc: '2.0',
    id: id ?? Date.now(),
    method,
    params,
  };
}
