# -*- coding: utf-8 -*-
"""
RAG Service - Embedding-based document retrieval using ChromaDB

This service provides:
- Document upload with automatic chunking and embedding
- Semantic search using vector similarity
- Shared knowledge base across all agents

ChromaDB includes its own embedding model (all-MiniLM-L6-v2 by default)

Dependencies:
    pip install chromadb flask flask-cors
"""

import os
import json
import hashlib
import base64
from typing import List, Dict, Optional
from pathlib import Path

from document_parser import parse_document, get_supported_extensions

# Lazy imports
_chroma_client = None
_collection = None

# Configuration
# Use environment variable for cloud deployment, fallback to local path
CHROMA_DB_PATH = os.environ.get(
    "CHROMA_DB_PATH",
    os.path.join(os.path.dirname(__file__), "..", "..", "server", "chroma_rag_db")
)
COLLECTION_NAME = "knowledge_base"
CHUNK_SIZE = 500  # characters per chunk
CHUNK_OVERLAP = 50  # overlap between chunks


def get_chroma_client():
    """Lazy load the ChromaDB client."""
    global _chroma_client, _collection
    if _chroma_client is None:
        print("[RAG] Initializing ChromaDB...")
        try:
            import chromadb
            from chromadb.config import Settings

            # Ensure directory exists
            os.makedirs(CHROMA_DB_PATH, exist_ok=True)

            # Create persistent client
            _chroma_client = chromadb.PersistentClient(
                path=CHROMA_DB_PATH,
                settings=Settings(anonymized_telemetry=False)
            )
            print(f"[RAG] ChromaDB initialized: {CHROMA_DB_PATH}")

            # Get or create collection (ChromaDB uses its own embedding function by default)
            _collection = _chroma_client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"}  # Use cosine similarity
            )
            print(f"[RAG] Collection '{COLLECTION_NAME}' ready")

        except ImportError:
            print("[RAG] ERROR: chromadb not installed!")
            print("[RAG] Run: pip install chromadb")
            raise
    return _chroma_client, _collection


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """
    Split text into overlapping chunks.
    Tries to split on paragraph boundaries first, then sentences.
    """
    if not text or len(text) <= chunk_size:
        return [text] if text else []

    chunks = []
    paragraphs = text.split('\n\n')
    current_chunk = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        if len(current_chunk) + len(para) + 2 > chunk_size:
            if current_chunk:
                chunks.append(current_chunk.strip())
                # Keep overlap from end of current chunk
                if overlap > 0 and len(current_chunk) > overlap:
                    current_chunk = current_chunk[-overlap:]
                else:
                    current_chunk = ""

            # If paragraph itself is too long, split it
            if len(para) > chunk_size:
                sentences = para.replace('. ', '.\n').replace('。', '。\n').split('\n')
                for sent in sentences:
                    sent = sent.strip()
                    if not sent:
                        continue
                    if len(current_chunk) + len(sent) + 1 > chunk_size:
                        if current_chunk:
                            chunks.append(current_chunk.strip())
                            current_chunk = current_chunk[-overlap:] if overlap > 0 else ""
                    current_chunk += (" " if current_chunk else "") + sent
            else:
                current_chunk += (" " if current_chunk else "") + para
        else:
            current_chunk += ("\n\n" if current_chunk else "") + para

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks


def compute_document_hash(content: str) -> str:
    """Compute a hash for document deduplication."""
    return hashlib.md5(content.encode('utf-8')).hexdigest()[:16]


def upload_document(
    content: str,
    filename: str,
    doc_type: str = "text",
    metadata: Optional[Dict] = None
) -> Dict:
    """
    Upload a document to the knowledge base.

    Args:
        content: The document text content
        filename: Original filename
        doc_type: Document type (text, markdown, etc.)
        metadata: Optional additional metadata

    Returns:
        Dict with upload status and chunk count
    """
    if not content or not content.strip():
        return {"success": False, "error": "Empty content"}

    try:
        _, collection = get_chroma_client()

        # Compute document hash for deduplication
        doc_hash = compute_document_hash(content)

        # Chunk the document
        chunks = chunk_text(content)
        if not chunks:
            return {"success": False, "error": "No chunks generated"}

        print(f"[RAG] Processing document: {filename} ({len(chunks)} chunks)")

        # Prepare data for ChromaDB
        ids = [f"{doc_hash}-{i}" for i in range(len(chunks))]
        metadatas = [
            {
                "filename": filename,
                "doc_type": doc_type,
                "doc_hash": doc_hash,
                "chunk_index": i,
                **(metadata or {})
            }
            for i in range(len(chunks))
        ]

        # Add to collection (ChromaDB generates embeddings automatically)
        collection.add(
            ids=ids,
            documents=chunks,
            metadatas=metadatas
        )

        print(f"[RAG] Inserted {len(chunks)} chunks for '{filename}'")

        return {
            "success": True,
            "filename": filename,
            "chunks_count": len(chunks),
            "doc_hash": doc_hash,
        }

    except Exception as e:
        print(f"[RAG] Upload error: {e}")
        return {"success": False, "error": str(e)}


