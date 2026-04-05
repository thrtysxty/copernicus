import crypto from 'crypto';

function getSecret() {
  return process.env.JULES_API_KEY || 'default-daemon-secret';
}

export function generateToken(agentName, storyId, capabilities, difficultyScore, ttlHours) {
  const baseUuid = crypto.randomUUID();
  const signature = crypto.createHmac('sha256', getSecret()).update(baseUuid).digest('hex').substring(0, 16);
  const tokenId = `${baseUuid}-${signature}`;
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + ttlHours * 60 * 60 * 1000);

  return {
    token_id: tokenId,
    agent_name: agentName,
    story_id: storyId,
    capabilities,
    difficulty_score: difficultyScore,
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    revoked_at: null
  };
}

export function isExpired(token) {
  if (token.revoked_at) return true;
  return new Date() > new Date(token.expires_at);
}
