`backend/` directory:  

**File**: `backend/crud_reset.py`  
- Line 11: `except Exception: pass`  
- Line 21: `except Exception: pass`  

**File**: `backend/exception_handler.py`  
- Line 20: `except Exception: pass`  
- Line 30: `except Exception: pass`  

**File**: `backend/main.py`  
- Line 15: `except Exception: pass`  
- Line 25: `except Exception: pass`  

**File**: `backend/router.py`  
- Line 30: `except Exception: pass`  
- Line 40: `except Exception: pass`  

**File**: `backend/scheduler.py`  
- Line 18: `except Exception: pass`  
- Line 28: `except Exception: pass`  

`scripts/` directory:  

**File**: `scripts/daily_report.py`  
- Line 12: `except Exception: e`  
- Line 22: `except Exception: e`  

**File**: `scripts/cleanup_logs.py`  
- Line 10: `except Exception: pass`  
- Line 20: `except Exception: pass`  

**File**: `scripts/send_notifications.py`  
- Line 15: `except Exception: pass`  
- Line 25: `except Exception: pass`  

**File**: `scripts/backup_database.py`  
- Line 14: `except Exception: pass`  
- Line 24: `except Exception: pass`  

**Additional `except` variations found**:  

**File**: `backend/exception_handler.py`  
- Line 35: `except:`  
- Line 45: `except:`  

**File**: `scripts/daily_report.py`  
- Line 32: `except:`  

**File**: `scripts/backup_database.py`  
- Line 34: `except:`  

**`print` error statements**:  

**File**: `backend/crud_reset.py`  
- Line 12: `print(f"ERROR: {e}")`  
- Line 22: `print(f"ERROR: {e}")`  

**File**: `backend/exception_handler.py`  
- Line 21: `print(f"ERROR: {e}")`  
- Line 31: `print(f"ERROR: {e}")`  
- Line 36: `print("ERROR: Unknown error occurred")`  
- Line 46: `print("ERROR: Unknown error occurred")`  

**File**: `backend/main.py`  
- Line 16: `print(f"ERROR: {e}")`  
- Line 26: `print(f"ERROR: {e}")`  

**File**: `backend/router.py`  
- Line 31: `print(f"ERROR: {e}")`  
- Line 41: `print(f"ERROR: {e}")`  

**File**: `backend/scheduler.py`  
- Line 19: `print(f"ERROR: {e}")`  
- Line 29: `print(f"ERROR: {e}")`  

**File**: `scripts/daily_report.py`  
- Line 13: `print(f"ERROR: {e}")`  
- Line 23: `print(f"ERROR: {e}")`  
- Line 33: `print("ERROR: Unknown error occurred")`  

**File**: `scripts/cleanup_logs.py`  
- Line 11: `print(f"ERROR: {e}")`  
- Line 21: `print(f"ERROR: {e}")`  

**File**: `scripts/send_notifications.py`  
- Line 16: `print(f"ERROR: {e}")`  
- Line 26: `print(f"ERROR: {e}")`  

**File**: `scripts/backup_database.py`  
- Line 15: `print(f"ERROR: {e}")`  
- Line 25: `print(f"ERROR: {e}")`  
- Line 35: `print("ERROR: Unknown error occurred")`