def search(
    query: str,
    top_k: int = 5,
    score_threshold: float = 0.3
) -> List[Dict]:
    """
    Search the knowledge base using semantic similarity.

    Args:
        query: The search query
        top_k: Number of results to return
        score_threshold: Minimum similarity score (0-1 for cosine)

    Returns:
        List of matching chunks with scores
    """
    if not query or not query.strip():
        return []

    try:
        _, collection = get_chroma_client()

        # Check if collection is empty
        if collection.count() == 0:
            print("[RAG] Knowledge base is empty")
            return []

        # Query ChromaDB (it handles embedding automatically)
        results = collection.query(
            query_texts=[query],
            n_results=top_k,
            include=["documents", "metadatas", "distances"]
        )

        # Format results
        chunks = []
        if results and results['ids'] and len(results['ids']) > 0:
            for i, doc_id in enumerate(results['ids'][0]):
                # ChromaDB returns distances, convert to similarity score
                # For cosine distance: similarity = 1 - distance
                distance = results['distances'][0][i] if results['distances'] else 0
                score = 1 - distance  # Convert distance to similarity

                if score >= score_threshold:
                    metadata = results['metadatas'][0][i] if results['metadatas'] else {}
                    chunks.append({
                        "content": results['documents'][0][i] if results['documents'] else "",
                        "source": metadata.get("filename", "Unknown"),
                        "doc_type": metadata.get("doc_type", "text"),
                        "chunk_index": metadata.get("chunk_index", 0),
                        "score": round(score, 4),
                    })

        print(f"[RAG] Search for '{query[:30]}...' returned {len(chunks)} results")
        return chunks

    except Exception as e:
        print(f"[RAG] Search error: {e}")
        return []


def get_stats() -> Dict:
    """Get knowledge base statistics."""
    try:
        _, collection = get_chroma_client()

        return {
            "collection": COLLECTION_NAME,
            "total_chunks": collection.count(),
            "embedding_model": "all-MiniLM-L6-v2 (ChromaDB default)",
        }
    except Exception as e:
        return {"error": str(e)}


def delete_document(doc_hash: str) -> Dict:
    """Delete all chunks for a specific document by its hash."""
    try:
        _, collection = get_chroma_client()

        # Get all IDs for this document
        results = collection.get(
            where={"doc_hash": doc_hash},
            include=[]
        )

        if results['ids']:
            collection.delete(ids=results['ids'])
            return {"success": True, "deleted_count": len(results['ids'])}

        return {"success": True, "deleted_count": 0, "message": "No chunks found"}
    except Exception as e:
        return {"success": False, "error": str(e)}



def get_documents() -> List[Dict]:
    """Get list of all documents in the knowledge base."""
    try:
        _, collection = get_chroma_client()
        # Fetch all metadata to find unique files
        result = collection.get(include=['metadatas'])

        files = {}
        if result['metadatas']:
            for meta in result['metadatas']:
                if not meta: continue
                doc_hash = meta.get('doc_hash')
                if doc_hash and doc_hash not in files:
                    files[doc_hash] = {
                        'filename': meta.get('filename'),
                        'doc_type': meta.get('doc_type'),
                        'doc_hash': doc_hash,
                        'chunks_count': 0
                    }
                if doc_hash:
                    files[doc_hash]['chunks_count'] += 1

        return list(files.values())
    except Exception as e:
        print(f"[RAG] Error listing documents: {e}")
        return []


