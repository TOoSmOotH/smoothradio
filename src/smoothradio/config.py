"""Application configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """SmoothRadio configuration loaded from environment variables."""

    host: str = "0.0.0.0"
    port: int = 8000

    # Media library path
    media_dir: str = "./media"

    # Static files directory for the web player
    static_dir: str = "./static"

    # Streaming
    stream_chunk_size: int = 8192

    model_config = {"env_prefix": "SMOOTHRADIO_"}


settings = Settings()
