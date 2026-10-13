import os
from typing import Union, BinaryIO

class LocalStorage:
    def __init__(self, storage_dir: str):
        self.storage_dir = storage_dir
        
        # Ensure directories exist
        self.drafts_dir = os.path.join(self.storage_dir, "drafts")
        self.generated_dir = os.path.join(self.storage_dir, "generated")
        self.approved_dir = os.path.join(self.storage_dir, "approved")
        self.rejected_dir = os.path.join(self.storage_dir, "rejected")
        self.exports_dir = os.path.join(self.storage_dir, "exports")
        
        os.makedirs(self.drafts_dir, exist_ok=True)
        os.makedirs(self.generated_dir, exist_ok=True)
        os.makedirs(self.approved_dir, exist_ok=True)
        os.makedirs(self.rejected_dir, exist_ok=True)
        os.makedirs(self.exports_dir, exist_ok=True)
        
    def get_path(self, category: str, filename: str) -> str:
        """Get the absolute path for a file in a specific category."""
        category_dir = os.path.join(self.storage_dir, category)
        if not os.path.exists(category_dir):
            raise ValueError(f"Storage category '{category}' does not exist.")
        return os.path.join(category_dir, filename)

    def save(self, category: str, filename: str, content: Union[str, bytes]) -> str:
        """Save content to the local filesystem."""
        file_path = self.get_path(category, filename)
        
        mode = "wb" if isinstance(content, bytes) else "w"
        with open(file_path, mode) as f:
            f.write(content)
            
        return file_path
        
    def read(self, category: str, filename: str, as_bytes: bool = False) -> Union[str, bytes]:
        """Read content from the local filesystem."""
        file_path = self.get_path(category, filename)
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File {filename} not found in {category}")
            
        mode = "rb" if as_bytes else "r"
        with open(file_path, mode) as f:
            return f.read()
            
    def delete(self, category: str, filename: str) -> bool:
        """Delete a file from the local filesystem."""
        file_path = self.get_path(category, filename)
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False
        
    def exists(self, category: str, filename: str) -> bool:
        """Check if a file exists."""
        file_path = self.get_path(category, filename)
        return os.path.exists(file_path)
