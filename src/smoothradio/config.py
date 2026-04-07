"""Application configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """SmoothRadio configuration loaded from environment variables."""

    host: str = "0.0.0.0"
    port: int = 8000

    # Media library path
    media_dir: str = "./media"

    # AI categorization
    anthropic_api_key: str = ""
    categorization_model: str = "claude-sonnet-4-20250514"
    categorization_batch_size: int = 10

    # Admin API key for protected endpoints (categorization, library scan)
    admin_api_key: str = ""

    # Streaming
    stream_chunk_size: int = 8192
    stream_buffer_seconds: int = 5

    model_config = {"env_prefix": "SMOOTHRADIO_"}


settings = Settings()
