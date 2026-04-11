"""Application configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """SmoothRadio configuration loaded from environment variables."""

    host: str = "0.0.0.0"
    port: int = 8000

    media_dir: str = "./media"

    # AI categorization via OpenAI-compatible endpoint
    # (works with OpenAI, Ollama, vLLM, LM Studio, LiteLLM, etc.)
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    categorization_model: str = "gpt-4o-mini"
    categorization_batch_size: int = 10
    categorization_timeout_seconds: float = 30.0
    categorization_max_tokens: int = 512

    admin_api_key: str = ""

    stream_chunk_size: int = 8192
    stream_buffer_seconds: int = 5
    max_stream_sessions: int = 100

    model_config = {"env_prefix": "SMOOTHRADIO_"}


settings = Settings()
