from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, model_validator


Provider = Literal["openrouter", "bianxie", "qingyun", "gemini", "local"]
SamBackend = Literal["local", "fal", "roboflow", "api"]
PlaceholderMode = Literal["none", "box", "label"]
ImageSize = Literal["1K", "2K", "4K"]
FigureLanguage = Literal["en", "zh"]
JobStatus = Literal[
    "queued",
    "running",
    "cancelling",
    "succeeded",
    "failed",
    "cancelled",
]
ResumeStage = Literal["auto", 1, 2, 3, 4, 5]
ReplayStage = Literal[1, 2, 3, 4, 5]
JobType = Literal["autodraw", "image-edit"]
SourceProcessingMode = Literal["segmented", "direct_svg"]
BackgroundRemovalProvider = Literal["local", "remote", "auto"]
ClarificationLanguage = Literal["zh", "en"]


class ClarificationOption(BaseModel):
    id: str
    label: str
    description: Optional[str] = None


class ClarificationQuestion(BaseModel):
    id: str
    title: str
    options: list[ClarificationOption] = Field(default_factory=list)
    recommended_option_id: Optional[str] = None


class ClarificationAnswer(BaseModel):
    question_id: str
    option_id: str
    label: Optional[str] = None
    description: Optional[str] = None


class ClarificationContext(BaseModel):
    questions: list[ClarificationQuestion] = Field(default_factory=list)
    answers: list[ClarificationAnswer] = Field(default_factory=list)
    context_summary: Optional[str] = None


class ClarifyJobRequest(BaseModel):
    method_text: str
    provider: Provider = "bianxie"
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    ca_api_key: Optional[str] = None
    ca_base_url: Optional[str] = None
    ca_model: Optional[str] = None
    ca_language: ClarificationLanguage = "zh"
    image_model: Optional[str] = None
    svg_model: Optional[str] = None


class ClarifyJobResponse(BaseModel):
    questions: list[ClarificationQuestion]
    context_summary: str


class CreateJobRequest(BaseModel):
    job_type: JobType = "autodraw"
    method_text: Optional[str] = None
    provider: Provider = "bianxie"
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    image_model: Optional[str] = None
    image_size: ImageSize = "4K"
    figure_language: FigureLanguage = "en"
    svg_model: Optional[str] = None
    sam_prompt: str = "icon,person,robot,animal,CurvedArrow"
    min_score: float = 0.0
    sam_backend: SamBackend = "api"
    sam_api_url: Optional[str] = None
    sam_api_key: Optional[str] = None
    sam_max_masks: int = Field(32, ge=1)
    rmbg_model_path: Optional[str] = None
    background_removal_provider: Optional[BackgroundRemovalProvider] = None
    stop_after: int = Field(5, ge=1, le=5)
    placeholder_mode: PlaceholderMode = "label"
    optimize_iterations: int = Field(0, ge=0)
    merge_threshold: float = 0.001
    reference_image_path: Optional[str] = None
    source_figure_path: Optional[str] = None
    source_processing_mode: SourceProcessingMode = "segmented"
    start_stage: int = Field(1, ge=1, le=5)
    source_job_id: Optional[str] = None
    resume_from_stage: Optional[int] = Field(None, ge=1, le=5)
    prompt: Optional[str] = None
    source_image_path: Optional[str] = None
    remove_background: bool = False
    ca_context: Optional[ClarificationContext] = None

    @model_validator(mode="after")
    def validate_payload(self) -> "CreateJobRequest":
        if self.job_type == "autodraw":
            has_method_text = bool(self.method_text and self.method_text.strip())
            has_source_figure = bool(
                self.source_figure_path and self.source_figure_path.strip()
            )
            if not has_method_text and not has_source_figure:
                raise ValueError(
                    "method_text is required for autodraw jobs unless source_figure_path is provided"
                )
            if has_source_figure:
                if self.source_processing_mode == "direct_svg":
                    if self.start_stage < 4:
                        self.start_stage = 4
                elif self.start_stage < 2:
                    self.start_stage = 2
        else:
            if not self.prompt or not self.prompt.strip():
                raise ValueError("prompt is required for image-edit jobs")
            if not self.source_image_path or not self.source_image_path.strip():
                raise ValueError("source_image_path is required for image-edit jobs")
        return self


class ArtifactInfo(BaseModel):
    name: str
    path: str
    kind: str
    size_bytes: int
    download_url: str


class CreateJobResponse(BaseModel):
    job_id: str
    status: JobStatus


class ResumeJobRequest(BaseModel):
    resume_from_stage: ResumeStage = "auto"
    image_model: Optional[str] = None
    svg_model: Optional[str] = None
    remove_background: Optional[bool] = None


class ReplayJobRequest(BaseModel):
    start_stage: ReplayStage
    image_model: Optional[str] = None
    svg_model: Optional[str] = None
    remove_background: Optional[bool] = None


class UploadReferenceImageResponse(BaseModel):
    upload_id: str
    file_name: str
    stored_path: str
    content_type: Optional[str] = None
    size_bytes: int


class JobLogChunkResponse(BaseModel):
    job_id: str
    offset: int
    next_offset: int
    completed: bool
    lines: list[str] = Field(default_factory=list)


class JobResponse(BaseModel):
    job_id: str
    status: JobStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error_message: Optional[str] = None
    artifacts: list[ArtifactInfo] = Field(default_factory=list)
    bundle_url: Optional[str] = None
    manifest_url: Optional[str] = None
    request: dict[str, Any]
    current_stage: int = 1
    last_success_stage: int = 0
    failed_stage: Optional[int] = None
    source_job_id: Optional[str] = None
    resume_from_stage: Optional[int] = None
    resume_count: int = 0
    min_start_stage: int = 1


class JobListItem(BaseModel):
    job_id: str
    job_type: JobType = "autodraw"
    status: JobStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error_message: Optional[str] = None
    bundle_url: Optional[str] = None
    preview_url: Optional[str] = None
    artifact_count: int = 0
    current_stage: int = 1
    failed_stage: Optional[int] = None
    min_start_stage: int = 1
