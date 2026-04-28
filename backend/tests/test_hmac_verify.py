import hmac
import hashlib
from backend.utils.hmac_verify import verify_hmac_signature

def test_verify_hmac_signature_valid():
    payload = b'{"test": "data"}'
    secret = "my_secret_key"

    # Generate valid signature
    expected_hmac = hmac.new(
        key=secret.encode('utf-8'),
        msg=payload,
        digestmod=hashlib.sha256
    ).hexdigest()

    assert verify_hmac_signature(payload, expected_hmac, secret) is True

def test_verify_hmac_signature_with_prefix():
    payload = b'{"test": "data"}'
    secret = "my_secret_key"

    # Generate valid signature with sha256= prefix
    expected_hmac = "sha256=" + hmac.new(
        key=secret.encode('utf-8'),
        msg=payload,
        digestmod=hashlib.sha256
    ).hexdigest()

    assert verify_hmac_signature(payload, expected_hmac, secret) is True

def test_verify_hmac_signature_invalid():
    payload = b'{"test": "data"}'
    secret = "my_secret_key"
    invalid_signature = "sha256=invalid_signature_hex"

    assert verify_hmac_signature(payload, invalid_signature, secret) is False

def test_verify_hmac_signature_empty_payload():
    secret = "my_secret_key"
    signature = "some_signature"

    assert verify_hmac_signature(b'', signature, secret) is False

def test_verify_hmac_signature_empty_signature():
    payload = b'{"test": "data"}'
    secret = "my_secret_key"

    assert verify_hmac_signature(payload, "", secret) is False

def test_verify_hmac_signature_empty_secret():
    payload = b'{"test": "data"}'
    signature = "some_signature"

    assert verify_hmac_signature(payload, signature, "") is False

def test_verify_hmac_signature_none_inputs():
    assert verify_hmac_signature(None, "sig", "sec") is False
    assert verify_hmac_signature(b"data", None, "sec") is False
    assert verify_hmac_signature(b"data", "sig", None) is False
