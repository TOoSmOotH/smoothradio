"""Application configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """SmoothRadio configuration loaded from environment variables."""

    media_dir: str = "./media"

    model_config = {"env_prefix": "SMOOTHRADIO_"}


settings = Settings()
