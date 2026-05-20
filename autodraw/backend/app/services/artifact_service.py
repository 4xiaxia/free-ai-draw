from __future__ import annotations

from pathlib import Path

from ..schemas import ArtifactInfo


KNOWN_ARTIFACT_KINDS = {
    "figure.png": "figure",
    "samed.png": "samed",
    "source.png": "source_image",
    "edited.png": "edited_image",
    "boxlib.json": "boxlib",
    "scene.json": "scene_json",
    "template.svg": "template_svg",
    "optimized_template.svg": "optimized_template_svg",
    "final.svg": "final_svg",
    "process_trace.json": "process_trace",
    "run.log": "log",
    "manifest.json": "manifest",
}


def scan_artifacts(job_id: str, job_dir: Path) -> list[ArtifactInfo]:
    artifacts: list[ArtifactInfo] = []

    for filename in KNOWN_ARTIFACT_KINDS:
        path = job_dir / filename
        if not path.is_file():
            continue
        artifacts.append(_build_artifact(job_id=job_id, job_dir=job_dir, path=path))

    icons_dir = job_dir / "icons"
    if icons_dir.is_dir():
        for path in sorted(p for p in icons_dir.rglob("*") if p.is_file()):
            artifacts.append(_build_artifact(job_id=job_id, job_dir=job_dir, path=path))

    return artifacts


def _build_artifact(job_id: str, job_dir: Path, path: Path) -> ArtifactInfo:
    rel_path = path.relative_to(job_dir).as_posix()
    kind = KNOWN_ARTIFACT_KINDS.get(rel_path)
    if kind is None and rel_path.startswith("icons/"):
        kind = "icon"
    if kind is None:
        kind = "artifact"

    return ArtifactInfo(
        name=path.name,
        path=rel_path,
        kind=kind,
        size_bytes=path.stat().st_size,
        download_url=f"/api/jobs/{job_id}/artifacts/{rel_path}",
    )
