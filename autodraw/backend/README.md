# PaperDraw Backend

独立后端目录，负责提交任务、轮询状态、下载完整 `zip` 资产包。

## 目录说明

- `app/`: FastAPI 服务代码
- `app/pipeline/autofigure2.py`: 本地化后的完整 pipeline 逻辑
- `runtime/jobs/`: 每个 job 的运行目录和产物
- `requirements.txt`: 后端依赖
- `.env.example`: 环境变量示例

## 启动方式

在 `autodraw/` 目录下执行：

```bash
cd autodraw
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --host 0.0.0.0 --port 8001
```

健康检查：

```bash
curl http://127.0.0.1:8001/healthz
```

## 接口

- `POST /api/jobs`: 提交完整 pipeline 任务
- `GET /api/jobs/{job_id}`: 查询任务状态
- `GET /api/jobs/{job_id}/bundle`: 下载完整 zip
- `GET /api/jobs/{job_id}/artifacts/{path}`: 下载单个产物

## 模型配置

后端支持三层模型优先级：

1. 请求体显式传入 `image_model` / `ca_api_key` / `ca_base_url` / `ca_model` / `ca_language` / `svg_model`
2. `.env` 中的 provider 专属模型
3. 代码里的默认模型

推荐在 `autodraw/backend/.env` 中配置，例如：

```bash
DEFAULT_IMAGE_MODEL=
DEFAULT_CA_API_KEY=
DEFAULT_CA_BASE_URL=
DEFAULT_CA_MODEL=
DEFAULT_SVG_MODEL=

QINGYUN_IMAGE_MODEL=gemini-3-pro-image-preview
QINGYUN_CA_API_KEY=
QINGYUN_CA_BASE_URL=https://api.qingyuntop.top/v1
QINGYUN_CA_MODEL=gemini-3.1-pro-preview
QINGYUN_SVG_MODEL=gemini-3.1-pro-preview

BIANXIE_IMAGE_MODEL=gemini-3-pro-image-preview
BIANXIE_CA_API_KEY=
BIANXIE_CA_BASE_URL=https://api.bianxie.ai/v1
BIANXIE_CA_MODEL=gemini-3.1-pro-preview
BIANXIE_SVG_MODEL=gemini-3.1-pro-preview
```

说明：

- `DEFAULT_IMAGE_MODEL` / `DEFAULT_CA_API_KEY` / `DEFAULT_CA_BASE_URL` / `DEFAULT_CA_MODEL` / `DEFAULT_SVG_MODEL` 是全局兜底
- `QINGYUN_IMAGE_MODEL` / `QINGYUN_CA_API_KEY` / `QINGYUN_CA_BASE_URL` / `QINGYUN_CA_MODEL` / `QINGYUN_SVG_MODEL` 这类是 provider 专属覆盖
- 如果请求体里传了 `image_model` / `ca_api_key` / `ca_base_url` / `ca_model` / `svg_model`，会覆盖 `.env`
- `ca_language` 控制意图选择返回语言，支持 `zh` 和 `en`，默认 `zh`；它是请求体参数，不需要写入 `.env`
- `QINGYUN_BASE_URL` 默认走 OpenAI 兼容接口；当 `qingyun` 请求失败时，后端会自动回退到 Gemini 原生 `generateContent`
- 如需显式指定原生 Gemini 基地址，可配置 `QINGYUN_GEMINI_BASE_URL`

## 自部署 SAM3 适配

如果你已经把 `sam3_api.py` 部署在服务器上，例如：

- 服务地址：`http://YOUR_HOST:9001/fal-ai/sam-3/image`
- API Key：`123456`

则有两种接法：

1. 通过前端或请求体显式传参

```json
{
  "sam_backend": "api",
  "sam_api_url": "http://YOUR_HOST:9001/fal-ai/sam-3/image",
  "sam_api_key": "123456"
}
```

2. 通过 `autodraw/backend/.env` 固定配置

```bash
QINGYUN_BASE_URL=https://api.qingyuntop.top/v1
SAM3_API_URL=http://YOUR_HOST:9001/fal-ai/sam-3/image
SAM3_API_KEY=123456
```

说明：

- `sam_backend` 设为 `api` 或 `fal` 都会走这条 HTTP 接口逻辑
- 当前后端会优先使用请求体里的 `sam_api_url` / `sam_api_key`
- 若请求体未传，则回退到 `.env` 里的 `SAM3_API_URL` / `SAM3_API_KEY`
- 你的自部署 `sam3_api.py` 使用 `Authorization: Key <api_key>`，当前后端已兼容

## 运行产物

每个任务输出到 `backend/runtime/jobs/<job_id>/`，目录内通常包含：

- `figure.png`
- `samed.png`
- `boxlib.json`
- `template.svg`
- `optimized_template.svg`
- `final.svg`
- `icons/`
- `run.log`
- `manifest.json`
- `bundle.zip`

## 说明

- 当前版本不依赖 `autodraw/` 目录外的 Python 源文件
- 若使用本地 SAM3，仍需单独安装 `sam3` 包和相关模型
- 后端默认串行执行任务，避免参考图全局变量冲突