def clear_all() -> Dict:
    """Clear all documents from the knowledge base."""
    global _collection
    try:
        client, _ = get_chroma_client()

        # Delete and recreate collection
        client.delete_collection(COLLECTION_NAME)
        _collection = client.create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"}
        )

        return {"success": True, "message": "Knowledge base cleared"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def upload_file(
    file_content: bytes,
    filename: str,
    mime_type: Optional[str] = None,
    metadata: Optional[Dict] = None
) -> Dict:
    """
    Upload a file (PDF, DOCX, PPTX, TXT) to the knowledge base.

    Args:
        file_content: File content as bytes
        filename: Original filename
        mime_type: Optional MIME type for detection
        metadata: Optional additional metadata

    Returns:
        Dict with upload status, extracted text info, and chunk count
    """
    if not file_content:
        return {"success": False, "error": "Empty file content"}

    # Parse the document
    text, doc_type, error = parse_document(file_content, filename, mime_type)

    if error:
        return {"success": False, "error": error, "doc_type": doc_type}

    if not text or not text.strip():
        return {"success": False, "error": "No text could be extracted from the file"}

    # Upload the extracted text
    result = upload_document(
        content=text,
        filename=filename,
        doc_type=doc_type,
        metadata=metadata
    )

    if result.get("success"):
        result["extracted_chars"] = len(text)

    return result


# ============ HTTP API Server ============

def create_flask_app():
    """Create a Flask app for the RAG API."""
    from flask import Flask, request, jsonify, render_template, session, redirect, url_for
    from flask_cors import CORS

    app = Flask(__name__)
    app.secret_key = os.environ.get("FLASK_SECRET_KEY", "rag-dashboard-secret-key-123")
    CORS(app)

    # Auth checks
    USER_EMAIL = "root@example.com"
    USER_PASS = "1234567890"

    @app.route('/login', methods=['GET', 'POST'])
    def login():
        error = None
        if request.method == 'POST':
            email = request.form.get('email')
            password = request.form.get('password')
            if email == USER_EMAIL and password == USER_PASS:
                session['logged_in'] = True
                return redirect(url_for('dashboard'))
            else:
                error = 'Invalid credentials'
        return render_template('login.html', error=error)

    @app.route('/rag/upload', methods=['POST'])
    def api_upload():
        """Upload text content directly."""
        data = request.json
        result = upload_document(
            content=data.get('content', ''),
            filename=data.get('filename', 'unknown'),
            doc_type=data.get('type', 'text'),
            metadata=data.get('metadata')
        )
        return jsonify(result)

    @app.route('/rag/upload-file', methods=['POST'])
    def api_upload_file():
        """
        Upload a file (PDF, DOCX, PPTX, TXT, MD).

        Accepts either:
        1. multipart/form-data with 'file' field
        2. JSON with base64-encoded 'content' and 'filename'
        """
        # Check for multipart file upload
        if 'file' in request.files:
            file = request.files['file']
            if file.filename == '':
                return jsonify({"success": False, "error": "No file selected"})

            file_content = file.read()
            filename = file.filename
            mime_type = file.content_type
        else:
            # JSON with base64 content
            data = request.json or {}
            if 'content' not in data:
                return jsonify({"success": False, "error": "No file content provided"})

            try:
                file_content = base64.b64decode(data['content'])
            except Exception as e:
                return jsonify({"success": False, "error": f"Invalid base64 content: {e}"})

            filename = data.get('filename', 'unknown')
            mime_type = data.get('mimeType')

        result = upload_file(
            file_content=file_content,
            filename=filename,
            mime_type=mime_type,
            metadata=data.get('metadata') if 'data' in dir() else None
        )
        return jsonify(result)

    @app.route('/rag/supported-formats', methods=['GET'])
    def api_supported_formats():
        """Get list of supported file formats."""
        return jsonify({
            "formats": get_supported_extensions(),
            "description": {
                ".pdf": "PDF documents",
                ".docx": "Microsoft Word documents",
                ".pptx": "Microsoft PowerPoint presentations",
                ".txt": "Plain text files",
                ".md": "Markdown files"
            }
        })

    @app.route('/rag/search', methods=['POST'])
    def api_search():
        data = request.json
        results = search(
            query=data.get('query', ''),
            top_k=data.get('topK', 5),
            score_threshold=data.get('threshold', 0.3)
        )
        return jsonify({"chunks": results})

    @app.route('/rag/stats', methods=['GET'])
    def api_stats():
        return jsonify(get_stats())

    @app.route('/rag/clear', methods=['POST'])
    def api_clear():
        return jsonify(clear_all())

    @app.route('/rag/delete', methods=['POST'])
    def api_delete():
        data = request.json
        doc_hash = data.get('doc_hash', '')
        return jsonify(delete_document(doc_hash))

    @app.route('/rag/files', methods=['GET'])
    def api_files():
        return jsonify({"documents": get_documents()})

    @app.route('/')
    def dashboard():
        if not session.get('logged_in'):
            return redirect(url_for('login'))
        return render_template('dashboard.html')

    @app.route('/health', methods=['GET'])
    def health():
        return jsonify({"status": "ok", "service": "rag"})

    return app


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="RAG Service with ChromaDB")
    parser.add_argument("--port", type=int, default=4001, help="Port to run the API")
    parser.add_argument("--test", action="store_true", help="Run a quick test")
    args = parser.parse_args()

    if args.test:
        # Quick test
        print("Testing RAG service...")

        # Test upload
        result = upload_document(
            content="ChromaDB is an AI-native open-source embedding database. It makes it easy to build AI applications with embeddings. ChromaDB handles embedding generation automatically.",
            filename="test.txt"
        )
        print(f"Upload result: {result}")

        # Test search
        results = search("What is ChromaDB?")
        print(f"Search results: {results}")

        # Test stats
        stats = get_stats()
        print(f"Stats: {stats}")

        # Test listing
        docs = get_documents()
        print(f"Documents: {len(docs)} found")
    else:
        # Run API server
        # Support Railway's PORT environment variable
        port = int(os.environ.get("PORT", args.port))
        app = create_flask_app()
        print(f"[RAG] Starting RAG API server on port {port}")
        print(f"[RAG] Using ChromaDB with persistent storage at: {CHROMA_DB_PATH}")
        print(f"[RAG] Environment: {'CLOUD' if os.environ.get('RAILWAY_ENVIRONMENT') else 'LOCAL'}")
        app.run(host="0.0.0.0", port=port, debug=False)
