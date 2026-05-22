import hmac
import hashlib

def verify_hmac_signature(payload: bytes, signature: str, secret: str) -> bool:
    """
    Verifies that the given payload has a valid HMAC signature using the given secret.
    
    Args:
        payload (bytes): The raw request payload.
        signature (str): The expected signature (e.g., from X-Hub-Signature-256 header).
                         Expected format: 'sha256=<hex_digest>'
        secret (str): The shared secret key.
        
    Returns:
        bool: True if the signature is valid, False otherwise.
    """
    # Handle empty inputs gracefully
    if not signature or not secret:
        return False
    if not payload:
        # Empty payload is valid - compute HMAC and compare
        pass
        
    # GitHub's signature is prefixed with "sha256="
    if signature.startswith("sha256="):
        signature = signature[7:]
        
    # Compute the expected HMAC signature
    expected_hmac = hmac.new(
        key=secret.encode('utf-8'),
        msg=payload,
        digestmod=hashlib.sha256
    ).hexdigest()
    
    # Securely compare the expected signature with the provided one
    return hmac.compare_digest(expected_hmac, signature)
