"""
rag_service.py
--------------
RAG pipeline for InvestMate's KB assistant.

Strategy
--------
• Knowledge base = backend/kb_data/*.txt (auto-generated per-symbol analysis snapshots)
  + backend/KB.pdf (optional supplementary document for general finance concepts)
• Index is built asynchronously in a background thread on startup.
• update_symbol_in_kb() is called by kb_generator after each stock analysis — it triggers
  a debounced rebuild so the chatbot immediately picks up the new data.
• Falls back to direct LLM call if kb_data/ is empty and KB.pdf is absent.
• All secrets are read from environment variables (GOOGLE_API_KEY).
"""

import os
import logging
import threading
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
_BACKEND_DIR  = Path(__file__).resolve().parent.parent
_KB_DATA_DIR  = _BACKEND_DIR / "kb_data"          # auto-generated per-symbol snapshots
_KB_PDF_PATH  = _BACKEND_DIR / "KB.pdf"           # optional supplementary PDF

# ── Singleton state ───────────────────────────────────────────────────────────
_rag_lock        = threading.Lock()
_retriever       = None    # LangChain BaseRetriever (if any docs exist)
_index_error     = None    # str error if build failed
_index_ready     = False   # True once background thread is done
_index_status    = "idle"  # idle | building | ready | error
_rebuild_queued  = False   # True when a second rebuild is waiting


def init_rag_service():
    """Start the index build process in a background thread (called once on app startup)."""
    global _index_ready
    if not _index_ready:
        thread = threading.Thread(target=_build_index, daemon=True)
        thread.start()


def update_symbol_in_kb(symbol: str):
    """
    Called by kb_generator after writing a new snapshot for `symbol`.
    Triggers a debounced FAISS rebuild in the background — if a build is already
    running, queues exactly one more rebuild to pick up the latest file.
    """
    global _rebuild_queued, _index_ready, _index_error, _retriever, _index_status

    with _rag_lock:
        if _index_status == "building":
            # A build is in progress — queue one more to run after it finishes
            _rebuild_queued = True
            logger.info(f"[RAG] Rebuild queued for {symbol} (current build in progress)")
            return
        # Otherwise kick off immediately
        _retriever    = None
        _index_error  = None
        _index_ready  = False
        _index_status = "idle"

    thread = threading.Thread(target=_build_index, daemon=True)
    thread.start()
    logger.info(f"[RAG] Re-index triggered for {symbol}")


def reload_rag_service():
    """Force a full re-index (used by the status endpoint or manual triggers)."""
    global _retriever, _index_error, _index_ready, _index_status
    with _rag_lock:
        _retriever    = None
        _index_error  = None
        _index_ready  = False
        _index_status = "idle"
    thread = threading.Thread(target=_build_index, daemon=True)
    thread.start()
    logger.info("[RAG] Full re-index triggered manually.")


def get_kb_info() -> dict:
    """Return metadata about the current Knowledge Base state."""
    snapshots = list(_KB_DATA_DIR.glob("*.txt")) if _KB_DATA_DIR.exists() else []
    return {
        "status":          _index_status,
        "symbols_indexed": [p.stem for p in snapshots],
        "snapshot_count":  len(snapshots),
        "kb_pdf_exists":   _KB_PDF_PATH.exists(),
        "error":           _index_error,
    }


