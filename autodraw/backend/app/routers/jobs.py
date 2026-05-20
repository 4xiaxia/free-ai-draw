from __future__ import annotations

import json
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse

from ..schemas import (
    ClarifyJobRequest,
    ClarifyJobResponse,
    CreateJobRequest,
    CreateJobResponse,
    JobLogChunkResponse,
    JobListItem,
    JobResponse,
    ReplayJobRequest,
    ResumeJobRequest,
)
from ..pipeline.autofigure2 import generate_clarification_questions
from ..services.job_runner import (
    cancel_job,
    create_job,
    create_replay_job,
    create_resume_job,
    get_job,
    get_job_response,
    list_job_items,
)

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.post("", response_model=CreateJobResponse)
def submit_job(request: CreateJobRequest) -> CreateJobResponse:
    record = create_job(request)
    return CreateJobResponse(job_id=record.job_id, status=record.status)


@router.post("/clarify", response_model=ClarifyJobResponse)
def clarify_job(request: ClarifyJobRequest) -> ClarifyJobResponse:
    method_text = request.method_text.strip()
    if not method_text:
        raise HTTPException(status_code=400, detail="method_text is required")
    try:
        payload = generate_clarification_questions(
            method_text=method_text,
            api_key=request.api_key,
            base_url=request.base_url,
            provider=request.provider,
            ca_api_key=request.ca_api_key,
            ca_base_url=request.ca_base_url,
            ca_model=request.ca_model,
            ca_language=request.ca_language,
            image_model=request.image_model,
            svg_model=request.svg_model,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return ClarifyJobResponse(**payload)


@router.get("", response_model=list[JobListItem])
def list_jobs(limit: int = 20, offset: int = 0) -> list[JobListItem]:
    return list_job_items(limit=limit, offset=offset)


@router.post("/{job_id}/resume", response_model=CreateJobResponse)
def resume_job(job_id: str, request: ResumeJobRequest) -> CreateJobResponse:
    try:
        record = create_resume_job(job_id, request)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CreateJobResponse(job_id=record.job_id, status=record.status)


@router.post("/{job_id}/replay", response_model=CreateJobResponse)
def replay_job(job_id: str, request: ReplayJobRequest) -> CreateJobResponse:
    try:
        record = create_replay_job(job_id, request)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CreateJobResponse(job_id=record.job_id, status=record.status)


@router.post("/{job_id}/cancel", response_model=JobResponse)
def terminate_job(job_id: str) -> JobResponse:
    try:
        cancel_job(job_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    response = get_job_response(job_id)
    if response is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return response


@router.get("/{job_id}", response_model=JobResponse)
def fetch_job(job_id: str) -> JobResponse:
    response = get_job_response(job_id)
    if response is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return response


@router.get("/{job_id}/logs", response_model=JobLogChunkResponse)
def fetch_job_logs(job_id: str, offset: int = 0, limit: int = 65536) -> JobLogChunkResponse:
    record = get_job(job_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Job not found")

    log_path = record.log_path
    if not log_path.is_file():
        raise HTTPException(status_code=404, detail="Log not found")

    safe_offset = max(0, offset)
    safe_limit = max(1024, min(limit, 1024 * 1024))
    with log_path.open("r", encoding="utf-8") as handle:
        handle.seek(safe_offset)
        payload = handle.read(safe_limit)
        next_offset = handle.tell()

    lines = payload.splitlines()
    completed = record.status in {"succeeded", "failed", "cancelled"} and next_offset >= log_path.stat().st_size
    return JobLogChunkResponse(
        job_id=job_id,
        offset=safe_offset,
        next_offset=next_offset,
        completed=completed,
        lines=lines,
    )


@router.get("/{job_id}/logs/stream")
def stream_job_logs(job_id: str) -> StreamingResponse:
    record = get_job(job_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Job not found")

    log_path = record.log_path
    if not log_path.is_file():
        raise HTTPException(status_code=404, detail="Log not found")

    def event_stream():
        offset = 0
        while True:
            current_record = get_job(job_id)
            if current_record is None:
                break

            with log_path.open("r", encoding="utf-8") as handle:
                handle.seek(offset)
                payload = handle.read()
                offset = handle.tell()

            if payload:
                for line in payload.splitlines():
                    message = json.dumps(
                        {
                            "job_id": job_id,
                            "offset": offset,
                            "line": line,
                        },
                        ensure_ascii=False,
                    )
                    yield f"event: log\ndata: {message}\n\n"
            elif current_record.status in {"succeeded", "failed", "cancelled"}:
                message = json.dumps(
                    {
                        "job_id": job_id,
                        "status": current_record.status,
                    },
                    ensure_ascii=False,
                )
                yield f"event: end\ndata: {message}\n\n"
                break
            else:
                yield ": ping\n\n"

            time.sleep(0.5)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{job_id}/bundle")
def download_bundle(job_id: str) -> FileResponse:
    record = get_job(job_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if record.status != "succeeded":
        raise HTTPException(status_code=409, detail="Job is not finished successfully")
    if record.bundle_path is None or not record.bundle_path.is_file():
        raise HTTPException(status_code=404, detail="Bundle not found")
    return FileResponse(record.bundle_path, filename=f"{job_id}.zip")


@router.get("/{job_id}/artifacts/{artifact_path:path}")
def download_artifact(job_id: str, artifact_path: str) -> FileResponse:
    record = get_job(job_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Job not found")

    candidate = (record.job_dir / artifact_path).resolve()
    if not str(candidate).startswith(str(record.job_dir.resolve())):
        raise HTTPException(status_code=400, detail="Invalid artifact path")
    if not candidate.is_file():
        raise HTTPException(status_code=404, detail="Artifact not found")
    return FileResponse(candidate, filename=Path(artifact_path).name)
