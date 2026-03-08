import sqlite3
import pytest
import os
import tempfile

def test_fk_constraint_enforced():
    # Use a temporary file for the database to test real file behavior
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name
    
    try:
        conn = sqlite3.connect(db_path)
        conn.execute("PRAGMA foreign_keys = ON")
        
        # Create parent and child tables
        conn.execute("CREATE TABLE parents (id TEXT PRIMARY KEY)")
        conn.execute("CREATE TABLE children (id TEXT PRIMARY KEY, parent_id TEXT, FOREIGN KEY(parent_id) REFERENCES parents(id))")
        
        # Insert a parent
        conn.execute("INSERT INTO parents (id) VALUES ('p1')")
        conn.commit()
        
        # Try inserting a child with existing parent (should work)
        conn.execute("INSERT INTO children (id, parent_id) VALUES ('c1', 'p1')")
        conn.commit()
        
        # Try inserting a child with non-existent parent (should fail)
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("INSERT INTO children (id, parent_id) VALUES ('c2', 'p2')")
            conn.commit()
            
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)