def _build_index() -> None:
    global _retriever, _index_error, _index_ready, _index_status, _rebuild_queued

    with _rag_lock:
        if _index_ready:
            return
        _index_status = "building"

    try:
        api_key = os.getenv("GOOGLE_API_KEY", "").strip()
        if not api_key:
            raise EnvironmentError("GOOGLE_API_KEY is not set. Add it to backend/.env.")

        from langchain_text_splitters import RecursiveCharacterTextSplitter
        from langchain_community.vectorstores import FAISS
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        from langchain_core.documents import Document

        all_docs = []

        # ── Load per-symbol snapshots from kb_data/ ───────────────────────
        _KB_DATA_DIR.mkdir(parents=True, exist_ok=True)
        snapshot_files = list(_KB_DATA_DIR.glob("*.txt"))
        if snapshot_files:
            for txt_path in snapshot_files:
                try:
                    text = txt_path.read_text(encoding="utf-8")
                    all_docs.append(Document(
                        page_content=text,
                        metadata={"source": txt_path.name, "symbol": txt_path.stem}
                    ))
                except Exception as e:
                    logger.warning(f"[RAG] Could not read {txt_path.name}: {e}")
            logger.info(f"[RAG] Loaded {len(snapshot_files)} stock snapshots from kb_data/")

        # ── Optionally load KB.pdf for supplementary concepts ─────────────
        if _KB_PDF_PATH.exists():
            try:
                from langchain_community.document_loaders import PyPDFLoader
                loader   = PyPDFLoader(str(_KB_PDF_PATH))
                pdf_docs = loader.load()
                if pdf_docs:
                    all_docs.extend(pdf_docs)
                    logger.info(f"[RAG] Loaded {len(pdf_docs)} pages from KB.pdf")
            except Exception as e:
                logger.warning(f"[RAG] Could not load KB.pdf: {e}")

        # ── No documents at all — LLM-only fallback ───────────────────────
        if not all_docs:
            logger.info("[RAG] No KB documents found. Running in LLM-only mode.")
            with _rag_lock:
                _retriever    = None
                _index_ready  = True
                _index_status = "ready"
            return

        # ── Split and embed ───────────────────────────────────────────────
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
        chunks   = splitter.split_documents(all_docs)
        logger.info(f"[RAG] {len(all_docs)} docs → {len(chunks)} chunks — building FAISS index…")

        embeddings  = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=api_key,
        )
        vectorstore = FAISS.from_documents(chunks, embeddings)

        with _rag_lock:
            _retriever    = vectorstore.as_retriever(
                search_type="similarity", search_kwargs={"k": 6}
            )
            _index_status = "ready"
            _index_error  = None
            _index_ready  = True

        logger.info(f"[RAG] FAISS index ready — {len(chunks)} chunks indexed ✓")

    except Exception as exc:
        logger.error(f"[RAG] Index build failed: {exc}")
        with _rag_lock:
            _index_error  = str(exc)
            _index_status = "error"
            _index_ready  = True

    finally:
        # If another rebuild was queued while we were building, kick it off now
        with _rag_lock:
            should_rebuild = _rebuild_queued
            _rebuild_queued = False

        if should_rebuild:
            logger.info("[RAG] Running queued rebuild...")
            with _rag_lock:
                _index_ready  = False
                _index_status = "idle"
            threading.Thread(target=_build_index, daemon=True).start()


# ── Public API ────────────────────────────────────────────────────────────────

def answer_question(query: str, context_symbol: str = None) -> dict:
    """Run the RAG pipeline or direct LLM for `query`."""
    query = (query or "").strip()
    if not query:
        return {"error": "Query must not be empty."}

    if not _index_ready:
        logger.info("[RAG] Waiting for background index build…")
        # Don't call _build_index() directly — it would race with the background thread
        import time
        for _ in range(30):          # wait up to 30 s
            time.sleep(1)
            if _index_ready:
                break

    if _index_error:
        return {"error": f"Service unavailable: {_index_error}"}

    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_classic.chains.combine_documents import create_stuff_documents_chain
        from langchain_classic.chains import create_retrieval_chain

        api_key = os.getenv("GOOGLE_API_KEY", "").strip()
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=api_key,
            temperature=0,
        )

        situational_context = ""
        if context_symbol:
            situational_context = (
                f"The user is currently viewing the stock analysis page for: {context_symbol}.\n"
                f"If they say 'this stock', 'it', 'the prediction', 'the signal', or 'the analysis', "
                f"they are referring to {context_symbol}.\n"
                f"Prioritise retrieving context about {context_symbol} when answering.\n\n"
            )

        system_prompt = (
            "You are InvestMate AI, an intelligent financial assistant with access to "
            "live stock analysis reports generated by InvestMate's LSTM prediction engine.\n\n"
            f"{situational_context}"
            "Instructions:\n"
            "1. If the retrieved context contains analysis data for the stock the user is asking about "
            "(price, prediction, signal, sentiment, risk, regime), use ONLY that data to answer. "
            "Be precise — quote exact numbers from the context.\n"
            "2. If the user asks WHY the signal is a certain value (Buy/Hold/Sell), explain using "
            "the direction probability, regime weight, sentiment merge, and AUC from the context.\n"
            "3. For general finance questions not covered in the context, use your general expertise.\n"
            "4. For LIVE real-time prices or news, state you cannot access live data "
            "(but you CAN reference the last-analysed price from the report).\n"
            "5. Keep answers concise, structured, and easy to read. Use bullet points where helpful.\n\n"
            "Retrieved Analysis Context:\n{context}"
        )

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "{input}"),
        ])

        qa_chain = create_stuff_documents_chain(llm, prompt)

        if _retriever:
            rag_chain = create_retrieval_chain(_retriever, qa_chain)
            result    = rag_chain.invoke({"input": query})
        else:
            result = qa_chain.invoke({"input": query, "context": []})

        answer = result.get("answer", "").strip() or "No answer was returned."
        return {"answer": answer}

    except Exception as exc:
        logger.error(f"[RAG] answer_question failed: {exc}")
        return {"error": f"Failed to generate answer: {str(exc)}"}
